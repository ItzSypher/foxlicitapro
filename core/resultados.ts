/**
 * Painel de resultados: agrega o pipeline, as propostas e as fichas de uma empresa.
 * Funções puras, sem banco; o relógio entra por parâmetro. Meses contados em America/Sao_Paulo.
 */
import { SEM_LIMITES, calcularCaixa } from "@/core/caixa";
import { diaDeSaoPaulo } from "@/core/avisos";

export const PERIODOS = [1, 3, 12] as const;
export type PeriodoResultados = (typeof PERIODOS)[number];

export const ROTULO_PERIODO: Record<PeriodoResultados, string> = {
  1: "Mês atual",
  3: "3 meses",
  12: "12 meses",
};

export function ehPeriodo(valor: unknown): valor is PeriodoResultados {
  return valor === 1 || valor === 3 || valor === 12;
}

const MS_DIA = 24 * 3_600_000;
const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;

/** Prazos da ficha do edital que entram na conta de caixa. */
export interface PrazosFicha {
  prazoEntregaDias: number | null;
  prazoPagamentoDias: number | null;
  medicaoMensal: boolean | null;
  pagamentoAntecipado: boolean | null;
}

export interface ItemResultado {
  id: string;
  etapa: string;
  /** ISO 8601: quando o item entrou na etapa em que está */
  etapaEm: string;
  valorEstimado: number | null;
  /** Total da proposta aprovada, pronta ou enviada, quando existe */
  valorProposto: number | null;
  ficha: PrazosFicha | null;
}

export interface EntradaResultados {
  agora: Date;
  periodo: PeriodoResultados;
  itens: ReadonlyArray<ItemResultado>;
  /** Entradas no histórico do pipeline em etapa posterior ao Radar (uma pessoa pode mover o mesmo item várias vezes) */
  movimentos: ReadonlyArray<{ itemId: string; em: string }>;
  /** Datas (ISO) em que as propostas enviadas ficaram nesse status */
  propostasEnviadasEm: ReadonlyArray<string>;
}

export interface MesResultado {
  /** AAAA-MM */
  mes: string;
  ganhas: number;
  valorGanho: number;
}

export interface Resultados {
  periodo: PeriodoResultados;
  analisadas: number;
  propostasEnviadas: number;
  ganhas: number;
  perdidas: number;
  /** 0 a 1; null sem nenhuma ganha ou perdida no período */
  taxaVitoria: number | null;
  valorGanho: number;
  /** Soma da parcela mensal das ganhas do período com medição mensal */
  receitaMensal: number;
  /** Capital de giro estimado de todas as ganhas ainda em andamento (posição de hoje) */
  capitalComprometido: number;
  ganhasEmAndamento: number;
  porMes: MesResultado[];
}

/** "2026-11" de uma data ISO, em São Paulo. */
export function mesDe(iso: string): string | null {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? null : diaDeSaoPaulo(data).slice(0, 7);
}

/** Os últimos `quantidade` meses (AAAA-MM), do mais antigo ao mês de `agora`. */
export function mesesDoPeriodo(agora: Date, quantidade: number): string[] {
  const atual = diaDeSaoPaulo(agora).slice(0, 7);
  const ano = Number(atual.slice(0, 4));
  const mes = Number(atual.slice(5, 7));
  const meses: string[] = [];
  for (let i = quantidade - 1; i >= 0; i--) {
    const indice = ano * 12 + (mes - 1) - i;
    const a = Math.floor(indice / 12);
    const m = (indice % 12) + 1;
    meses.push(`${a}-${String(m).padStart(2, "0")}`);
  }
  return meses;
}

/** "2026-03" vira "mar/26". */
export function rotuloMes(mes: string): string {
  const abrev = MESES_ABREV[Number(mes.slice(5, 7)) - 1] ?? mes.slice(5, 7);
  return `${abrev}/${mes.slice(2, 4)}`;
}

function valorDaGanha(i: ItemResultado): number {
  return i.valorProposto ?? i.valorEstimado ?? 0;
}

export function calcularResultados(e: EntradaResultados): Resultados {
  const meses = mesesDoPeriodo(e.agora, e.periodo);
  const noPeriodo = new Set(meses);
  const doPeriodo = (iso: string): boolean => {
    const m = mesDe(iso);
    return m !== null && noPeriodo.has(m);
  };

  const analisadas = new Set(e.movimentos.filter((m) => doPeriodo(m.em)).map((m) => m.itemId)).size;
  const propostasEnviadas = e.propostasEnviadasEm.filter(doPeriodo).length;

  const porMes = new Map<string, MesResultado>(meses.map((mes) => [mes, { mes, ganhas: 0, valorGanho: 0 }]));
  let ganhas = 0;
  let perdidas = 0;
  let valorGanho = 0;
  let receitaMensal = 0;
  let capitalComprometido = 0;
  let ganhasEmAndamento = 0;

  for (const i of e.itens) {
    if (i.etapa === "perdida") {
      if (doPeriodo(i.etapaEm)) perdidas += 1;
      continue;
    }
    if (i.etapa !== "ganha") continue;

    const valor = valorDaGanha(i);
    const inicio = new Date(i.etapaEm);
    const caixa = calcularCaixa({
      custoTotal: null,
      prazoEntregaDias: i.ficha?.prazoEntregaDias ?? null,
      prazoPagamentoDias: i.ficha?.prazoPagamentoDias ?? null,
      medicaoMensal: i.ficha?.medicaoMensal ?? null,
      pagamentoAntecipado: i.ficha?.pagamentoAntecipado ?? null,
      valorContrato: valor > 0 ? valor : null,
      mesesContrato: null,
      inicio: Number.isNaN(inicio.getTime()) ? e.agora : inicio,
      limites: SEM_LIMITES,
    });

    if (doPeriodo(i.etapaEm)) {
      ganhas += 1;
      valorGanho += valor;
      if (caixa.valorMensal !== null) receitaMensal += caixa.valorMensal;
      const mes = mesDe(i.etapaEm);
      const linha = mes === null ? undefined : porMes.get(mes);
      if (linha) {
        linha.ganhas += 1;
        linha.valorGanho += valor;
      }
    }

    // Em andamento: ainda não recebeu. Contrato mensal vale até o fim da duração, mais o prazo de pagamento do último ciclo.
    const inicioMs = inicio.getTime();
    const base = Number.isNaN(inicioMs) ? e.agora.getTime() : inicioMs;
    const fimMs = caixa.receitaMensal
      ? base + (caixa.mesesContrato * 30 + (caixa.diasParado ?? 0)) * MS_DIA
      : caixa.dataRecebimento === null
        ? null
        : Date.parse(caixa.dataRecebimento);
    const emAndamento = fimMs === null || fimMs > e.agora.getTime();
    if (emAndamento) {
      ganhasEmAndamento += 1;
      capitalComprometido += caixa.capital?.valor ?? 0;
    }
  }

  const decididas = ganhas + perdidas;
  return {
    periodo: e.periodo,
    analisadas,
    propostasEnviadas,
    ganhas,
    perdidas,
    taxaVitoria: decididas === 0 ? null : ganhas / decididas,
    valorGanho,
    receitaMensal,
    capitalComprometido,
    ganhasEmAndamento,
    porMes: meses.map((m) => porMes.get(m) ?? { mes: m, ganhas: 0, valorGanho: 0 }),
  };
}
