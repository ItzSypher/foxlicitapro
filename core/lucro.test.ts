import { describe, expect, it } from "vitest";
import { comissaoDoItem, contaLucro, custoEstimado, normalizarComissao, precoMinimoSemPrejuizo } from "./lucro";

describe("lucro × prejuízo", () => {
  it("desconta custo e comissão do bruto", () => {
    const c = contaLucro({ receita: 10_000, custo: 7_000, comissaoPercentual: 12 });
    expect(c?.comissao).toBe(1_200);
    expect(c?.resultado).toBe(1_800);
    expect(c?.margemPercentual).toBe(18);
    expect(c?.situacao).toBe("lucro");
    expect(c?.custoEstimado).toBe(false);
  });

  it("aponta prejuízo e o preço mínimo", () => {
    const c = contaLucro({ receita: 1_000, custo: 950, comissaoPercentual: 10 });
    expect(c?.situacao).toBe("prejuizo");
    expect(c?.resultado).toBe(-50);
    expect(c?.precoMinimo).toBeCloseTo(1_055.56, 2);
  });

  it("estima o custo sem fornecedor", () => {
    expect(custoEstimado({ objeto: "Desenvolvimento de site institucional", valorEstimado: 5_000 }, 5_000)).toBe(0);
    expect(custoEstimado({ objeto: "Aquisição de toner", valorEstimado: 1_000 }, 1_000)).toBe(800);
    const c = contaLucro({ receita: 1_000, custo: null, comissaoPercentual: 15, oportunidade: { objeto: "Aquisição de toner", valorEstimado: 1_000 } });
    expect(c?.custoEstimado).toBe(true);
    expect(c?.resultado).toBe(50);
  });

  it("sem receita não calcula", () => {
    expect(contaLucro({ receita: 0, custo: 10, comissaoPercentual: 12 })).toBeNull();
  });

  it("comissão fica entre 0 e 30 e o item usa o ajuste ou o padrão", () => {
    expect(normalizarComissao(45)).toBe(30);
    expect(normalizarComissao(Number.NaN)).toBe(12);
    expect(comissaoDoItem(null, 10)).toBe(10);
    expect(comissaoDoItem(15, 10)).toBe(15);
    expect(precoMinimoSemPrejuizo(880, 12)).toBe(1_000);
  });
});
