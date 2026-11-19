/**
 * Resultado (vencedor homologado) de um item de compra no PNCP.
 * Endpoint: GET /api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens/{numero}/resultados
 * Conferido em 18/11/2026: devolve uma lista (um registro por fornecedor homologado) ou 204 sem corpo
 * enquanto o item não tem resultado.
 */
import { z } from "zod";
import type { ChaveCompra } from "../types-detalhe";
import { ErroPncp } from "./client";

const URL_PNCP = "https://pncp.gov.br/api/pncp/v1/orgaos";
const TIMEOUT_MS = 8000;
const ESPERA_RETRY_MS = 800;
const STATUS_COM_RETRY: ReadonlySet<number> = new Set([429, 500, 502, 503, 504]);

const texto = z.string().nullish();
const numero = z.number().nullish();

export const resultadoSchema = z.object({
  numeroItem: z.number().int(),
  sequencialResultado: numero,
  niFornecedor: texto,
  nomeRazaoSocialFornecedor: texto,
  valorTotalHomologado: numero,
  valorUnitarioHomologado: numero,
  quantidadeHomologada: numero,
  dataResultado: texto,
  dataCancelamento: texto,
  situacaoCompraItemResultadoNome: texto,
});

export interface ResultadoItemPncp {
  numeroItem: number;
  /** Só dígitos (CNPJ ou CPF); vazio quando não informado */
  documentoFornecedor: string;
  nomeFornecedor: string;
  valorTotal: number | null;
  valorUnitario: number | null;
  /** yyyy-mm-dd, quando informado */
  data: string | null;
  /** Resultado cancelado no portal: não vale como vencedor */
  cancelado: boolean;
}

function valor(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

/** Valida cada registro sozinho e descarta os fora do formato. */
export function normalizarResultados(lista: readonly unknown[]): ResultadoItemPncp[] {
  const saida: ResultadoItemPncp[] = [];
  for (const bruto of lista) {
    const lido = resultadoSchema.safeParse(bruto);
    if (!lido.success) continue;
    const r = lido.data;
    const situacao = (r.situacaoCompraItemResultadoNome ?? "").toLowerCase();
    saida.push({
      numeroItem: r.numeroItem,
      documentoFornecedor: (r.niFornecedor ?? "").replace(/\D/g, ""),
      nomeFornecedor: (r.nomeRazaoSocialFornecedor ?? "").replace(/\s+/g, " ").trim(),
      valorTotal: valor(r.valorTotalHomologado),
      valorUnitario: valor(r.valorUnitarioHomologado),
      data: r.dataResultado ? r.dataResultado.slice(0, 10) : null,
      cancelado: (r.dataCancelamento ?? "") !== "" || situacao.includes("cancel"),
    });
  }
  return saida;
}

export interface OpcoesResultados {
  /** Permite trocar o fetch nos testes */
  fetchImpl?: typeof fetch;
  /** Espera antes da nova tentativa em 429/5xx; 0 nos testes */
  esperaRetryMs?: number;
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

/**
 * Resultados de um item. Lista vazia quando o item ainda não tem resultado (204 ou 404).
 * Lança ErroPncp quando o portal falha, para a rotina tentar de novo no dia seguinte.
 */
export async function buscarResultadosItem(
  chave: ChaveCompra,
  numeroItem: number,
  opcoes: OpcoesResultados = {},
): Promise<ResultadoItemPncp[]> {
  const fetchImpl = opcoes.fetchImpl ?? fetch;
  const espera = opcoes.esperaRetryMs ?? ESPERA_RETRY_MS;
  const url = `${URL_PNCP}/${chave.cnpj}/compras/${chave.ano}/${chave.sequencial}/itens/${numeroItem}/resultados`;
  for (let tentativa = 0; ; tentativa += 1) {
    const ultima = tentativa >= 1;
    let r: Response;
    try {
      r = await fetchImpl(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    } catch (e) {
      if (ultima) throw new ErroPncp(e instanceof Error ? e.message : "Falha de rede no PNCP");
      await esperar(espera);
      continue;
    }
    if (!ultima && STATUS_COM_RETRY.has(r.status)) {
      await esperar(espera);
      continue;
    }
    if (r.status === 204 || r.status === 404) return [];
    if (!r.ok) throw new ErroPncp("O PNCP não respondeu o resultado do item", r.status);
    const corpo = (await r.text()).trim();
    if (corpo === "") return [];
    let json: unknown;
    try {
      json = JSON.parse(corpo);
    } catch {
      throw new ErroPncp("Resultado do PNCP fora do formato esperado");
    }
    const lista = z.array(z.unknown()).safeParse(json);
    if (!lista.success) throw new ErroPncp("Resultado do PNCP fora do formato esperado");
    return normalizarResultados(lista.data);
  }
}
