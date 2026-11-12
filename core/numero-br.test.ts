import { describe, expect, it } from "vitest";
import {
  formatarNumeroBR,
  fracaoParaCampoPercentual,
  parseNumeroBR,
} from "../components/calculadora/numero";

describe("parseNumeroBR", () => {
  it("lê o padrão brasileiro com milhar e vírgula", () => {
    expect(parseNumeroBR("1.234,56")).toBe(1234.56);
  });

  it("lê decimal com ponto", () => {
    expect(parseNumeroBR("1234.56")).toBe(1234.56);
  });

  it("lê vírgula sem milhar", () => {
    expect(parseNumeroBR("1234,5")).toBe(1234.5);
  });

  it("devolve null para texto vazio", () => {
    expect(parseNumeroBR("")).toBeNull();
    expect(parseNumeroBR("   ")).toBeNull();
  });

  it("devolve NaN para texto que não é número", () => {
    expect(parseNumeroBR("abc")).toBeNaN();
    expect(parseNumeroBR("12abc")).toBeNaN();
    expect(parseNumeroBR("1,2,3")).toBeNaN();
    expect(parseNumeroBR(",")).toBeNaN();
  });

  it("mantém o sinal para a validação rejeitar", () => {
    expect(parseNumeroBR("-3")).toBe(-3);
    expect(parseNumeroBR("-1.234,5")).toBe(-1234.5);
  });

  it("trata ponto único com três dígitos como milhar", () => {
    expect(parseNumeroBR("1.234")).toBe(1234);
    expect(parseNumeroBR("1.234.567")).toBe(1234567);
    expect(parseNumeroBR("0.125")).toBe(0.125);
    expect(parseNumeroBR("12.5")).toBe(12.5);
  });

  it("aceita padrão americano e prefixo de moeda", () => {
    expect(parseNumeroBR("1,234.56")).toBe(1234.56);
    expect(parseNumeroBR("R$ 1.234,56")).toBe(1234.56);
  });
});

describe("formatação para o campo", () => {
  it("escreve com vírgula e sem milhar", () => {
    expect(formatarNumeroBR(1234.5)).toBe("1234,5");
    expect(formatarNumeroBR(4)).toBe("4");
  });

  it("converte fração em percentual sem resíduo", () => {
    expect(fracaoParaCampoPercentual(0.12)).toBe("12");
    expect(fracaoParaCampoPercentual(0.185)).toBe("18,5");
  });
});
