import {
  ALIQUOTA_SIMPLES,
  ICMS_MEI,
  ISS_MEI,
  PERCENTUAL_INSS_MEI,
  SALARIO_MINIMO,
} from "@/core/precificacao";
import type { CalculoPrecificacao } from "@/core/precificacao";
import type { Frente } from "@/core/types";
import { formatarMoeda } from "@/lib/formato";

export const LINK_PGMEI =
  "https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/Identificacao";

const percentual = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const percentualInteiro = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});

/** 0,1234 vira "12,3%". */
export function formatarPercentual(fracao: number): string {
  return percentual.format(fracao);
}

/** DAS mensal do MEI a partir das constantes do cálculo. */
export function dasMensalMei(frente: Frente): number {
  return PERCENTUAL_INSS_MEI * SALARIO_MINIMO + (frente === "produtos" ? ICMS_MEI : ISS_MEI);
}

/** Explicação do imposto em frases curtas, com os valores reais do cálculo. */
export function impostoEmPalavras(calculo: CalculoPrecificacao, frente: Frente, vendas: number): string[] {
  if (calculo.regime === "mei") {
    const das = calculo.dasMensal ?? dasMensalMei(frente);
    return [
      "Como MEI, você não paga imposto por nota.",
      `Paga o DAS fixo de ${formatarMoeda(das)} por mês (INSS + ${frente === "produtos" ? "ICMS" : "ISS"}).`,
      `Dividimos esse valor pelas ${vendas} vendas previstas: ${formatarMoeda(calculo.rateioDas)} por venda.`,
    ];
  }
  const aliquota = percentualInteiro.format(ALIQUOTA_SIMPLES[frente]);
  return [
    `No Simples, cerca de ${aliquota} do preço vira imposto.`,
    "Esse imposto já está dentro do preço que mostramos.",
  ];
}

/** Como mostrar o valor de cada linha da memória de cálculo. */
export function formatarValorMemoria(rotulo: string, valor: number): string {
  if (rotulo === "Viabilidade") return valor === 1 ? "Sim" : "Não";
  if (
    rotulo === "Alíquota do Simples" ||
    rotulo.startsWith("Margem efetiva") ||
    rotulo.startsWith("Folga em percentual")
  ) {
    return formatarPercentual(valor);
  }
  return formatarMoeda(valor);
}
