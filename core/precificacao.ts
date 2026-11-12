import type { Frente } from "./types";

/** Confirmar o valor vigente no PGMEI. */
export const SALARIO_MINIMO = 1621;

/** Parte do DAS-MEI destinada ao INSS: 5% do salário mínimo. */
export const PERCENTUAL_INSS_MEI = 0.05;
/** ICMS fixo do DAS para MEI de comércio (produtos). */
export const ICMS_MEI = 1;
/** ISS fixo do DAS para MEI de serviço. */
export const ISS_MEI = 5;
export const VENDAS_PREVISTAS_PADRAO = 4;

/** Alíquota efetiva da 1ª faixa do Simples: Anexo I (comércio) e Anexo III (serviços). */
export const ALIQUOTA_SIMPLES: Record<Frente, number> = {
  produtos: 0.04,
  servicos: 0.06,
};

export type Regime = "mei" | "simples";

export interface EntradaPrecificacao {
  custo: number;
  frete: number;
  extras: number;
  /** Valor máximo estimado pelo órgão; null quando não há teto */
  tetoOrgao: number | null;
  /** Fração do preço de venda (0,12 = 12%) */
  margemMinima: number;
  /** Fração do preço de venda */
  margemAlvo: number;
  regime: Regime;
  tipo: Frente;
  /** Só para MEI: quantas vendas dividem o DAS do mês. Padrão 4 */
  vendasPrevistasNoMes?: number;
}

export type CodigoErroPrecificacao =
  | "valor-invalido"
  | "valor-negativo"
  | "custo-total-zero"
  | "teto-invalido"
  | "margem-invalida"
  | "margem-minima-maior-que-alvo"
  | "aliquota-mais-margem-invalida"
  | "vendas-invalidas";

export interface ErroPrecificacao {
  codigo: CodigoErroPrecificacao;
  campo: string;
  mensagem: string;
}

export interface DetalhePreco {
  /** Preço de venda em reais, sem arredondar */
  preco: number;
  /** Imposto variável sobre a venda, em reais */
  imposto: number;
  /** Lucro líquido em reais: preço − custo total − imposto */
  lucroLiquido: number;
  /** Lucro líquido dividido pelo preço (fração) */
  margemEfetiva: number;
}

export interface LinhaMemoria {
  rotulo: string;
  /** Conta com os números já substituídos */
  formula: string;
  valor: number;
}

export interface CalculoPrecificacao {
  regime: Regime;
  /** Alíquota variável sobre o preço (0 no MEI) */
  aliquota: number;
  /** DAS mensal do MEI; null no Simples */
  dasMensal: number | null;
  /** DAS dividido pelas vendas do mês; 0 no Simples */
  rateioDas: number;
  custoTotal: number;
  precoMinimo: DetalhePreco;
  precoAlvo: DetalhePreco;
  /** Preço a lançar no sistema: o teto do órgão, ou o preço alvo sem teto */
  precoCadastro: DetalhePreco;
  viavel: boolean;
  /** Teto menos preço mínimo, em reais; null sem teto */
  folga: number | null;
  /** Folga dividida pelo teto (fração); null sem teto */
  folgaPercentual: number | null;
  memoria: LinhaMemoria[];
}

export type ResultadoPrecificacao =
  | { ok: true; calculo: CalculoPrecificacao }
  | { ok: false; erros: ErroPrecificacao[] };

const formatadorReais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatadorPercentual = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function brl(valor: number): string {
  return formatadorReais.format(valor);
}

function pct(fracao: number): string {
  return formatadorPercentual.format(fracao);
}

function validar(e: EntradaPrecificacao, aliquota: number, vendas: number): ErroPrecificacao[] {
  const erros: ErroPrecificacao[] = [];

  const campos: Array<[string, number]> = [
    ["custo", e.custo],
    ["frete", e.frete],
    ["extras", e.extras],
    ["margemMinima", e.margemMinima],
    ["margemAlvo", e.margemAlvo],
  ];
  for (const [campo, valor] of campos) {
    if (!Number.isFinite(valor)) {
      erros.push({ codigo: "valor-invalido", campo, mensagem: `${campo} precisa ser um número válido` });
    }
  }
  for (const [campo, valor] of campos.slice(0, 3)) {
    if (Number.isFinite(valor) && valor < 0) {
      erros.push({ codigo: "valor-negativo", campo, mensagem: `${campo} não pode ser negativo` });
    }
  }
  if (erros.length > 0) return erros;

  if (e.tetoOrgao !== null && (!Number.isFinite(e.tetoOrgao) || e.tetoOrgao <= 0)) {
    erros.push({ codigo: "teto-invalido", campo: "tetoOrgao", mensagem: "O teto do órgão precisa ser maior que zero ou ficar em branco" });
  }
  for (const [campo, valor] of [["margemMinima", e.margemMinima], ["margemAlvo", e.margemAlvo]] as const) {
    if (valor < 0 || valor >= 1) {
      erros.push({ codigo: "margem-invalida", campo, mensagem: `${campo} precisa estar entre 0% e 100% (exclusive)` });
    } else if (aliquota + valor >= 1) {
      erros.push({
        codigo: "aliquota-mais-margem-invalida",
        campo,
        mensagem: `Alíquota (${pct(aliquota)}) mais ${campo} (${pct(valor)}) chega a 100% ou mais: não existe preço possível`,
      });
    }
  }
  if (e.margemMinima > e.margemAlvo) {
    erros.push({ codigo: "margem-minima-maior-que-alvo", campo: "margemMinima", mensagem: "A margem mínima não pode passar da margem alvo" });
  }
  if (e.regime === "mei" && (!Number.isFinite(vendas) || vendas <= 0)) {
    erros.push({ codigo: "vendas-invalidas", campo: "vendasPrevistasNoMes", mensagem: "As vendas previstas no mês precisam ser maiores que zero" });
  }
  if (e.custo + e.frete + e.extras <= 0) {
    erros.push({ codigo: "custo-total-zero", campo: "custo", mensagem: "O custo total precisa ser maior que zero" });
  }
  return erros;
}

function detalhar(preco: number, custoTotal: number, aliquota: number): DetalhePreco {
  const imposto = preco * aliquota;
  const lucroLiquido = preco - custoTotal - imposto;
  return { preco, imposto, lucroLiquido, margemEfetiva: preco > 0 ? lucroLiquido / preco : 0 };
}

/**
 * Calculadora de preço de venda. Função pura, sem arredondamento: a tela
 * arredonda ao exibir. Entrada inválida devolve a lista de erros, sem lançar.
 */
export function calcularPrecificacao(entrada: EntradaPrecificacao): ResultadoPrecificacao {
  const vendas = entrada.vendasPrevistasNoMes ?? VENDAS_PREVISTAS_PADRAO;
  const aliquota = entrada.regime === "mei" ? 0 : ALIQUOTA_SIMPLES[entrada.tipo];

  const erros = validar(entrada, aliquota, vendas);
  if (erros.length > 0) return { ok: false, erros };

  const { custo, frete, extras, tetoOrgao, margemMinima, margemAlvo, regime, tipo } = entrada;
  const memoria: LinhaMemoria[] = [];

  memoria.push({ rotulo: "Custo do item", formula: brl(custo), valor: custo });
  memoria.push({ rotulo: "Frete", formula: brl(frete), valor: frete });
  memoria.push({ rotulo: "Custos extras", formula: brl(extras), valor: extras });

  let dasMensal: number | null = null;
  let rateioDas = 0;
  if (regime === "mei") {
    const inss = PERCENTUAL_INSS_MEI * SALARIO_MINIMO;
    const imposto = tipo === "produtos" ? ICMS_MEI : ISS_MEI;
    const nomeImposto = tipo === "produtos" ? "ICMS (comércio)" : "ISS (serviço)";
    dasMensal = inss + imposto;
    rateioDas = dasMensal / vendas;
    memoria.push({
      rotulo: "INSS do DAS",
      formula: `${pct(PERCENTUAL_INSS_MEI)} × ${brl(SALARIO_MINIMO)} (salário mínimo)`,
      valor: inss,
    });
    memoria.push({ rotulo: nomeImposto, formula: brl(imposto), valor: imposto });
    memoria.push({ rotulo: "DAS mensal", formula: `${brl(inss)} + ${brl(imposto)}`, valor: dasMensal });
    memoria.push({
      rotulo: "Rateio do DAS por venda",
      formula: `${brl(dasMensal)} ÷ ${vendas} vendas no mês`,
      valor: rateioDas,
    });
    memoria.push({
      rotulo: "Imposto sobre a venda",
      formula: "MEI não paga imposto variável sobre a venda: 0,00%",
      valor: 0,
    });
  } else {
    memoria.push({
      rotulo: "Alíquota do Simples",
      formula: `${tipo === "produtos" ? "Anexo I" : "Anexo III"}, 1ª faixa: ${pct(aliquota)} sobre o preço`,
      valor: aliquota,
    });
  }

  const custoTotal = custo + frete + extras + rateioDas;
  memoria.push({
    rotulo: "Custo total",
    formula: `${brl(custo)} + ${brl(frete)} + ${brl(extras)} + ${brl(rateioDas)}`,
    valor: custoTotal,
  });

  const precoMinimo = custoTotal / (1 - aliquota - margemMinima);
  const precoAlvo = custoTotal / (1 - aliquota - margemAlvo);
  const precoCadastro = tetoOrgao ?? precoAlvo;

  memoria.push({
    rotulo: "Preço mínimo",
    formula: `${brl(custoTotal)} ÷ (1 − ${pct(aliquota)} − ${pct(margemMinima)})`,
    valor: precoMinimo,
  });
  memoria.push({
    rotulo: "Preço alvo",
    formula: `${brl(custoTotal)} ÷ (1 − ${pct(aliquota)} − ${pct(margemAlvo)})`,
    valor: precoAlvo,
  });
  memoria.push({
    rotulo: "Preço de cadastro",
    formula: tetoOrgao === null ? `Sem teto do órgão: usa o preço alvo ${brl(precoAlvo)}` : `Teto do órgão: ${brl(tetoOrgao)}`,
    valor: precoCadastro,
  });

  const detMinimo = detalhar(precoMinimo, custoTotal, aliquota);
  const detAlvo = detalhar(precoAlvo, custoTotal, aliquota);
  const detCadastro = detalhar(precoCadastro, custoTotal, aliquota);

  const nomes: Array<[string, DetalhePreco]> = [
    ["preço mínimo", detMinimo],
    ["preço alvo", detAlvo],
    ["preço de cadastro", detCadastro],
  ];
  for (const [nome, d] of nomes) {
    memoria.push({
      rotulo: `Imposto no ${nome}`,
      formula: `${brl(d.preco)} × ${pct(aliquota)}`,
      valor: d.imposto,
    });
    memoria.push({
      rotulo: `Lucro líquido no ${nome}`,
      formula: `${brl(d.preco)} − ${brl(custoTotal)} − ${brl(d.imposto)}`,
      valor: d.lucroLiquido,
    });
    memoria.push({
      rotulo: `Margem efetiva no ${nome}`,
      formula: `${brl(d.lucroLiquido)} ÷ ${brl(d.preco)}`,
      valor: d.margemEfetiva,
    });
  }

  const viavel = tetoOrgao === null || precoMinimo <= tetoOrgao;
  const folga = tetoOrgao === null ? null : tetoOrgao - precoMinimo;
  const folgaPercentual = tetoOrgao === null || folga === null ? null : folga / tetoOrgao;

  if (tetoOrgao === null || folga === null || folgaPercentual === null) {
    memoria.push({ rotulo: "Viabilidade", formula: "Sem teto do órgão: não há limite a respeitar", valor: 1 });
  } else {
    memoria.push({
      rotulo: "Folga sobre o preço mínimo",
      formula: `${brl(tetoOrgao)} − ${brl(precoMinimo)}`,
      valor: folga,
    });
    memoria.push({
      rotulo: "Folga em percentual do teto",
      formula: `${brl(folga)} ÷ ${brl(tetoOrgao)}`,
      valor: folgaPercentual,
    });
    memoria.push({
      rotulo: "Viabilidade",
      formula: viavel
        ? `${brl(precoMinimo)} ≤ ${brl(tetoOrgao)}: dá para participar`
        : `${brl(precoMinimo)} > ${brl(tetoOrgao)}: o teto não paga a margem mínima`,
      valor: viavel ? 1 : 0,
    });
  }

  return {
    ok: true,
    calculo: {
      regime,
      aliquota,
      dasMensal,
      rateioDas,
      custoTotal,
      precoMinimo: detMinimo,
      precoAlvo: detAlvo,
      precoCadastro: detCadastro,
      viavel,
      folga,
      folgaPercentual,
      memoria,
    },
  };
}
