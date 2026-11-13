/**
 * Busca de contratações homologadas no PNCP para comparar preços.
 * Endpoint: GET /api/consulta/v1/contratacoes/publicacao (dataInicial, dataFinal, codigoModalidadeContratacao, uf).
 * Ele não filtra por texto: cada página traz 50 contratações e o filtro por palavras-chave é feito aqui.
 * Por isso a busca é uma amostra: no máximo 6 requisições, uma página de cada janela de 4 meses.
 */
import type { AmostraConcorrente } from "../concorrentes";
import { contratacaoSchema } from "./schema";
import { z } from "zod";

const URL_BASE = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao";
export const MAX_REQUISICOES = 6;
const TAMANHO_PAGINA = 50;
/** A consulta por período costuma levar de 20 a 50 s */
const TIMEOUT_MS = 45_000;
const ESPERA_429_PADRAO_MS = 4_000;
const ESPERA_429_MAXIMA_MS = 15_000;
const TENTATIVAS_EXTRAS_429 = 2;
/** Passou disso, para de pedir e devolve o que tem */
export const ORCAMENTO_MS = 150_000;
const JANELAS = 3;
const MESES_POR_JANELA = 4;

export interface RequisicaoPlanejada {
  modalidadeId: number;
  /** yyyyMMdd */
  dataInicial: string;
  dataFinal: string;
  uf: string;
}

function ymd(data: Date): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(data);
  const v = (t: string): string => p.find((x) => x.type === t)?.value ?? "";
  return `${v("year")}${v("month")}${v("day")}`;
}

/**
 * Até 6 requisições: a modalidade da própria licitação nas 3 janelas de 4 meses (últimos 12 meses),
 * depois a outra modalidade (pregão 6 / dispensa 8) nas mesmas janelas. Sempre na UF da licitação.
 */
export function planejarRequisicoes(agora: Date, uf: string, modalidadeId: number): RequisicaoPlanejada[] {
  const outra = modalidadeId === 8 ? 6 : 8;
  const janelas: Array<{ dataInicial: string; dataFinal: string }> = [];
  for (let i = 0; i < JANELAS; i += 1) {
    const fim = new Date(agora.getTime() - i * MESES_POR_JANELA * 30 * 86_400_000);
    const inicio = new Date(fim.getTime() - MESES_POR_JANELA * 30 * 86_400_000 + 86_400_000);
    janelas.push({ dataInicial: ymd(inicio), dataFinal: ymd(fim) });
  }
  const ufNorm = uf.trim().toUpperCase();
  const lista: RequisicaoPlanejada[] = [];
  for (const m of [modalidadeId === 6 ? 6 : 8, outra]) {
    for (const j of janelas) lista.push({ modalidadeId: m, ...j, uf: ufNorm });
  }
  return lista.slice(0, MAX_REQUISICOES);
}

function montarUrl(r: RequisicaoPlanejada): string {
  const params = new URLSearchParams({
    dataInicial: r.dataInicial,
    dataFinal: r.dataFinal,
    codigoModalidadeContratacao: String(r.modalidadeId),
    pagina: "1",
    tamanhoPagina: String(TAMANHO_PAGINA),
  });
  if (r.uf !== "") params.set("uf", r.uf);
  return `${URL_BASE}?${params.toString()}`;
}

/** Contratação homologada: valor homologado informado e maior que zero. Itens fora do formato são descartados. */
export function extrairHomologadas(corpo: unknown): AmostraConcorrente[] {
  const pagina = z.object({ data: z.array(z.unknown()) }).safeParse(corpo);
  if (!pagina.success) return [];
  const saida: AmostraConcorrente[] = [];
  for (const bruto of pagina.data.data) {
    const c = contratacaoSchema.safeParse(bruto);
    const extra = z.object({ valorTotalHomologado: z.number().nullish(), dataPublicacaoPncp: z.string().nullish() }).safeParse(bruto);
    if (!c.success || !extra.success) continue;
    const homologado = extra.data.valorTotalHomologado;
    if (typeof homologado !== "number" || !(homologado > 0)) continue;
    const d = c.data;
    const estimado = typeof d.valorTotalEstimado === "number" && d.valorTotalEstimado > 0 ? d.valorTotalEstimado : null;
    const publicada = extra.data.dataPublicacaoPncp ? new Date(`${extra.data.dataPublicacaoPncp}-03:00`) : null;
    saida.push({
      idPncp: d.numeroControlePNCP,
      objeto: (d.objetoCompra ?? "").replace(/\s+/g, " ").trim(),
      uf: (d.unidadeOrgao.ufSigla ?? "").toUpperCase(),
      orgao: (d.orgaoEntidade.razaoSocial ?? "").trim(),
      valorEstimado: estimado,
      valorHomologado: homologado,
      publicadaEm: publicada && !Number.isNaN(publicada.getTime()) ? publicada.toISOString() : null,
      link: `https://pncp.gov.br/app/editais/${d.orgaoEntidade.cnpj}/${d.anoCompra}/${d.sequencialCompra}`,
    });
  }
  return saida;
}

export interface OpcoesConcorrentes {
  fetchImpl?: typeof fetch;
  agora?: Date;
  /** Espera antes de tentar de novo após 429; padrão: Retry-After (máx. 15 s) ou 4 s */
  esperar?: (ms: number) => Promise<void>;
  /** Relógio em ms, para o orçamento de tempo */
  relogio?: () => number;
}

export interface ResultadoBuscaConcorrentes {
  amostras: AmostraConcorrente[];
  /** Requisições lógicas feitas (no máximo 6) */
  requisicoes: number;
  falhas: number;
  /** O PNCP limitou a taxa (429) e a busca parou antes de terminar */
  limitado: boolean;
}

function esperaPadrao(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

function esperaDoRetryAfter(resposta: Response): number {
  const bruto = Number(resposta.headers.get("retry-after"));
  if (Number.isFinite(bruto) && bruto > 0) return Math.min(bruto * 1000, ESPERA_429_MAXIMA_MS);
  return ESPERA_429_PADRAO_MS;
}

/**
 * Faz as requisições em série (nunca em rajada). Em 429 espera e tenta de novo até 2 vezes;
 * se continuar limitado, para e devolve o que já tem. Nunca lança.
 */
export async function buscarHomologadas(
  uf: string,
  modalidadeId: number,
  opcoes: OpcoesConcorrentes = {},
): Promise<ResultadoBuscaConcorrentes> {
  const fetchImpl = opcoes.fetchImpl ?? fetch;
  const esperar = opcoes.esperar ?? esperaPadrao;
  const relogio = opcoes.relogio ?? Date.now;
  const inicio = relogio();
  const plano = planejarRequisicoes(opcoes.agora ?? new Date(), uf, modalidadeId);

  const porId = new Map<string, AmostraConcorrente>();
  let requisicoes = 0;
  let falhas = 0;
  let limitado = false;

  for (const req of plano) {
    if (relogio() - inicio > ORCAMENTO_MS) break;
    requisicoes += 1;
    let feita = false;
    for (let tentativa = 0; tentativa <= TENTATIVAS_EXTRAS_429; tentativa += 1) {
      try {
        const resposta = await fetchImpl(montarUrl(req), {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(TIMEOUT_MS),
          cache: "no-store",
        });
        if (resposta.status === 429) {
          const espera = esperaDoRetryAfter(resposta);
          await resposta.body?.cancel();
          if (tentativa >= TENTATIVAS_EXTRAS_429) {
            limitado = true;
            break;
          }
          await esperar(espera);
          continue;
        }
        if (resposta.status === 204) {
          feita = true;
          break;
        }
        if (!resposta.ok) break;
        for (const a of extrairHomologadas(await resposta.json())) porId.set(a.idPncp, a);
        feita = true;
        break;
      } catch {
        break;
      }
    }
    if (!feita) falhas += 1;
    if (limitado) break;
  }

  return { amostras: [...porId.values()], requisicoes, falhas, limitado };
}
