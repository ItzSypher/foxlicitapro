import type { ModalidadeId } from "../types";
import { contratacaoSchema, paginaSchema, type ContratacaoPncp } from "./schema";

const URL_BASE = "https://pncp.gov.br/api/consulta/v1/contratacoes/proposta";
const TAMANHO_PAGINA = 50;
const MAX_PAGINAS = 10;
const PAGINAS_POR_LOTE = 2;
const TIMEOUT_MS = 8000;
const DIAS_A_FRENTE = 60;
const REVALIDAR_SEGUNDOS = 3600;

export const MODALIDADES: readonly ModalidadeId[] = [6, 8];

export class ErroPncp extends Error {
  constructor(mensagem: string, readonly status?: number) {
    super(mensagem);
    this.name = "ErroPncp";
  }
}

export interface ResultadoModalidade {
  modalidadeId: ModalidadeId;
  contratacoes: ContratacaoPncp[];
  /** true quando a primeira página falhou ou alguma página seguinte falhou */
  falhou: boolean;
}

/** Esperas, em ms, antes de cada nova tentativa quando o PNCP limita a taxa ou oscila. */
const ESPERAS_RETRY_PADRAO_MS: readonly number[] = [700, 1500];
const STATUS_COM_RETRY: ReadonlySet<number> = new Set([429, 502, 503, 504]);

export interface OpcoesBusca {
  /** Permite trocar o fetch nos testes */
  fetchImpl?: typeof fetch;
  agora?: Date;
  /** Esperas entre tentativas; lista vazia desliga o retry (usado nos testes) */
  esperasRetryMs?: readonly number[];
}

/** Data de hoje + 60 dias no formato yyyyMMdd, no fuso de Brasília. */
export function dataFinalPara(agora: Date): string {
  const futuro = new Date(agora.getTime() + DIAS_A_FRENTE * 24 * 60 * 60 * 1000);
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(futuro);
  const valor = (tipo: string): string => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${valor("year")}${valor("month")}${valor("day")}`;
}

function montarUrl(modalidadeId: ModalidadeId, dataFinal: string, pagina: number): string {
  const params = new URLSearchParams({
    dataFinal,
    codigoModalidadeContratacao: String(modalidadeId),
    uf: "RJ",
    pagina: String(pagina),
    tamanhoPagina: String(TAMANHO_PAGINA),
  });
  return `${URL_BASE}?${params.toString()}`;
}

interface PaginaLida {
  itens: ContratacaoPncp[];
  totalPaginas: number;
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

/** Uma chamada com timeout de 8 s e novas tentativas em 429, 502, 503, 504 ou falha de rede. */
async function chamar(
  fetchImpl: typeof fetch,
  url: string,
  esperasMs: readonly number[],
): Promise<Response> {
  for (let tentativa = 0; ; tentativa += 1) {
    const ultima = tentativa >= esperasMs.length;
    try {
      const resposta = await fetchImpl(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        next: { revalidate: REVALIDAR_SEGUNDOS },
      });
      if (ultima || !STATUS_COM_RETRY.has(resposta.status)) return resposta;
      await resposta.body?.cancel();
    } catch (erro) {
      if (ultima) throw erro;
    }
    await esperar(esperasMs[tentativa] ?? 0);
  }
}

async function lerPagina(
  fetchImpl: typeof fetch,
  modalidadeId: ModalidadeId,
  dataFinal: string,
  pagina: number,
  esperasMs: readonly number[],
): Promise<PaginaLida> {
  const resposta = await chamar(fetchImpl, montarUrl(modalidadeId, dataFinal, pagina), esperasMs);
  if (resposta.status === 204) return { itens: [], totalPaginas: 0 };
  if (!resposta.ok) {
    throw new ErroPncp(`PNCP respondeu HTTP ${resposta.status} (modalidade ${modalidadeId}, página ${pagina})`, resposta.status);
  }
  const corpo = paginaSchema.safeParse(await resposta.json());
  if (!corpo.success) {
    throw new ErroPncp(`Resposta do PNCP fora do formato esperado (modalidade ${modalidadeId}, página ${pagina})`);
  }
  const itens: ContratacaoPncp[] = [];
  for (const bruto of corpo.data.data) {
    const item = contratacaoSchema.safeParse(bruto);
    if (item.success) itens.push(item.data);
  }
  return { itens, totalPaginas: corpo.data.totalPaginas ?? 1 };
}

/**
 * Busca todas as contratações de uma modalidade: primeira página em série,
 * demais em paralelo, até o limite de 10 páginas. Nunca lança: a falha vira `falhou`.
 */
export async function buscarModalidade(
  modalidadeId: ModalidadeId,
  opcoes: OpcoesBusca = {},
): Promise<ResultadoModalidade> {
  const fetchImpl = opcoes.fetchImpl ?? fetch;
  const dataFinal = dataFinalPara(opcoes.agora ?? new Date());
  const esperasMs = opcoes.esperasRetryMs ?? ESPERAS_RETRY_PADRAO_MS;

  let primeira: PaginaLida;
  try {
    primeira = await lerPagina(fetchImpl, modalidadeId, dataFinal, 1, esperasMs);
  } catch {
    return { modalidadeId, contratacoes: [], falhou: true };
  }

  const ultima = Math.min(primeira.totalPaginas, MAX_PAGINAS);
  const numerosRestantes: number[] = [];
  for (let n = 2; n <= ultima; n += 1) numerosRestantes.push(n);

  // O PNCP responde 429 a rajadas: as páginas seguem em lotes pequenos, não todas de uma vez.
  const restantes: PromiseSettledResult<PaginaLida>[] = [];
  for (let i = 0; i < numerosRestantes.length; i += PAGINAS_POR_LOTE) {
    const lote = numerosRestantes.slice(i, i + PAGINAS_POR_LOTE);
    restantes.push(
      ...(await Promise.allSettled(
        lote.map((n) => lerPagina(fetchImpl, modalidadeId, dataFinal, n, esperasMs)),
      )),
    );
  }

  const contratacoes = [...primeira.itens];
  let falhou = false;
  for (const r of restantes) {
    if (r.status === "fulfilled") contratacoes.push(...r.value.itens);
    else falhou = true;
  }
  return { modalidadeId, contratacoes, falhou };
}

/** Busca as duas modalidades de forma independente. */
export async function buscarContratacoes(opcoes: OpcoesBusca = {}): Promise<ResultadoModalidade[]> {
  return Promise.all(MODALIDADES.map((m) => buscarModalidade(m, opcoes)));
}
