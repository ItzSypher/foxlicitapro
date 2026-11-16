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

/** Estado da consulta quando ninguém pede outro: o Radar diário olha só o Rio de Janeiro. */
export const UF_PADRAO = "RJ";

export interface OpcoesBusca {
  /** Permite trocar o fetch nos testes */
  fetchImpl?: typeof fetch;
  agora?: Date;
  /** Esperas entre tentativas; lista vazia desliga o retry (usado nos testes) */
  esperasRetryMs?: readonly number[];
  /** Sigla da UF. Ausente vale "RJ"; `null` consulta o Brasil todo (sem o parâmetro uf). */
  uf?: string | null;
  /** Código IBGE do município (7 dígitos); ausente não filtra por município */
  codigoMunicipioIbge?: string;
  /** Máximo de páginas por modalidade; ausente vale 10 */
  maxPaginas?: number;
  /** Timeout de cada chamada, em ms; ausente vale 8000 */
  timeoutMs?: number;
  /** Janela, em dias a partir de hoje, das propostas que ainda encerram; ausente vale 60 */
  diasAFrente?: number;
}

/** Parâmetros da consulta que mudam conforme a busca; o resto é fixo. */
export interface ParametrosConsulta {
  uf: string | null;
  codigoMunicipioIbge?: string;
}

/** Data de hoje + 60 dias (ou `dias`) no formato yyyyMMdd, no fuso de Brasília. */
export function dataFinalPara(agora: Date, dias: number = DIAS_A_FRENTE): string {
  const futuro = new Date(agora.getTime() + dias * 24 * 60 * 60 * 1000);
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(futuro);
  const valor = (tipo: string): string => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${valor("year")}${valor("month")}${valor("day")}`;
}

/** URL da consulta. Sem `uf` na consulta o parâmetro some (Brasil todo); o município só entra se informado. */
export function montarUrl(
  modalidadeId: ModalidadeId,
  dataFinal: string,
  pagina: number,
  consulta: ParametrosConsulta = { uf: UF_PADRAO },
): string {
  const params = new URLSearchParams({
    dataFinal,
    codigoModalidadeContratacao: String(modalidadeId),
  });
  if (consulta.uf !== null) params.set("uf", consulta.uf);
  if (consulta.codigoMunicipioIbge) params.set("codigoMunicipioIbge", consulta.codigoMunicipioIbge);
  params.set("pagina", String(pagina));
  params.set("tamanhoPagina", String(TAMANHO_PAGINA));
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
  timeoutMs: number,
): Promise<Response> {
  for (let tentativa = 0; ; tentativa += 1) {
    const ultima = tentativa >= esperasMs.length;
    try {
      const resposta = await fetchImpl(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
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
  consulta: ParametrosConsulta,
  timeoutMs: number,
): Promise<PaginaLida> {
  const resposta = await chamar(fetchImpl, montarUrl(modalidadeId, dataFinal, pagina, consulta), esperasMs, timeoutMs);
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

/** Resultado de uma modalidade com a conta de páginas, para avisar quando a busca foi cortada. */
export interface ResultadoModalidadeDetalhado extends ResultadoModalidade {
  /** Páginas pedidas ao PNCP (a primeira conta mesmo quando falha) */
  paginasConsultadas: number;
  /** Total de páginas que o PNCP informou; 0 quando a primeira página falhou */
  totalPaginas: number;
}

/**
 * Busca as contratações de uma modalidade: primeira página em série, demais em lotes,
 * até `maxPaginas` (10 por padrão). Nunca lança: a falha vira `falhou`.
 */
export async function buscarModalidadeDetalhada(
  modalidadeId: ModalidadeId,
  opcoes: OpcoesBusca = {},
): Promise<ResultadoModalidadeDetalhado> {
  const fetchImpl = opcoes.fetchImpl ?? fetch;
  const dataFinal = dataFinalPara(opcoes.agora ?? new Date(), opcoes.diasAFrente);
  const esperasMs = opcoes.esperasRetryMs ?? ESPERAS_RETRY_PADRAO_MS;
  const maxPaginas = Math.max(1, Math.floor(opcoes.maxPaginas ?? MAX_PAGINAS));
  const timeoutMs = opcoes.timeoutMs ?? TIMEOUT_MS;
  const consulta: ParametrosConsulta = {
    uf: opcoes.uf === undefined ? UF_PADRAO : opcoes.uf,
    ...(opcoes.codigoMunicipioIbge ? { codigoMunicipioIbge: opcoes.codigoMunicipioIbge } : {}),
  };

  let primeira: PaginaLida;
  try {
    primeira = await lerPagina(fetchImpl, modalidadeId, dataFinal, 1, esperasMs, consulta, timeoutMs);
  } catch {
    return { modalidadeId, contratacoes: [], falhou: true, paginasConsultadas: 1, totalPaginas: 0 };
  }

  const ultima = Math.min(primeira.totalPaginas, maxPaginas);
  const numerosRestantes: number[] = [];
  for (let n = 2; n <= ultima; n += 1) numerosRestantes.push(n);

  // O PNCP responde 429 a rajadas: as páginas seguem em lotes pequenos, não todas de uma vez.
  const restantes: PromiseSettledResult<PaginaLida>[] = [];
  for (let i = 0; i < numerosRestantes.length; i += PAGINAS_POR_LOTE) {
    const lote = numerosRestantes.slice(i, i + PAGINAS_POR_LOTE);
    restantes.push(
      ...(await Promise.allSettled(
        lote.map((n) => lerPagina(fetchImpl, modalidadeId, dataFinal, n, esperasMs, consulta, timeoutMs)),
      )),
    );
  }

  const contratacoes = [...primeira.itens];
  let falhou = false;
  for (const r of restantes) {
    if (r.status === "fulfilled") contratacoes.push(...r.value.itens);
    else falhou = true;
  }
  return {
    modalidadeId,
    contratacoes,
    falhou,
    paginasConsultadas: Math.max(1, ultima),
    totalPaginas: primeira.totalPaginas,
  };
}

/** Busca todas as contratações de uma modalidade. Nunca lança: a falha vira `falhou`. */
export async function buscarModalidade(
  modalidadeId: ModalidadeId,
  opcoes: OpcoesBusca = {},
): Promise<ResultadoModalidade> {
  const { contratacoes, falhou } = await buscarModalidadeDetalhada(modalidadeId, opcoes);
  return { modalidadeId, contratacoes, falhou };
}

/** Busca as duas modalidades de forma independente. */
export async function buscarContratacoes(opcoes: OpcoesBusca = {}): Promise<ResultadoModalidade[]> {
  return Promise.all(MODALIDADES.map((m) => buscarModalidade(m, opcoes)));
}

/** Igual a `buscarContratacoes`, com a conta de páginas de cada modalidade. */
export async function buscarContratacoesDetalhadas(opcoes: OpcoesBusca = {}): Promise<ResultadoModalidadeDetalhado[]> {
  return Promise.all(MODALIDADES.map((m) => buscarModalidadeDetalhada(m, opcoes)));
}
