import { describe, expect, it } from "vitest";
import {
  contaSoftware,
  cronogramaRepasse,
  ehDesenvolvimento,
  minimoDoContrato,
  tetoDoDev,
  VALOR_HORA,
} from "./custo-software";

describe("ehDesenvolvimento", () => {
  it("reconhece site, sistema e software", () => {
    expect(ehDesenvolvimento("Contratação de empresa para desenvolvimento de site institucional")).toBe(true);
    expect(ehDesenvolvimento("Manutenção do sistema de gestão")).toBe(true);
    expect(ehDesenvolvimento("Redesign do portal da prefeitura")).toBe(true);
  });
  it("licença de terceiro e compra de bem não contam", () => {
    expect(ehDesenvolvimento("Aquisição de licenças de software ABBYY")).toBe(false);
    expect(ehDesenvolvimento("Aquisição de HD para CFTV")).toBe(false);
  });
});

describe("mínimo e teto", () => {
  it("hora técnica é 175", () => expect(VALOR_HORA).toBe(175));
  it("mínimo é 3.500 × meses; entrega única conta 1 mês", () => {
    expect(minimoDoContrato(12)).toBe(42000);
    expect(minimoDoContrato(6)).toBe(21000);
    expect(minimoDoContrato(null)).toBe(3500);
  });
  it("teto do dev deixa 50% para o dono depois da comissão", () => {
    expect(tetoDoDev(42000, 10)).toBe(16800);
    expect(tetoDoDev(42000, 0)).toBe(21000);
  });
});

describe("contaSoftware", () => {
  const base = { bruto: 42000, meses: 12, comissaoPercentual: 10, valorReferencia: 60000 };
  it("exemplo do dono: 12 × 3.500, Paulo 10%, dev 2.000", () => {
    const c = contaSoftware({ ...base, terceirizavel: true, devCusto: 2000 });
    expect(c?.comissao).toBe(4200);
    expect(c?.sobra).toBe(35800);
    expect(c?.tetoDev).toBe(16800);
    expect(c?.veredito).toBe("vale");
    expect(c?.precoMinimo).toBe(42000);
    expect(c?.folga).toBe(18000);
    expect(c?.horaPaga).toBe(175);
  });
  it("abaixo do mínimo mensal não vale", () => {
    const c = contaSoftware({ ...base, bruto: 24000, terceirizavel: false, devCusto: null });
    expect(c?.abaixoDoMinimo).toBe(true);
    expect(c?.veredito).toBe("nao-vale");
  });
  it("sem resposta de terceirização fica pendente", () => {
    expect(contaSoftware({ ...base, terceirizavel: null, devCusto: null })?.veredito).toBe("pendente");
  });
  it("terceirizável sem cotação pede o dev com o teto", () => {
    const c = contaSoftware({ ...base, terceirizavel: true, devCusto: null });
    expect(c?.veredito).toBe("pendente");
    expect(c?.motivo).toContain("16.800");
  });
  it("dev acima do teto não vale e o preço mínimo sobe", () => {
    const c = contaSoftware({ ...base, terceirizavel: true, devCusto: 20000 });
    expect(c?.veredito).toBe("nao-vale");
    expect(c?.precoMinimo).toBe(50000);
  });
  it("sem comissão não desconta nada", () => {
    expect(contaSoftware({ ...base, comissaoPercentual: 0, terceirizavel: false, devCusto: null })?.sobra).toBe(42000);
  });
  it("sem valor devolve null", () => {
    expect(contaSoftware({ ...base, bruto: 0, terceirizavel: false, devCusto: null })).toBeNull();
  });
});

describe("cronogramaRepasse", () => {
  it("paga Paulo todo mês e o dev nas primeiras parcelas", () => {
    const r = cronogramaRepasse(42000, 12, 10, 2000, 2);
    expect(r).toHaveLength(12);
    expect(r[0]).toEqual({ mes: 1, recebe: 3500, comissao: 350, dev: 1000, dono: 2150 });
    expect(r[1].dev).toBe(1000);
    expect(r[2]).toEqual({ mes: 3, recebe: 3500, comissao: 350, dev: 0, dono: 3150 });
    expect(r.reduce((s, m) => s + m.comissao, 0)).toBe(4200);
  });
  it("parcela maior que o recebido passa para o mês seguinte", () => {
    const r = cronogramaRepasse(10000, 2, 0, 9000, 1);
    expect(r.map((m) => m.dev)).toEqual([5000, 4000]);
    expect(r.map((m) => m.dono)).toEqual([0, 1000]);
  });
});

describe("cronogramaRepasse com mais parcelas que meses", () => {
  it("quita o dev até o último pagamento", () => {
    const r = cronogramaRepasse(12000, 3, 0, 3000, 6);
    expect(r.reduce((s, m) => s + m.dev, 0)).toBe(3000);
  });
});
