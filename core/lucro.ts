/**
 * Lucro × prejuízo de uma licitação: receita bruta menos custo e comissão de quem opera.
 * Sem fornecedor cotado, o custo é estimado pelo tipo do objeto (mesma regra do caixa).
 * Funções puras, sem rede nem banco.
 */
import { FRACAO_CUSTO_ESTIMADA } from "./caixa";
import { FRACAO_CUSTO_SERVICO, tipoDoObjeto, type OportunidadeCaixa } from "./caminho-dinheiro";

/** Comissão padrão sobre o bruto quando a empresa não definiu outra. */
export const COMISSAO_PADRAO = 12;
export const COMISSAO_MINIMA = 0;
export const COMISSAO_MAXIMA = 30;

export type SituacaoLucro = "lucro" | "empate" | "prejuizo";

export interface EntradaLucro {
  /** Valor bruto que a empresa recebe (preço da proposta, homologado ou estimado) */
  receita: number;
  /** Custo conhecido (cotação ou custo real); null para estimar */
  custo: number | null;
  /** Percentual da comissão sobre o bruto */
  comissaoPercentual: number;
  /** Para estimar o custo quando não há custo conhecido */
  oportunidade?: OportunidadeCaixa;
}

export interface ContaLucro {
  receita: number;
  custo: number;
  /** true quando o custo veio da estimativa pelo tipo do objeto */
  custoEstimado: boolean;
  comissaoPercentual: number;
  comissao: number;
  /** Receita menos custo e comissão; negativo é prejuízo */
  resultado: number;
  /** Resultado sobre a receita, em % */
  margemPercentual: number;
  situacao: SituacaoLucro;
  /** Menor preço que ainda não dá prejuízo, com o mesmo custo e a mesma comissão */
  precoMinimo: number;
}

function arredondar(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Comissão dentro da faixa permitida; valor inválido vira o padrão. */
export function normalizarComissao(valor: number | null | undefined, padrao: number = COMISSAO_PADRAO): number {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return padrao;
  return Math.min(Math.max(valor, COMISSAO_MINIMA), COMISSAO_MAXIMA);
}

/** Comissão que vale para um item: o ajuste dele ou, sem ajuste, o padrão da empresa. */
export function comissaoDoItem(ajuste: number | null | undefined, padraoEmpresa: number | null | undefined): number {
  const padrao = normalizarComissao(padraoEmpresa);
  return ajuste === null || ajuste === undefined ? padrao : normalizarComissao(ajuste, padrao);
}

/**
 * Custo estimado pelo tipo do objeto: produto ~80% do valor (compra da mercadoria),
 * serviço presencial ~10% (deslocamento e mão de obra), serviço à distância 0 (o trabalho é da própria empresa).
 */
export function custoEstimado(o: OportunidadeCaixa, receita: number): number {
  if (!(receita > 0)) return 0;
  const tipo = tipoDoObjeto(o);
  if (tipo === "servico-remoto") return 0;
  return arredondar(receita * (tipo === "produto" ? FRACAO_CUSTO_ESTIMADA : FRACAO_CUSTO_SERVICO));
}

/** Menor preço sem prejuízo: custo / (1 − comissão). */
export function precoMinimoSemPrejuizo(custo: number, comissaoPercentual: number): number {
  const fracao = normalizarComissao(comissaoPercentual) / 100;
  return arredondar(Math.max(0, custo) / (1 - fracao));
}

/** A conta completa; null quando não há receita para calcular. */
export function contaLucro(e: EntradaLucro): ContaLucro | null {
  if (!Number.isFinite(e.receita) || e.receita <= 0) return null;
  const receita = arredondar(e.receita);
  const comissaoPercentual = normalizarComissao(e.comissaoPercentual);
  const temCusto = typeof e.custo === "number" && Number.isFinite(e.custo) && e.custo >= 0;
  const custo = temCusto ? arredondar(e.custo as number) : e.oportunidade ? custoEstimado(e.oportunidade, receita) : 0;
  const comissao = arredondar((receita * comissaoPercentual) / 100);
  const resultado = arredondar(receita - custo - comissao);
  const margemPercentual = Math.round((resultado / receita) * 1000) / 10;
  const situacao: SituacaoLucro = resultado > 0.005 ? "lucro" : resultado < -0.005 ? "prejuizo" : "empate";
  return {
    receita,
    custo,
    custoEstimado: !temCusto,
    comissaoPercentual,
    comissao,
    resultado,
    margemPercentual,
    situacao,
    precoMinimo: precoMinimoSemPrejuizo(custo, comissaoPercentual),
  };
}
