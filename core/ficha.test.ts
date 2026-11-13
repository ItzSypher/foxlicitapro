import { describe, expect, it } from "vitest";
import { FICHA_EXEMPLO } from "./ficha.fixture";
import { FichaEditalSchema, lerFichaSalva } from "./ficha";

describe("FichaEditalSchema", () => {
  it("aceita a ficha completa", () => {
    expect(FichaEditalSchema.safeParse(FICHA_EXEMPLO).success).toBe(true);
    expect(lerFichaSalva(FICHA_EXEMPLO)).toEqual(FICHA_EXEMPLO);
  });

  it("aceita campos ausentes como nulo e natureza não informada", () => {
    const ficha = {
      ...FICHA_EXEMPLO,
      natureza: { valor: "nao-informado", trecho: null, pagina: null },
      prazoPagamentoDias: { valor: null, trecho: null, pagina: null },
      pagamentoAntecipado: { valor: null, condicao: null, trecho: null, pagina: null },
      documentosHabilitacao: { valor: [], trecho: null, pagina: null },
    };
    expect(FichaEditalSchema.safeParse(ficha).success).toBe(true);
  });

  it("recusa natureza fora da lista, página inválida e valor de texto vazio", () => {
    expect(FichaEditalSchema.safeParse({ ...FICHA_EXEMPLO, natureza: { valor: "outra", trecho: null, pagina: null } }).success).toBe(false);
    expect(FichaEditalSchema.safeParse({ ...FICHA_EXEMPLO, reajuste: { valor: "x", trecho: null, pagina: 0 } }).success).toBe(false);
    expect(FichaEditalSchema.safeParse({ ...FICHA_EXEMPLO, localEntrega: { valor: "  ", trecho: null, pagina: null } }).success).toBe(false);
  });

  it("exige de 3 a 5 dicas de como competir", () => {
    expect(FichaEditalSchema.safeParse({ ...FICHA_EXEMPLO, comoCompetir: ["a", "b"] }).success).toBe(false);
    expect(FichaEditalSchema.safeParse({ ...FICHA_EXEMPLO, comoCompetir: ["a", "b", "c", "d", "e", "f"] }).success).toBe(false);
    expect(FichaEditalSchema.safeParse({ ...FICHA_EXEMPLO, comoCompetir: ["a", "b", "c", "d", "e"] }).success).toBe(true);
  });

  it("recusa percentual de garantia acima de 100 e prazo negativo", () => {
    expect(FichaEditalSchema.safeParse({ ...FICHA_EXEMPLO, garantiaContratualPercentual: { valor: 120, trecho: null, pagina: null } }).success).toBe(false);
    expect(FichaEditalSchema.safeParse({ ...FICHA_EXEMPLO, prazoEntregaDias: { valor: -1, trecho: null, pagina: null } }).success).toBe(false);
  });

  it("lerFichaSalva devolve null para conteúdo fora do formato", () => {
    expect(lerFichaSalva({ natureza: 1 })).toBeNull();
    expect(lerFichaSalva(null)).toBeNull();
  });
});
