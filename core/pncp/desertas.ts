/**
 * Leitura do PNCP para achar dispensas sem vencedor.
 *  - Lista: GET /api/consulta/v1/contratacoes/publicacao (compras publicadas num intervalo de datas, por UF e modalidade).
 *  - Itens: GET /api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens, com situacaoCompraItem
 *    (1 em andamento, 2 homologado, 3 anulado/revogado/cancelado, 4 deserto, 5 fracassado). Conferido em 18/11/2026.
 */
import { z } from "zod";
import type { ItemSituacao } from "../desertas";
import { ErroPncp } from "./client";
import { contratacaoSchema, paginaSchema, type ContratacaoPncp } from "./schema";

const URL_PUBLICACAO = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao";
const URL_COMPRAS = "https://pncp.gov.br/api/pncp/v1/orgaos";
const TAMANHO_PAGINA = 50;
const TIMEOUT_MS = 8000;
const ESPERA_RETRY_MS = 800;
const STATUS_COM_RETRY: ReadonlySet<number> = new Set([429, 500, 502, 503, 504]);

export interface OpcoesDesertas {
  /** Permite trocar o fetch nos testes */
  fetchImpl?: typeof fetch;
  /** Espera antes da nova tentativa em 429/5xx; 0 nos testes */
  esperaRetryMs?: number;
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

async function chamar(url: string, opcoes: OpcoesDesertas): Promise<Response> {
  const fetchImpl = opcoes.fetchImpl ?? fetch;
  const espera = opcoes.esperaRetryMs ?? ESPERA_RETRY_MS;
  for (let tentativa = 0; ; tentativa += 1) {
    const ultima = tentativa >= 1;
    try {
      const r = await fetchImpl(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
      if (!ultima && STATUS_COM_RETRY.has(r.status)) {
        await r.body?.cancel();
        await esperar(espera);
        continue;
      }
      return r;
    } catch (e) {
      if (ultima) throw new ErroPncp(e instanceof Error ? e.message : "Falha de rede no PNCP");
      await esperar(espera);
    }
  }
}

export function montarUrlPublicacao(uf: string, modalidadeId: number, dia: string, pagina: number): string {
  const params = new URLSearchParams({
    dataInicial: dia,
    dataFinal: dia,
    codigoModalidadeContratacao: String(modalidadeId),
    uf,
    pagina: String(pagina),
    tamanhoPagina: String(TAMANHO_PAGINA),
  });
  return `${URL_PUBLICACAO}?${params.toString()}`;
}

export interface PaginaPublicacao {
  compras: ContratacaoPncp[];
  totalPaginas: number;
}

/** Uma página das compras publicadas no dia. Lança ErroPncp quando o portal falha. */
export async function buscarPublicacoesDoDia(
  uf: string,
  modalidadeId: number,
  dia: string,
  pagina: number,
  opcoes: OpcoesDesertas = {},
): Promise<PaginaPublicacao> {
  const r = await chamar(montarUrlPublicacao(uf, modalidadeId, dia, pagina), opcoes);
  if (r.status === 204 || r.status === 404) return { compras: [], totalPaginas: 0 };
  if (!r.ok) throw new ErroPncp(`PNCP respondeu HTTP ${r.status} na consulta por publicação`, r.status);
  const corpo = paginaSchema.safeParse(await r.json());
  if (!corpo.success) throw new ErroPncp("Resposta do PNCP fora do formato esperado");
  const compras: ContratacaoPncp[] = [];
  for (const bruto of corpo.data.data) {
    const c = contratacaoSchema.safeParse(bruto);
    if (c.success) compras.push(c.data);
  }
  return { compras, totalPaginas: corpo.data.totalPaginas ?? 1 };
}

const itemSchema = z.object({
  numeroItem: z.number().int(),
  descricao: z.string().nullish(),
  situacaoCompraItem: z.number().nullish(),
  situacaoCompraItemNome: z.string().nullish(),
  valorTotal: z.number().nullish(),
  dataAtualizacao: z.string().nullish(),
});

/** Itens da compra (até 50, a primeira página) só com o que a deserta precisa. Lança ErroPncp quando o portal falha. */
export async function buscarSituacaoDosItens(
  cnpj: string,
  ano: number,
  sequencial: number,
  opcoes: OpcoesDesertas = {},
): Promise<ItemSituacao[]> {
  const url = `${URL_COMPRAS}/${cnpj}/compras/${ano}/${sequencial}/itens?pagina=1&tamanhoPagina=${TAMANHO_PAGINA}`;
  const r = await chamar(url, opcoes);
  if (r.status === 204 || r.status === 404) return [];
  if (!r.ok) throw new ErroPncp(`PNCP respondeu HTTP ${r.status} nos itens`, r.status);
  const lista = z.array(z.unknown()).safeParse(await r.json());
  if (!lista.success) throw new ErroPncp("Itens do PNCP fora do formato esperado");
  const itens: ItemSituacao[] = [];
  for (const bruto of lista.data) {
    const i = itemSchema.safeParse(bruto);
    if (!i.success) continue;
    itens.push({
      numero: i.data.numeroItem,
      descricao: i.data.descricao ?? "",
      situacaoId: i.data.situacaoCompraItem ?? null,
      situacaoNome: i.data.situacaoCompraItemNome ?? null,
      valorTotal: typeof i.data.valorTotal === "number" ? i.data.valorTotal : null,
      atualizadoEm: i.data.dataAtualizacao ?? null,
    });
  }
  return itens;
}
