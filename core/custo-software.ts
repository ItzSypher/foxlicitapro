/**
 * Conta de site, sistema e software: mínimo mensal, hora técnica, teto para terceirizar o dev
 * e o repasse mês a mês (cliente paga → comissão → parcela do dev → o resto é do dono).
 * Funções puras, sem rede nem banco.
 */
import { normalizarTexto } from "./cnae-keywords";

/** Menor valor por mês que o dono aceita em desenvolvimento e manutenção. */
export const MINIMO_MENSAL_SOFTWARE = 3500;
/** Horas por mês que um contrato no mínimo consome. */
export const HORAS_POR_MES = 20;
/** Hora técnica que sai do mínimo: 3.500 ÷ 20 = R$ 175. */
export const VALOR_HORA = MINIMO_MENSAL_SOFTWARE / HORAS_POR_MES;
/** Parte do bruto que tem que sobrar para o dono depois da comissão e do dev, em %. */
export const MARGEM_MINIMA_DONO = 50;

const DESENVOLVIMENTO =
  /\b(sites?|sitio|website|portal|portais|sistemas?|software|softwares|aplicativos?|app|plataforma|desenvolvimento|redesign|landing page|pagina na internet|hospedagem)\b/;
const LICENCA = /\b(licenca|licencas|licenciamento|subscricao|subscricoes)\b/;

/** Objeto de criação ou manutenção de site, sistema ou software (licença de terceiro não conta). */
export function ehDesenvolvimento(objeto: string): boolean {
  const texto = normalizarTexto(objeto);
  return DESENVOLVIMENTO.test(texto) && !LICENCA.test(texto);
}

function arredondar(v: number): number {
  return Math.round(v * 100) / 100;
}

function positivo(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

/** Meses do contrato; sem prazo (entrega única) conta 1. */
export function mesesDoContrato(meses: number | null | undefined): number {
  return positivo(meses) ? Math.max(1, Math.round(meses)) : 1;
}

/** Mínimo do contrato: R$ 3.500 × meses. */
export function minimoDoContrato(meses: number | null | undefined): number {
  return MINIMO_MENSAL_SOFTWARE * mesesDoContrato(meses);
}

/** Até quanto pagar ao dev sem comer a margem mínima: bruto × (1 − comissão − 50%). */
export function tetoDoDev(bruto: number, comissaoPercentual: number): number {
  if (!positivo(bruto)) return 0;
  const fracao = 1 - Math.max(0, comissaoPercentual) / 100 - MARGEM_MINIMA_DONO / 100;
  return arredondar(Math.max(0, bruto * fracao));
}

export type VereditoSoftware = "vale" | "nao-vale" | "pendente";

export interface EntradaSoftware {
  /** Valor bruto do contrato (proposta ou estimado do edital) */
  bruto: number;
  /** Meses de contrato; null para entrega única */
  meses: number | null;
  /** Comissão sobre o bruto, em %; 0 sem comissão */
  comissaoPercentual: number;
  /** null enquanto ninguém respondeu "é terceirizável?" */
  terceirizavel: boolean | null;
  /** Total combinado com o dev; null sem cotação */
  devCusto: number | null;
  /** Valor estimado do edital, para saber quanto dá para baixar */
  valorReferencia?: number | null;
}

export interface ContaSoftware {
  meses: number;
  bruto: number;
  valorMensal: number;
  minimo: number;
  abaixoDoMinimo: boolean;
  /** Hora que o contrato paga: valor mensal ÷ 20 h */
  horaPaga: number;
  comissao: number;
  /** Teto do dev quando é terceirizável; null quando não é ou falta resposta */
  tetoDev: number | null;
  devCusto: number;
  /** Bruto menos comissão e dev */
  sobra: number;
  margemPercentual: number;
  /** Menor preço aceitável: o mínimo mensal ou o que mantém a margem com o dev informado */
  precoMinimo: number;
  /** Quanto dá para baixar do valor de referência até o preço mínimo; null sem referência */
  folga: number | null;
  folgaPercentual: number | null;
  veredito: VereditoSoftware;
  /** Frase curta do porquê */
  motivo: string;
}

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** A conta de software completa; null sem valor para calcular. */
export function contaSoftware(e: EntradaSoftware): ContaSoftware | null {
  if (!positivo(e.bruto)) return null;
  const meses = mesesDoContrato(e.meses);
  const bruto = arredondar(e.bruto);
  const valorMensal = arredondar(bruto / meses);
  const minimo = minimoDoContrato(e.meses);
  const abaixoDoMinimo = valorMensal + 0.005 < MINIMO_MENSAL_SOFTWARE;
  const c = Math.max(0, e.comissaoPercentual);
  const comissao = arredondar((bruto * c) / 100);
  const tetoDev = e.terceirizavel === true ? tetoDoDev(bruto, c) : null;
  const devCusto = e.terceirizavel === true && positivo(e.devCusto) ? arredondar(e.devCusto) : 0;
  const sobra = arredondar(bruto - comissao - devCusto);
  const margemPercentual = Math.round((sobra / bruto) * 1000) / 10;
  const fracaoLivre = 1 - c / 100 - MARGEM_MINIMA_DONO / 100;
  const pelaMargem = devCusto > 0 && fracaoLivre > 0 ? arredondar(devCusto / fracaoLivre) : 0;
  const precoMinimo = Math.max(minimo, pelaMargem);
  const referencia = positivo(e.valorReferencia) ? e.valorReferencia : null;
  const folga = referencia === null ? null : arredondar(referencia - precoMinimo);
  const folgaPercentual = referencia === null || folga === null ? null : Math.round((folga / referencia) * 1000) / 10;

  let veredito: VereditoSoftware;
  let motivo: string;
  if (abaixoDoMinimo) {
    veredito = "nao-vale";
    motivo = `Paga ${moeda.format(valorMensal)}/mês, abaixo do mínimo de ${moeda.format(MINIMO_MENSAL_SOFTWARE)}`;
  } else if (e.terceirizavel === null) {
    veredito = "pendente";
    motivo = "Responda se é terceirizável";
  } else if (e.terceirizavel && devCusto === 0) {
    veredito = "pendente";
    motivo = `Cote o dev: até ${moeda.format(tetoDev ?? 0)}`;
  } else if (tetoDev !== null && devCusto > tetoDev + 0.005) {
    veredito = "nao-vale";
    motivo = `Dev de ${moeda.format(devCusto)} passa do teto de ${moeda.format(tetoDev)}`;
  } else {
    veredito = "vale";
    motivo = `Sobra ${moeda.format(sobra)} (${margemPercentual.toLocaleString("pt-BR")}%)`;
  }

  return {
    meses,
    bruto,
    valorMensal,
    minimo,
    abaixoDoMinimo,
    horaPaga: arredondar(valorMensal / HORAS_POR_MES),
    comissao,
    tetoDev,
    devCusto,
    sobra,
    margemPercentual,
    precoMinimo,
    folga,
    folgaPercentual,
    veredito,
    motivo,
  };
}

export interface MesRepasse {
  /** 1 = primeiro mês de pagamento */
  mes: number;
  recebe: number;
  comissao: number;
  dev: number;
  dono: number;
}

/**
 * Repasse mês a mês: a cada pagamento do cliente sai a comissão, depois a parcela do dev
 * (o que não couber passa para o mês seguinte) e o resto fica com o dono.
 */
export function cronogramaRepasse(
  bruto: number,
  meses: number | null,
  comissaoPercentual: number,
  devCusto: number | null,
  devParcelas: number | null,
): MesRepasse[] {
  if (!positivo(bruto)) return [];
  const n = mesesDoContrato(meses);
  const c = Math.max(0, comissaoPercentual) / 100;
  const totalDev = positivo(devCusto) ? devCusto : 0;
  // Mais parcelas que meses de contrato: o dev é quitado até o último pagamento do cliente.
  const parcelas = positivo(devParcelas) ? Math.min(n, Math.max(1, Math.round(devParcelas))) : 1;
  const parcela = totalDev / parcelas;
  const linhas: MesRepasse[] = [];
  let devDevido = 0;
  let devRestante = totalDev;
  let recebido = 0;
  for (let i = 1; i <= n; i += 1) {
    // O último mês leva o centavo que sobrou da divisão.
    const recebe = i === n ? arredondar(bruto - recebido) : arredondar(bruto / n);
    recebido = arredondar(recebido + recebe);
    const comissao = arredondar(recebe * c);
    const disponivel = recebe - comissao;
    if (i <= parcelas) devDevido += parcela;
    const dev = arredondar(Math.min(devDevido, devRestante, disponivel));
    devDevido -= dev;
    devRestante -= dev;
    linhas.push({ mes: i, recebe, comissao, dev, dono: arredondar(disponivel - dev) });
  }
  return linhas;
}

const MESES_NO_TEXTO = /\b(\d{1,3})\s*\(?[a-z ]*\)?\s*meses\b/;
const DOZE_MESES = /\bdoze meses\b/;
const CONTINUO = /\b(continuad[oa]s?|continuos?|manutencao|suporte|hospedagem|mensal|mensais|locacao|licenciamento de uso)\b/;

/**
 * Meses de contrato que o objeto sugere quando ninguém informou: "12 meses" escrito no texto,
 * ou 12 para serviço contínuo (manutenção, suporte, hospedagem); null para entrega única.
 */
export function mesesSugeridos(objeto: string, natureza?: string | null): number | null {
  const texto = normalizarTexto(objeto);
  const m = MESES_NO_TEXTO.exec(texto);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 120) return n;
  }
  if (DOZE_MESES.test(texto)) return 12;
  if (natureza === "servico-continuo" || CONTINUO.test(texto)) return 12;
  return null;
}
