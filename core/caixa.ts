/**
 * Caixa de uma licitação: quanto dinheiro sai do bolso, por quantos dias e quando volta.
 * Funções puras, sem rede nem banco. Usa os prazos da ficha do edital (ou digitados à mão)
 * e o custo da cotação (ou digitado).
 */
import { calcularCapitalGiro, type CapitalGiro } from "./capital-giro";

/** Limites que o dono definiu em Preferências. Nulo = sem limite. */
export interface LimitesCaixa {
  /** R$ máximo que o dono aceita pagar antes de receber, por licitação */
  capitalMaximo: number | null;
  /** Dias máximos com o dinheiro parado */
  diasMaximosParado: number | null;
}

export const SEM_LIMITES: Readonly<LimitesCaixa> = { capitalMaximo: null, diasMaximosParado: null };

export const ALERTA_CAIXA = "Pede mais caixa do que você definiu";

/** Sem custo informado, o capital é estimado como esta fração do valor estimado pelo órgão. */
export const FRACAO_CUSTO_ESTIMADA = 0.8;
/** Contrato mensal sem duração informada: um ano. */
export const MESES_CONTRATO_PADRAO = 12;
const MS_DIA = 24 * 3_600_000;

export type FonteCapital = "informado" | "estimado";

export interface CapitalNecessario {
  valor: number;
  fonte: FonteCapital;
}

function positivo(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

function naoNegativo(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

function dinheiro(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function textoDias(n: number): string {
  return `${n} ${n === 1 ? "dia" : "dias"}`;
}

/** Custo informado vale mais; sem ele, estima pelo valor do edital (fonte "estimado"); sem nada, null. */
export function capitalNecessario(custoTotal: number | null, valorBase: number | null): CapitalNecessario | null {
  if (positivo(custoTotal)) return { valor: custoTotal, fonte: "informado" };
  if (positivo(valorBase)) return { valor: valorBase * FRACAO_CUSTO_ESTIMADA, fonte: "estimado" };
  return null;
}

export interface AvaliacaoLimites {
  excedeCapital: boolean;
  excedeDias: boolean;
  /** Passou de algum limite */
  excede: boolean;
  /** Há limite definido e falta dado para comparar com ele */
  faltaDado: boolean;
  /** Frases curtas, uma por limite estourado */
  motivos: string[];
  /** ALERTA_CAIXA quando passou de algum limite; senão null */
  alerta: string | null;
}

/** Compara capital e dias parado com os limites do dono. Pagamento antecipado não conta como dinheiro parado. */
export function avaliarLimites(
  capital: CapitalNecessario | null,
  diasParado: number | null,
  pagamentoAntecipado: boolean | null,
  limites: LimitesCaixa,
): AvaliacaoLimites {
  const motivos: string[] = [];
  const temLimiteCapital = naoNegativo(limites.capitalMaximo);
  const temLimiteDias = naoNegativo(limites.diasMaximosParado);

  const excedeCapital = temLimiteCapital && capital !== null && capital.valor > (limites.capitalMaximo ?? 0);
  if (excedeCapital && capital !== null) {
    const prefixo = capital.fonte === "estimado" ? "Capital estimado de" : "Capital de";
    motivos.push(`${prefixo} ${dinheiro(capital.valor)} passa do máximo de ${dinheiro(limites.capitalMaximo ?? 0)}`);
  }

  const excedeDias =
    temLimiteDias && pagamentoAntecipado !== true && diasParado !== null && diasParado > (limites.diasMaximosParado ?? 0);
  if (excedeDias && diasParado !== null) {
    motivos.push(`${textoDias(diasParado)} parado passa do máximo de ${textoDias(limites.diasMaximosParado ?? 0)}`);
  }

  const faltaDado = (temLimiteCapital && capital === null) || (temLimiteDias && diasParado === null && pagamentoAntecipado !== true);
  const excede = excedeCapital || excedeDias;
  return { excedeCapital, excedeDias, excede, faltaDado, motivos, alerta: excede ? ALERTA_CAIXA : null };
}

export interface EntradaCaixa {
  /** Custo a pagar antes de receber (custo + frete + extras): da cotação ou digitado. Em contrato mensal, o de um ciclo. */
  custoTotal: number | null;
  prazoEntregaDias: number | null;
  prazoPagamentoDias: number | null;
  medicaoMensal: boolean | null;
  pagamentoAntecipado: boolean | null;
  /** Valor total estimado pelo órgão */
  valorContrato: number | null;
  /** Duração do contrato mensal; vazio usa 12 */
  mesesContrato: number | null;
  /** Dia em que o relógio começa a contar (hoje, ou a data prevista de início) */
  inicio: Date;
  limites: LimitesCaixa;
}

export interface ResultadoCaixa {
  capital: CapitalNecessario | null;
  /** Dias com dinheiro parado; null sem os dois prazos */
  diasParado: number | null;
  giro: CapitalGiro;
  /** ISO do dia provável de recebimento; null sem prazos */
  dataRecebimento: string | null;
  receitaMensal: boolean;
  mesesContrato: number;
  /** Só em receita mensal com valor do contrato */
  valorMensal: number | null;
  totalContrato: number | null;
  avaliacao: AvaliacaoLimites;
  /** O que falta para fechar a conta */
  faltando: Array<"custo" | "prazos">;
}

export function calcularCaixa(e: EntradaCaixa): ResultadoCaixa {
  const receitaMensal = e.medicaoMensal === true;
  const meses = positivo(e.mesesContrato) ? Math.round(e.mesesContrato) : MESES_CONTRATO_PADRAO;
  const totalContrato = positivo(e.valorContrato) ? e.valorContrato : null;
  const valorMensal = receitaMensal && totalContrato !== null ? totalContrato / meses : null;

  const giro = calcularCapitalGiro({
    prazoEntregaDias: e.prazoEntregaDias,
    prazoPagamentoDias: e.prazoPagamentoDias,
    medicaoMensal: e.medicaoMensal,
    pagamentoAntecipado: e.pagamentoAntecipado,
  });
  const diasParado = giro.dias;

  const baseEstimativa = receitaMensal ? valorMensal : totalContrato;
  const capital = capitalNecessario(e.custoTotal, baseEstimativa);

  const inicioMs = e.inicio.getTime();
  const dataRecebimento =
    diasParado !== null && Number.isFinite(inicioMs) ? new Date(inicioMs + diasParado * MS_DIA).toISOString() : null;

  const faltando: ResultadoCaixa["faltando"] = [];
  if (!positivo(e.custoTotal)) faltando.push("custo");
  if (diasParado === null) faltando.push("prazos");

  return {
    capital,
    diasParado,
    giro,
    dataRecebimento,
    receitaMensal,
    mesesContrato: meses,
    valorMensal,
    totalContrato,
    avaliacao: avaliarLimites(capital, diasParado, e.pagamentoAntecipado, e.limites),
    faltando,
  };
}
