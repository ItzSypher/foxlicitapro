/**
 * Preço sugerido de um item do pipeline, calculado só com regras (sem IA):
 * custo vem das cotações de fornecedor, imposto e regime vêm da calculadora (core/precificacao),
 * margem alvo vem do CNAE (core/margens) e o teto vem do estimado do edital menos o desconto
 * médio dos concorrentes já gravados (core/concorrentes). Funções puras, sem rede nem banco.
 */
import { montarResultado, type AmostraConcorrente, type EstatisticasConcorrentes } from "./concorrentes";
import { margemEmPercentual, type ResumoCotacoes } from "./cotacoes-resumo";
import { sugerirPrecos, type PrecoFornecedor, type SugestaoPreco } from "./fornecedores";
import { MARGENS_POR_CNAE, type MargemSugerida } from "./margens";
import { calcularPrecificacao, VENDAS_PREVISTAS_PADRAO, type Regime } from "./precificacao";
import type { Porte } from "./perfil";
import type { Frente } from "./types";

export type VereditoPreco = "vale" | "apertado" | "nao-vale" | "sem-custo";
export type ConfiancaPreco = "alta" | "media" | "baixa";

export const ROTULO_VEREDITO: Record<VereditoPreco, string> = {
  vale: "Vale a pena",
  apertado: "Apertado",
  "nao-vale": "Não vale",
  "sem-custo": "Sem custo",
};

export const ROTULO_CONFIANCA: Record<ConfiancaPreco, string> = {
  alta: "Confiança alta",
  media: "Confiança média",
  baixa: "Confiança baixa",
};

/** Concorrentes só entram no teto com pelo menos 1 amostra que tenha estimado e homologado; 3 ou mais dão confiança. */
export const AMOSTRAS_PARA_CONFIANCA = 3;

export interface EntradaPrecoSugerido {
  /** Valor estimado do edital em reais; null quando o órgão não informa ou é sigiloso */
  valorEstimado: number | null;
  /** Frente do objeto (score.frenteCasada); null sem match: vale a frente das cotações */
  frente: Frente | null;
  /** CNAEs que casaram com o objeto (score.cnaesCasados); o primeiro com margem conhecida define a margem alvo */
  cnaes: readonly string[];
  /** Porte da empresa (perfil.porte): "mei" usa o DAS do MEI, os demais usam o Simples */
  porte: Porte;
  /** Cotações ligadas ao item; null sem nenhuma (veredito "sem-custo") */
  cotacoes: ResumoCotacoes | null;
  /** Estatísticas de contratações parecidas já gravadas; null sem amostras. Nunca vem de busca ao vivo. */
  concorrentes: EstatisticasConcorrentes | null;
  /** Preço de fornecedor parecido já cadastrado; só orienta o que falta, não entra no custo (é preço unitário) */
  precoFornecedor: SugestaoPreco | null;
}

export interface PrecoSugerido {
  veredito: VereditoPreco;
  /** Custo mais impostos, margem zero, em reais; null sem custo */
  piso: number | null;
  /** Custo com a margem alvo mais impostos, em reais; null sem custo */
  alvo: number | null;
  /** Valor provável de vitória: estimado menos o desconto médio dos concorrentes (nunca acima do estimado); sem amostras, o estimado; null sem estimado */
  teto: number | null;
  /** Preço a mostrar: o alvo quando vale; o teto quando apertado; o piso quando não vale; null sem custo */
  sugerido: number | null;
  /** Margem alvo em pontos percentuais inteiros (0,18 vira 18); null sem margem conhecida */
  margemAlvoPct: number | null;
  /** Margem líquida no preço sugerido em pontos percentuais, 1 casa decimal; null sem custo */
  margemSugeridaPct: number | null;
  /** Preço alvo menos custo total e impostos, em reais; null sem custo */
  lucroNoAlvo: number | null;
  /** Soma dos custos cotados mais o rateio do DAS no MEI, em reais; null sem custo */
  custoTotal: number | null;
  regime: Regime;
  confianca: ConfiancaPreco;
  /** O que entrou no cálculo, em frases curtas */
  fontes: string[];
  /** O que falta para melhorar o cálculo, em frases curtas */
  faltando: string[];
}

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function brl(valor: number): string {
  return moeda.format(valor);
}

/** Centavos, como o resto do projeto (core/cotacoes-resumo). */
function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function umaCasa(valor: number): number {
  const r = Math.round(valor * 10) / 10;
  return r === 0 ? 0 : r;
}

function margemDoCnae(cnaes: readonly string[]): { cnae: string; margem: MargemSugerida } | null {
  for (const cnae of cnaes) {
    const achada = Object.entries(MARGENS_POR_CNAE).find(([codigo]) => codigo === cnae);
    if (achada) return { cnae, margem: achada[1] };
  }
  return null;
}

/** Custo total cotado: soma, por item cotado, da média do custo (com frete e extras); a frente que mais pesa define o imposto. */
function custoDasCotacoes(cotacoes: ResumoCotacoes, frenteDoItem: Frente | null): { custo: number; frente: Frente; itens: number } {
  let custo = 0;
  let itens = 0;
  let frente: Frente = frenteDoItem ?? "produtos";
  let maior = -1;
  for (const grupo of cotacoes.frentes) {
    const doGrupo = grupo.listas.reduce((soma, l) => soma + l.custoTotal.media, 0);
    custo += doGrupo;
    itens += grupo.listas.length;
    if (frenteDoItem === null && doGrupo > maior) {
      maior = doGrupo;
      frente = grupo.frente;
    }
  }
  return { custo, frente, itens };
}

function semCusto(entrada: EntradaPrecoSugerido, regime: Regime, margemAlvoPct: number | null, extra: string[]): PrecoSugerido {
  const faltando = ["Cote ao menos 1 fornecedor"];
  if (entrada.precoFornecedor) {
    const p = entrada.precoFornecedor.menor;
    faltando.push(
      `Há preço de fornecedor parecido (${brl(p.preco)} em ${p.fornecedorNome}), mas é unitário: cote com a quantidade do edital`,
    );
  }
  faltando.push(...extra);
  if (entrada.valorEstimado === null) faltando.push("O edital não informa valor estimado");
  return {
    veredito: "sem-custo",
    piso: null,
    alvo: null,
    teto: entrada.valorEstimado !== null && entrada.valorEstimado > 0 ? arredondar(entrada.valorEstimado) : null,
    sugerido: null,
    margemAlvoPct,
    margemSugeridaPct: null,
    lucroNoAlvo: null,
    custoTotal: null,
    regime,
    confianca: "baixa",
    fontes: entrada.valorEstimado !== null && entrada.valorEstimado > 0 ? [`Valor estimado do edital: ${brl(entrada.valorEstimado)}`] : [],
    faltando,
  };
}

/**
 * Regras do veredito, com valores já em centavos:
 * sem custo: "sem-custo"; sem teto: "vale" (não há limite a respeitar, como na calculadora);
 * piso acima do teto: "nao-vale"; alvo até o teto: "vale"; entre piso e alvo: "apertado".
 */
export function vereditoDoPreco(piso: number, alvo: number, teto: number | null): Exclude<VereditoPreco, "sem-custo"> {
  if (teto === null) return "vale";
  if (piso > teto) return "nao-vale";
  if (alvo <= teto) return "vale";
  return "apertado";
}

export function calcularPrecoSugerido(entrada: EntradaPrecoSugerido): PrecoSugerido {
  const regime: Regime = entrada.porte === "mei" ? "mei" : "simples";
  const doCnae = margemDoCnae(entrada.cnaes);
  const margemCnae = doCnae?.margem.alvo ?? null;

  const cotacoes = entrada.cotacoes;
  if (cotacoes === null) return semCusto(entrada, regime, margemCnae === null ? null : margemEmPercentual(margemCnae), []);

  const { custo, frente, itens } = custoDasCotacoes(cotacoes, entrada.frente);
  if (!(custo > 0)) {
    return semCusto(entrada, regime, margemCnae === null ? null : margemEmPercentual(margemCnae), [
      "As cotações estão com custo zero: informe o custo do fornecedor",
    ]);
  }

  const margemAlvo = margemCnae ?? cotacoes.ultima.margem;
  const resultado = calcularPrecificacao({
    custo,
    frete: 0,
    extras: 0,
    tetoOrgao: null,
    margemMinima: 0,
    margemAlvo,
    regime,
    tipo: frente,
  });
  if (!resultado.ok) {
    return semCusto(entrada, regime, margemEmPercentual(margemAlvo), resultado.erros.map((e) => e.mensagem));
  }
  const calculo = resultado.calculo;

  const piso = arredondar(calculo.precoMinimo.preco);
  const alvo = arredondar(calculo.precoAlvo.preco);
  const lucroNoAlvo = arredondar(calculo.precoAlvo.lucroLiquido);
  const custoTotal = arredondar(calculo.custoTotal);

  const estimado = entrada.valorEstimado !== null && entrada.valorEstimado > 0 ? entrada.valorEstimado : null;
  const conc = entrada.concorrentes;
  const comMercado =
    estimado !== null && conc !== null && conc.descontoMedioPct !== null && conc.amostrasComDesconto > 0 ? conc : null;
  let teto: number | null = null;
  let tetoPorMercado = false;
  if (estimado !== null) {
    teto = arredondar(estimado);
    if (comMercado && comMercado.descontoMedioPct !== null) {
      const provavel = arredondar(estimado * (1 - comMercado.descontoMedioPct / 100));
      if (provavel > 0 && provavel < teto) {
        teto = provavel;
        tetoPorMercado = true;
      }
    }
  }

  const veredito = vereditoDoPreco(piso, alvo, teto);
  const sugerido = veredito === "vale" ? alvo : veredito === "apertado" && teto !== null ? teto : piso;
  const lucroSugerido = sugerido - calculo.custoTotal - sugerido * calculo.aliquota;
  const margemSugeridaPct = umaCasa((lucroSugerido / sugerido) * 100);

  const fontes: string[] = [];
  fontes.push(
    `Custo: ${itens} ${itens === 1 ? "item cotado" : "itens cotados"} em ${cotacoes.quantidade} ${cotacoes.quantidade === 1 ? "cotação" : "cotações"}, ${brl(arredondar(custo))} na média`,
  );
  if (regime === "mei") {
    fontes.push(
      `Imposto: MEI, DAS de ${brl(arredondar(calculo.dasMensal ?? 0))} no mês rateado em ${VENDAS_PREVISTAS_PADRAO} vendas (${brl(arredondar(calculo.rateioDas))} por venda)`,
    );
  } else {
    fontes.push(
      `Imposto: Simples Nacional, ${numero.format(calculo.aliquota * 100)}% sobre o preço (${frente === "produtos" ? "Anexo I" : "Anexo III"})`,
    );
  }
  fontes.push(
    doCnae
      ? `Margem alvo: ${margemEmPercentual(margemAlvo)}% (CNAE ${doCnae.cnae})`
      : `Margem alvo: ${margemEmPercentual(margemAlvo)}% (da última cotação)`,
  );
  if (estimado !== null) fontes.push(`Valor estimado do edital: ${brl(estimado)}`);
  if (tetoPorMercado && comMercado && comMercado.descontoMedioPct !== null) {
    fontes.push(
      `Concorrentes: ${comMercado.amostrasComDesconto} ${comMercado.amostrasComDesconto === 1 ? "contratação parecida" : "contratações parecidas"}, desconto médio de ${numero.format(comMercado.descontoMedioPct)}%`,
    );
  } else if (comMercado && comMercado.descontoMedioPct !== null) {
    fontes.push(
      `Concorrentes: ${comMercado.amostrasComDesconto} ${comMercado.amostrasComDesconto === 1 ? "contratação parecida" : "contratações parecidas"} sem desconto sobre o estimado`,
    );
  }

  const faltando: string[] = [];
  if (cotacoes.quantidade < 2) faltando.push("Cote um segundo fornecedor para comparar o custo");
  if (estimado === null) faltando.push("O edital não informa valor estimado: não dá para comparar com o teto");
  if (comMercado === null) {
    faltando.push("Busque contratações parecidas (concorrentes) para estimar o desconto de mercado");
  } else if (comMercado.amostrasComDesconto < AMOSTRAS_PARA_CONFIANCA) {
    faltando.push(`Poucas contratações parecidas (${comMercado.amostrasComDesconto}): o desconto de mercado é incerto`);
  }
  if (doCnae === null) faltando.push("Sem margem do CNAE para este objeto: usando a margem da última cotação");

  let pontos = 0;
  if (comMercado !== null) pontos += comMercado.amostrasComDesconto >= AMOSTRAS_PARA_CONFIANCA ? 2 : 1;
  if (cotacoes.quantidade >= 2) pontos += 1;
  if (doCnae !== null) pontos += 1;
  const confianca: ConfiancaPreco = estimado === null ? "baixa" : pontos >= 3 ? "alta" : pontos >= 1 ? "media" : "baixa";

  return {
    veredito,
    piso,
    alvo,
    teto,
    sugerido,
    margemAlvoPct: margemEmPercentual(margemAlvo),
    margemSugeridaPct,
    lucroNoAlvo,
    custoTotal,
    regime,
    confianca,
    fontes,
    faltando,
  };
}

/** O que o servidor sabe de um item para montar a entrada sem repetir a regra em cada tela. */
export interface ItemParaPreco {
  /** numeroControlePNCP */
  id: string;
  objeto: string;
  uf: string;
  valorEstimado: number | null;
  frente: Frente | null;
  cnaes: readonly string[];
}

/**
 * Monta a entrada a partir dos dados já carregados (cotações, amostras em cache, preços de fornecedor)
 * e calcula. Não consulta nada: o servidor lê cada fonte uma vez e reaproveita em todos os itens.
 */
export function precoSugeridoDoItem(
  item: ItemParaPreco,
  porte: Porte,
  cotacoes: ResumoCotacoes | null,
  amostras: readonly AmostraConcorrente[],
  precosFornecedor: readonly PrecoFornecedor[],
  precoDescricao: string = item.objeto,
): PrecoSugerido {
  const concorrentes =
    cotacoes !== null && amostras.length > 0
      ? montarResultado(amostras, item.objeto, item.uf, item.id, item.valorEstimado).estatisticas
      : null;
  const precoFornecedor = cotacoes === null ? sugerirPrecos(precoDescricao, precosFornecedor) : null;
  return calcularPrecoSugerido({
    valorEstimado: item.valorEstimado,
    frente: item.frente,
    cnaes: item.cnaes,
    porte,
    cotacoes,
    concorrentes: concorrentes !== null && concorrentes.amostras > 0 ? concorrentes : null,
    precoFornecedor,
  });
}
