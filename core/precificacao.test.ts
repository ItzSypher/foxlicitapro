import { describe, expect, it } from "vitest";
import { calcularPrecificacao, SALARIO_MINIMO, type CalculoPrecificacao, type EntradaPrecificacao } from "./precificacao";

function entrada(parcial: Partial<EntradaPrecificacao> = {}): EntradaPrecificacao {
  return {
    custo: 100,
    frete: 10,
    extras: 5,
    tetoOrgao: null,
    margemMinima: 0.12,
    margemAlvo: 0.18,
    regime: "mei",
    tipo: "produtos",
    ...parcial,
  };
}

function calcular(e: EntradaPrecificacao): CalculoPrecificacao {
  const r = calcularPrecificacao(e);
  if (!r.ok) throw new Error(`erro inesperado: ${r.erros.map((x) => x.mensagem).join("; ")}`);
  return r.calculo;
}

describe("MEI", () => {
  it("rateia o DAS de produtos (INSS + ICMS) por 4 vendas por padrão", () => {
    const c = calcular(entrada());
    const das = 0.05 * SALARIO_MINIMO + 1;
    expect(c.dasMensal).toBeCloseTo(das, 10);
    expect(c.aliquota).toBe(0);
    expect(c.rateioDas).toBeCloseTo(das / 4, 10);
    expect(c.custoTotal).toBeCloseTo(115 + das / 4, 10);
  });

  it("usa ISS em vez de ICMS para serviços", () => {
    const c = calcular(entrada({ tipo: "servicos", vendasPrevistasNoMes: 2 }));
    const das = 0.05 * SALARIO_MINIMO + 5;
    expect(c.dasMensal).toBeCloseTo(das, 10);
    expect(c.rateioDas).toBeCloseTo(das / 2, 10);
  });

  it("calcula preços e margem efetiva sem imposto variável", () => {
    const c = calcular(entrada());
    expect(c.precoMinimo.preco).toBeCloseTo(c.custoTotal / (1 - 0.12), 8);
    expect(c.precoAlvo.preco).toBeCloseTo(c.custoTotal / (1 - 0.18), 8);
    expect(c.precoMinimo.imposto).toBe(0);
    expect(c.precoMinimo.margemEfetiva).toBeCloseTo(0.12, 10);
    expect(c.precoAlvo.margemEfetiva).toBeCloseTo(0.18, 10);
    expect(c.precoAlvo.lucroLiquido).toBeCloseTo(c.precoAlvo.preco - c.custoTotal, 8);
  });

  it("sem teto, o preço de cadastro é o preço alvo e é viável", () => {
    const c = calcular(entrada());
    expect(c.precoCadastro.preco).toBe(c.precoAlvo.preco);
    expect(c.viavel).toBe(true);
    expect(c.folga).toBeNull();
    expect(c.folgaPercentual).toBeNull();
  });
});

describe("Simples", () => {
  it("aplica 4% em produtos, sem rateio de DAS", () => {
    const c = calcular(entrada({ regime: "simples" }));
    expect(c.aliquota).toBe(0.04);
    expect(c.dasMensal).toBeNull();
    expect(c.rateioDas).toBe(0);
    expect(c.custoTotal).toBe(115);
    expect(c.precoMinimo.preco).toBeCloseTo(115 / (1 - 0.04 - 0.12), 8);
    expect(c.precoMinimo.imposto).toBeCloseTo(c.precoMinimo.preco * 0.04, 8);
    expect(c.precoMinimo.margemEfetiva).toBeCloseTo(0.12, 10);
  });

  it("aplica 6% em serviços", () => {
    const c = calcular(entrada({ regime: "simples", tipo: "servicos", margemMinima: 0.3, margemAlvo: 0.45 }));
    expect(c.aliquota).toBe(0.06);
    expect(c.precoAlvo.preco).toBeCloseTo(115 / (1 - 0.06 - 0.45), 8);
    expect(c.precoAlvo.margemEfetiva).toBeCloseTo(0.45, 10);
  });
});

describe("viabilidade e teto do órgão", () => {
  it("viável com folga em reais e em percentual", () => {
    const c = calcular(entrada({ regime: "simples", tetoOrgao: 200 }));
    expect(c.viavel).toBe(true);
    expect(c.precoCadastro.preco).toBe(200);
    expect(c.folga).toBeCloseTo(200 - c.precoMinimo.preco, 8);
    expect(c.folgaPercentual).toBeCloseTo((200 - c.precoMinimo.preco) / 200, 8);
    expect(c.precoCadastro.margemEfetiva).toBeGreaterThan(0.18);
  });

  it("inviável quando o teto não paga a margem mínima", () => {
    const c = calcular(entrada({ regime: "simples", tetoOrgao: 120 }));
    expect(c.viavel).toBe(false);
    expect(c.folga).toBeLessThan(0);
    expect(c.folgaPercentual).toBeLessThan(0);
    expect(c.precoCadastro.preco).toBe(120);
    expect(c.precoCadastro.margemEfetiva).toBeLessThan(0.12);
  });

  it("teto exatamente igual ao preço mínimo é viável", () => {
    const base = calcular(entrada({ regime: "simples" }));
    const c = calcular(entrada({ regime: "simples", tetoOrgao: base.precoMinimo.preco }));
    expect(c.viavel).toBe(true);
    expect(c.folga).toBeCloseTo(0, 8);
  });
});

describe("memória de cálculo", () => {
  it("lista linhas ordenadas com rótulo, fórmula e valor", () => {
    const c = calcular(entrada({ tetoOrgao: 200 }));
    expect(c.memoria[0]).toMatchObject({ rotulo: "Custo do item", valor: 100 });
    const rotulos = c.memoria.map((l) => l.rotulo);
    expect(rotulos.indexOf("Custo total")).toBeGreaterThan(rotulos.indexOf("Rateio do DAS por venda"));
    expect(rotulos.indexOf("Preço mínimo")).toBeGreaterThan(rotulos.indexOf("Custo total"));
    expect(rotulos).toContain("Folga sobre o preço mínimo");
    const total = c.memoria.find((l) => l.rotulo === "Custo total");
    expect(total?.valor).toBeCloseTo(c.custoTotal, 10);
    expect(total?.formula).toContain("+");
    for (const linha of c.memoria) {
      expect(linha.formula.length).toBeGreaterThan(0);
      expect(Number.isFinite(linha.valor)).toBe(true);
    }
  });
});

describe("entrada inválida", () => {
  function erros(e: EntradaPrecificacao) {
    const r = calcularPrecificacao(e);
    if (r.ok) throw new Error("deveria falhar");
    return r.erros;
  }

  it("recusa valores negativos", () => {
    const lista = erros(entrada({ custo: -1, frete: -2 }));
    expect(lista.map((x) => x.campo)).toEqual(["custo", "frete"]);
    expect(lista.every((x) => x.codigo === "valor-negativo")).toBe(true);
  });

  it("recusa número não finito sem lançar exceção", () => {
    const lista = erros(entrada({ custo: Number.NaN }));
    expect(lista[0]?.codigo).toBe("valor-invalido");
  });

  it("recusa alíquota mais margem de 100% ou mais", () => {
    const lista = erros(entrada({ regime: "simples", tipo: "servicos", margemMinima: 0.5, margemAlvo: 0.94 }));
    expect(lista.some((x) => x.codigo === "aliquota-mais-margem-invalida" && x.campo === "margemAlvo")).toBe(true);
  });

  it("recusa margem fora de 0 a 1", () => {
    expect(erros(entrada({ margemAlvo: 1 }))[0]?.codigo).toBe("margem-invalida");
    expect(erros(entrada({ margemMinima: -0.1 }))[0]?.codigo).toBe("margem-invalida");
  });

  it("recusa margem mínima maior que a alvo", () => {
    expect(erros(entrada({ margemMinima: 0.3, margemAlvo: 0.2 })).map((x) => x.codigo)).toContain(
      "margem-minima-maior-que-alvo",
    );
  });

  it("recusa teto zero ou negativo, vendas zero e custo total zero", () => {
    expect(erros(entrada({ tetoOrgao: 0 }))[0]?.codigo).toBe("teto-invalido");
    expect(erros(entrada({ vendasPrevistasNoMes: 0 }))[0]?.codigo).toBe("vendas-invalidas");
    expect(erros(entrada({ custo: 0, frete: 0, extras: 0, regime: "simples" }))[0]?.codigo).toBe("custo-total-zero");
  });

  it("vendas previstas só importam no MEI", () => {
    const r = calcularPrecificacao(entrada({ regime: "simples", vendasPrevistasNoMes: 0 }));
    expect(r.ok).toBe(true);
  });
});
