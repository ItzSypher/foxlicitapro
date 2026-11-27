/**
 * Fluxo de caixa das licitações ganhas: quanto entra, quando entra e o que sai (custo e comissão).
 * Funções puras, sem rede nem banco. As datas são "AAAA-MM-DD" (dia civil), nunca instantes,
 * para o mês não mudar com o fuso.
 */
import { cronogramaRepasse } from "./custo-software";
import { comissaoDoItem, contaLucro } from "./lucro";

/** Sem ficha do edital: 30 dias para entregar e 30 para o órgão pagar. */
export const DIAS_ENTREGA_PADRAO = 30;
export const DIAS_PAGAMENTO_PADRAO = 30;

export type StatusCaixa = "recebido" | "atrasado" | "a-receber";

export const ROTULO_STATUS_CAIXA: Record<StatusCaixa, string> = {
  recebido: "Recebido",
  atrasado: "Atrasado",
  "a-receber": "A receber",
};

/** O que a função precisa de uma licitação ganha; o banco monta isto em db/fluxo-caixa.ts. */
export interface GanhoParaCaixa {
  id: string;
  objeto: string;
  orgao: string;
  valorEstimado: number | null;
  /** Total da proposta aprovada, pronta ou enviada */
  valorProposto: number | null;
  valorHomologado: number | null;
  valorRecebido: number | null;
  /** Custo informado pelo dono; null para estimar pelo tipo do objeto */
  custoReal: number | null;
  /** Comissão marcada nesta licitação; null é sem comissão */
  comissaoAjuste: number | null;
  /** Data que o dono combinou ou previu para o pagamento */
  pagamentoPrevisto: string | null;
  recebidoEm: string | null;
  /** Dia em que a licitação foi para Ganha */
  ganhoEm: string | null;
  prazoEntregaDias: number | null;
  prazoPagamentoDias: number | null;
  frente: "servicos" | "produtos" | null;
  /** Total combinado com o dev e em quantas parcelas ele recebe (site, sistema e software terceirizados) */
  devCusto?: number | null;
  devParcelas?: number | null;
  /** Meses de contrato; null é entrega única */
  contratoMeses?: number | null;
  terceirizavel?: boolean | null;
}

export interface ItemCaixa {
  id: string;
  objeto: string;
  orgao: string;
  status: StatusCaixa;
  /** Valor que entra: recebido, homologado, proposta ou estimado, nesta ordem */
  valor: number;
  /** De onde veio o valor, para a tela avisar quando é só uma estimativa */
  origemValor: "recebido" | "homologado" | "proposta" | "estimado" | "nenhuma";
  /** Data prevista de entrada (ou a data em que entrou, quando já recebido) */
  dataPrevista: string;
  /** true quando a data veio do prazo do edital e não de uma data combinada */
  dataEstimada: boolean;
  recebidoEm: string | null;
  custo: number;
  custoEstimado: boolean;
  comissaoPercentual: number;
  /** true quando há comissão marcada nesta licitação */
  comissaoAjustada: boolean;
  comissao: number;
  /** Parcela do dev neste item (0 sem dev); já está no custo */
  dev: number;
  /** Mês do contrato quando o recebimento é dividido; null quando entra de uma vez */
  parcela: { numero: number; total: number } | null;
  /** Valor menos custo e comissão */
  resultado: number;
  /** Dias de atraso; 0 quando não está atrasado */
  diasAtraso: number;
}

export interface MesCaixa {
  /** "AAAA-MM" */
  mes: string;
  aReceber: number;
  recebido: number;
  custo: number;
  comissao: number;
  /** Recebido mais a receber, menos custo e comissão */
  saldo: number;
  itens: ItemCaixa[];
}

export interface ResumoCaixa {
  aReceber: number;
  atrasado: number;
  /** Recebido no mês de `hoje` */
  recebidoNoMes: number;
  /** Tudo que entra (recebido e a receber) menos custo e comissão */
  saldo: number;
}

export interface FluxoCaixa {
  meses: MesCaixa[];
  resumo: ResumoCaixa;
}

function arredondar(v: number): number {
  return Math.round(v * 100) / 100;
}

function positivo(v: number | null): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

function diasValidos(v: number | null, padrao: number): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : padrao;
}

const FORMATO_DIA = /^(\d{4})-(\d{2})-(\d{2})/;

/** Dia civil em milissegundos UTC; null para texto que não é data. */
function emMs(dia: string): number | null {
  const m = FORMATO_DIA.exec(dia);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(ms) ? null : ms;
}

const MS_DIA = 86_400_000;

/** Soma dias a um "AAAA-MM-DD". */
export function somarDias(dia: string, dias: number): string {
  const base = emMs(dia);
  if (base === null) return dia;
  return new Date(base + dias * MS_DIA).toISOString().slice(0, 10);
}

/** Soma meses a um "AAAA-MM-DD", mantendo o dia (ou o último dia do mês, se não existir). */
export function somarMeses(dia: string, meses: number): string {
  const m = FORMATO_DIA.exec(dia);
  if (!m || emMs(dia) === null) return dia;
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + meses;
  const ano = Math.floor(total / 12);
  const mes = total % 12;
  const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes, Math.min(Number(m[3]), ultimo))).toISOString().slice(0, 10);
}

/** Dias entre duas datas (b − a); 0 se alguma for inválida. */
export function diasEntre(a: string, b: string): number {
  const x = emMs(a);
  const y = emMs(b);
  if (x === null || y === null) return 0;
  return Math.round((y - x) / MS_DIA);
}

/** Número digitado à brasileira ("1.234,56", "R$ 900", "12,5") ou à americana ("1234.56"); null se não for número. */
export function lerValorDigitado(texto: string): number | null {
  const limpo = texto.replace(/R\$|\s/g, "");
  if (limpo === "" || !/^\d[\d.,]*$/.test(limpo)) return null;
  const normal = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(limpo)
      ? limpo.replace(/\./g, "")
      : limpo;
  const n = Number(normal);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Valor que a empresa recebe ou deve receber, e de onde ele veio. */
export function valorDoGanho(g: GanhoParaCaixa): { valor: number; origem: ItemCaixa["origemValor"] } {
  if (positivo(g.valorRecebido)) return { valor: g.valorRecebido, origem: "recebido" };
  if (positivo(g.valorHomologado)) return { valor: g.valorHomologado, origem: "homologado" };
  if (positivo(g.valorProposto)) return { valor: g.valorProposto, origem: "proposta" };
  if (positivo(g.valorEstimado)) return { valor: g.valorEstimado, origem: "estimado" };
  return { valor: 0, origem: "nenhuma" };
}

/** Data prevista: a combinada ou, sem ela, vitória + entrega + pagamento do edital (sem ficha, 30 + 30 dias). */
export function dataPrevistaDoGanho(g: GanhoParaCaixa, hoje: string): { data: string; estimada: boolean } {
  if (g.pagamentoPrevisto !== null && emMs(g.pagamentoPrevisto) !== null) {
    return { data: g.pagamentoPrevisto.slice(0, 10), estimada: false };
  }
  const base = g.ganhoEm !== null && emMs(g.ganhoEm) !== null ? g.ganhoEm.slice(0, 10) : hoje;
  const dias = diasValidos(g.prazoEntregaDias, DIAS_ENTREGA_PADRAO) + diasValidos(g.prazoPagamentoDias, DIAS_PAGAMENTO_PADRAO);
  return { data: somarDias(base, dias), estimada: true };
}

/** Ganho com dev terceirizado e custo informado: o recebimento se divide pelo cronograma do contrato. */
function temDev(g: GanhoParaCaixa): g is GanhoParaCaixa & { devCusto: number } {
  return g.terceirizavel === true && positivo(g.devCusto ?? null);
}

/** Um item do caixa: valor, data, status, custo e comissão. */
export function itemDoCaixa(g: GanhoParaCaixa, hoje: string): ItemCaixa {
  const { valor, origem } = valorDoGanho(g);
  const recebido = g.recebidoEm !== null && emMs(g.recebidoEm) !== null;
  const prevista = dataPrevistaDoGanho(g, hoje);
  const dataPrevista = recebido ? (g.recebidoEm as string).slice(0, 10) : prevista.data;
  const comissaoPercentual = comissaoDoItem(g.comissaoAjuste);
  const dev = temDev(g) ? g.devCusto : 0;

  const conta = contaLucro({
    receita: valor,
    custo: g.custoReal ?? (dev > 0 ? dev : null),
    comissaoPercentual,
    oportunidade: { objeto: g.objeto, valorEstimado: g.valorEstimado, score: { frenteCasada: g.frente } },
  });
  const custo = conta?.custo ?? 0;
  const comissao = conta?.comissao ?? 0;

  const atrasoDias = recebido ? 0 : diasEntre(dataPrevista, hoje);
  const status: StatusCaixa = recebido ? "recebido" : atrasoDias > 0 ? "atrasado" : "a-receber";

  return {
    id: g.id,
    objeto: g.objeto,
    orgao: g.orgao,
    status,
    valor: arredondar(valor),
    origemValor: origem,
    dataPrevista,
    dataEstimada: !recebido && prevista.estimada,
    recebidoEm: recebido ? dataPrevista : null,
    custo,
    custoEstimado: conta?.custoEstimado ?? false,
    comissaoPercentual,
    comissaoAjustada: g.comissaoAjuste !== null,
    comissao,
    dev: g.custoReal === null ? dev : 0,
    parcela: null,
    resultado: arredondar(valor - custo - comissao),
    diasAtraso: Math.max(0, atrasoDias),
  };
}

/**
 * Os itens do caixa de um ganho. Com dev terceirizado ainda não recebido, o valor entra mês a mês
 * (cronograma do contrato: comissão, parcela do dev e o que fica com o dono); senão é um item só.
 */
export function itensDoCaixa(g: GanhoParaCaixa, hoje: string): ItemCaixa[] {
  const base = itemDoCaixa(g, hoje);
  if (base.status === "recebido" || !temDev(g) || base.valor <= 0) return [base];
  const linhas = cronogramaRepasse(base.valor, g.contratoMeses ?? null, base.comissaoPercentual, g.devCusto, g.devParcelas ?? null);
  if (linhas.length === 0) return [base];
  return linhas.map((l) => {
    const dataPrevista = somarMeses(base.dataPrevista, l.mes - 1);
    const atraso = Math.max(0, diasEntre(dataPrevista, hoje));
    return {
      ...base,
      status: atraso > 0 ? ("atrasado" as const) : ("a-receber" as const),
      valor: l.recebe,
      dataPrevista,
      custo: l.dev,
      custoEstimado: false,
      comissao: l.comissao,
      dev: l.dev,
      parcela: linhas.length > 1 ? { numero: l.mes, total: linhas.length } : null,
      resultado: l.dono,
      diasAtraso: atraso,
    };
  });
}

/**
 * Agrupa as licitações ganhas por mês (o da entrada prevista ou o do recebimento) e soma
 * o que falta receber, o que já entrou, o custo, a comissão e o saldo.
 * `hoje` é o dia civil de agora, "AAAA-MM-DD".
 */
export function montarFluxoCaixa(ganhos: readonly GanhoParaCaixa[], hoje: string): FluxoCaixa {
  const itens = ganhos.flatMap((g) => itensDoCaixa(g, hoje));
  itens.sort((a, b) => (a.dataPrevista < b.dataPrevista ? -1 : a.dataPrevista > b.dataPrevista ? 1 : a.id.localeCompare(b.id) || (a.parcela?.numero ?? 0) - (b.parcela?.numero ?? 0)));

  const porMes = new Map<string, MesCaixa>();
  for (const i of itens) {
    const chave = i.dataPrevista.slice(0, 7);
    let mes = porMes.get(chave);
    if (!mes) {
      mes = { mes: chave, aReceber: 0, recebido: 0, custo: 0, comissao: 0, saldo: 0, itens: [] };
      porMes.set(chave, mes);
    }
    if (i.status === "recebido") mes.recebido += i.valor;
    else mes.aReceber += i.valor;
    mes.custo += i.custo;
    mes.comissao += i.comissao;
    mes.saldo += i.resultado;
    mes.itens.push(i);
  }

  const meses = [...porMes.values()]
    .sort((a, b) => (a.mes < b.mes ? -1 : 1))
    .map((m) => ({
      ...m,
      aReceber: arredondar(m.aReceber),
      recebido: arredondar(m.recebido),
      custo: arredondar(m.custo),
      comissao: arredondar(m.comissao),
      saldo: arredondar(m.saldo),
    }));

  const mesAtual = hoje.slice(0, 7);
  let aReceber = 0;
  let atrasado = 0;
  let recebidoNoMes = 0;
  let saldo = 0;
  for (const i of itens) {
    saldo += i.resultado;
    if (i.status === "recebido") {
      if (i.dataPrevista.slice(0, 7) === mesAtual) recebidoNoMes += i.valor;
      continue;
    }
    aReceber += i.valor;
    if (i.status === "atrasado") atrasado += i.valor;
  }

  return {
    meses,
    resumo: {
      aReceber: arredondar(aReceber),
      atrasado: arredondar(atrasado),
      recebidoNoMes: arredondar(recebidoNoMes),
      saldo: arredondar(saldo),
    },
  };
}
