import { diaDeSaoPaulo } from "@/core/avisos";

/**
 * Meta semanal de disputas. Conta como disputa o item do Pipeline que entrou na etapa "disputa" na semana
 * (segunda 0h a domingo 23h59, horário de São Paulo). O mesmo item conta uma vez por semana.
 */

const MS_DIA = 24 * 3_600_000;
const MS_SEMANA = 7 * MS_DIA;

export const META_MINIMO_PADRAO = 5;
export const META_IDEAL_PADRAO = 10;
export const META_LIMITE = 500;
export const SEMANAS_DO_HISTORICO = 4;

export interface MetaConfig {
  minimo: number;
  ideal: number;
}

export const META_PADRAO: MetaConfig = { minimo: META_MINIMO_PADRAO, ideal: META_IDEAL_PADRAO };

export type StatusMeta = "abaixo" | "minimo" | "ideal";

/**
 * Um item que entrou numa etapa (disputa ou ganha), e quando. `valor` é o total da proposta aprovada, pronta ou
 * enviada do item; sem proposta, o valor estimado do item (e `estimado` fica verdadeiro). Sem nenhum dos dois, null.
 */
export interface EntradaEmDisputa {
  itemId: string;
  em: Date;
  valor?: number | null;
  estimado?: boolean;
}

/** Item que entrou na etapa "ganha" (mesmo formato da entrada em disputa). */
export type EntradaVencida = EntradaEmDisputa;

/** Disputadas e vencidas de uma janela, com a soma dos valores. */
export interface GanhosMeta {
  disputadas: number;
  valorDisputadas: number;
  /** Algum valor somado nas disputadas veio do valor estimado do item, não de proposta */
  estimadoDisputadas: boolean;
  vencidas: number;
  valorVencidas: number;
  /** Algum valor somado nas vencidas veio do valor estimado do item, não de proposta */
  estimadoVencidas: boolean;
}

export interface SemanaGanhos extends GanhosMeta {
  /** ISO 8601: segunda-feira 0h (São Paulo) */
  inicio: string;
}

export interface GanhosDoPainel {
  semana: SemanaGanhos;
  /** As quatro semanas anteriores, da mais antiga para a mais recente */
  historico: SemanaGanhos[];
}

export interface SemanaMeta {
  /** ISO 8601: segunda-feira 0h (São Paulo) */
  inicio: string;
  disputas: number;
  status: StatusMeta;
}

export interface PlacarMeta {
  /** ISO 8601: segunda-feira 0h (São Paulo) */
  inicio: string;
  disputas: number;
  status: StatusMeta;
  faltamParaMinimo: number;
  faltamParaIdeal: number;
}

export interface PropostasDaSemana {
  enviadas: number;
  aguardando: number;
  ganhas: number;
}

/** Tudo o que o painel "Meta da semana" mostra; só dados simples, serializáveis. */
export interface PainelMeta {
  meta: MetaConfig;
  placar: PlacarMeta;
  /** As quatro semanas anteriores, da mais antiga para a mais recente */
  historico: SemanaMeta[];
  propostas: PropostasDaSemana;
  ganhos: GanhosDoPainel;
}

function inteiroEntre(valor: number, de: number, ate: number): number {
  if (!Number.isFinite(valor)) return de;
  return Math.min(ate, Math.max(de, Math.trunc(valor)));
}

/** Mínimo de 1; o ideal nunca fica abaixo do mínimo. */
export function normalizarMeta(minimo: number, ideal: number): MetaConfig {
  const min = inteiroEntre(minimo, 1, META_LIMITE);
  return { minimo: min, ideal: inteiroEntre(ideal, min, META_LIMITE) };
}

/** Segunda-feira 0h (São Paulo) da semana de `agora`. */
export function inicioDaSemana(agora: Date): Date {
  const dia = diaDeSaoPaulo(agora);
  const semana = new Date(`${dia}T12:00:00Z`).getUTCDay();
  const voltar = (semana + 6) % 7;
  return new Date(new Date(`${dia}T00:00:00-03:00`).getTime() - voltar * MS_DIA);
}

export function statusDaMeta(disputas: number, meta: MetaConfig): StatusMeta {
  if (disputas >= meta.ideal) return "ideal";
  if (disputas >= meta.minimo) return "minimo";
  return "abaixo";
}

/** Itens distintos que entraram em disputa dentro de [de, ate). */
function contarNaJanela(entradas: ReadonlyArray<EntradaEmDisputa>, de: Date, ate: Date): number {
  const itens = new Set<string>();
  for (const e of entradas) {
    const t = e.em.getTime();
    if (t >= de.getTime() && t < ate.getTime()) itens.add(e.itemId);
  }
  return itens.size;
}

/** Placar da semana de `agora`. */
export function placar(entradas: ReadonlyArray<EntradaEmDisputa>, agora: Date, meta: MetaConfig): PlacarMeta {
  const inicio = inicioDaSemana(agora);
  const disputas = contarNaJanela(entradas, inicio, new Date(inicio.getTime() + MS_SEMANA));
  return {
    inicio: inicio.toISOString(),
    disputas,
    status: statusDaMeta(disputas, meta),
    faltamParaMinimo: Math.max(0, meta.minimo - disputas),
    faltamParaIdeal: Math.max(0, meta.ideal - disputas),
  };
}

/** As `semanas` semanas anteriores à atual (sem contar a atual), da mais antiga para a mais recente. */
export function ultimasSemanas(
  entradas: ReadonlyArray<EntradaEmDisputa>,
  agora: Date,
  meta: MetaConfig,
  semanas: number = SEMANAS_DO_HISTORICO,
): SemanaMeta[] {
  const atual = inicioDaSemana(agora).getTime();
  const lista: SemanaMeta[] = [];
  for (let atras = semanas; atras >= 1; atras -= 1) {
    const inicio = new Date(atual - atras * MS_SEMANA);
    const disputas = contarNaJanela(entradas, inicio, new Date(inicio.getTime() + MS_SEMANA));
    lista.push({ inicio: inicio.toISOString(), disputas, status: statusDaMeta(disputas, meta) });
  }
  return lista;
}

/** Quando começa o histórico que a consulta precisa ler: o início da semana mais antiga mostrada. */
export function inicioDoHistorico(agora: Date, semanas: number = SEMANAS_DO_HISTORICO): Date {
  return new Date(inicioDaSemana(agora).getTime() - semanas * MS_SEMANA);
}

/** Itens distintos de [de, ate): quantos são e a soma dos valores (cada item conta uma vez, pela primeira entrada). */
function somarNaJanela(
  entradas: ReadonlyArray<EntradaEmDisputa>,
  de: Date,
  ate: Date,
): { quantidade: number; valor: number; estimado: boolean } {
  const itens = new Map<string, EntradaEmDisputa>();
  for (const e of entradas) {
    const t = e.em.getTime();
    if (t < de.getTime() || t >= ate.getTime()) continue;
    const antes = itens.get(e.itemId);
    if (antes === undefined || t < antes.em.getTime()) itens.set(e.itemId, e);
  }
  let valor = 0;
  let estimado = false;
  for (const e of itens.values()) {
    if (e.valor === undefined || e.valor === null || !Number.isFinite(e.valor) || e.valor <= 0) continue;
    valor += e.valor;
    if (e.estimado === true) estimado = true;
  }
  return { quantidade: itens.size, valor, estimado };
}

/** Disputadas e vencidas (com valores) dentro da semana que começa em `inicio`. */
export function ganhosDaJanela(
  disputas: ReadonlyArray<EntradaEmDisputa>,
  vencidas: ReadonlyArray<EntradaVencida>,
  inicio: Date,
): SemanaGanhos {
  const fim = new Date(inicio.getTime() + MS_SEMANA);
  const d = somarNaJanela(disputas, inicio, fim);
  const v = somarNaJanela(vencidas, inicio, fim);
  return {
    inicio: inicio.toISOString(),
    disputadas: d.quantidade,
    valorDisputadas: d.valor,
    estimadoDisputadas: d.estimado,
    vencidas: v.quantidade,
    valorVencidas: v.valor,
    estimadoVencidas: v.estimado,
  };
}

/** A semana de `agora` e as `semanas` anteriores, com disputadas, vencidas e valores. */
export function ganhosDoPainel(
  disputas: ReadonlyArray<EntradaEmDisputa>,
  vencidas: ReadonlyArray<EntradaVencida>,
  agora: Date,
  semanas: number = SEMANAS_DO_HISTORICO,
): GanhosDoPainel {
  const atual = inicioDaSemana(agora);
  const historico: SemanaGanhos[] = [];
  for (let atras = semanas; atras >= 1; atras -= 1) {
    historico.push(ganhosDaJanela(disputas, vencidas, new Date(atual.getTime() - atras * MS_SEMANA)));
  }
  return { semana: ganhosDaJanela(disputas, vencidas, atual), historico };
}

/** "3 disputadas · 1 vencida · R$ 12.500 ganhos" (valor estimado leva "~"); sem valor, a parte do dinheiro some. */
export function linhaDeGanhos(g: GanhosMeta, formatarValor: (valor: number) => string): string {
  const partes = [
    `${g.disputadas} ${g.disputadas === 1 ? "disputada" : "disputadas"}`,
    `${g.vencidas} ${g.vencidas === 1 ? "vencida" : "vencidas"}`,
  ];
  if (g.vencidas > 0 && g.valorVencidas > 0) {
    partes.push(`${g.estimadoVencidas ? "~" : ""}${formatarValor(g.valorVencidas)} ganhos`);
  }
  return partes.join(" · ");
}

export function montarPainelMeta(
  entradas: ReadonlyArray<EntradaEmDisputa>,
  agora: Date,
  meta: MetaConfig,
  propostas: PropostasDaSemana,
  vencidas: ReadonlyArray<EntradaVencida> = [],
): PainelMeta {
  return {
    meta,
    placar: placar(entradas, agora, meta),
    historico: ultimasSemanas(entradas, agora, meta),
    propostas,
    ganhos: ganhosDoPainel(entradas, vencidas, agora),
  };
}

/** Largura da barra em %, limitada ao ideal. */
export function percentualDaBarra(disputas: number, meta: MetaConfig): number {
  if (meta.ideal <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((disputas / meta.ideal) * 100)));
}

/** Posição da marca do mínimo na barra, em %. */
export function posicaoDoMinimo(meta: MetaConfig): number {
  if (meta.ideal <= 0) return 0;
  return Math.min(100, Math.round((meta.minimo / meta.ideal) * 100));
}
