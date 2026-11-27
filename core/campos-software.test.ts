import { describe, expect, it } from "vitest";
import { contaSoftware, cronogramaRepasse } from "./custo-software";
import {
  entradaComissaoSchema,
  entradaSoftwareSchema,
  lerInteiroDigitado,
  lerNumeroDigitado,
  linhaRepasse,
  motivoVisivel,
} from "./campos-software";

const COMPRA = "12345678000199-2026-42";

describe("lerNumeroDigitado", () => {
  it("lê o formato brasileiro", () => {
    expect(lerNumeroDigitado("1.250,50")).toBe(1250.5);
    expect(lerNumeroDigitado("R$ 3500")).toBe(3500);
    expect(lerNumeroDigitado("3.500")).toBe(3500);
    expect(lerNumeroDigitado("0")).toBe(0);
  });
  it("texto que não é número vira null", () => {
    expect(lerNumeroDigitado("")).toBeNull();
    expect(lerNumeroDigitado("abc")).toBeNull();
    expect(lerNumeroDigitado("-5")).toBeNull();
  });
});

describe("lerInteiroDigitado", () => {
  it("só inteiro dentro da faixa", () => {
    expect(lerInteiroDigitado("12", 1, 120)).toBe(12);
    expect(lerInteiroDigitado("0", 1, 120)).toBeNull();
    expect(lerInteiroDigitado("121", 1, 120)).toBeNull();
    expect(lerInteiroDigitado("2,5", 1, 120)).toBeNull();
    expect(lerInteiroDigitado("", 1, 120)).toBeNull();
  });
});

describe("linhaRepasse", () => {
  it("monta a linha do mês", () => {
    const [mes1] = cronogramaRepasse(3500, 1, 10, 1000, 1);
    expect(linhaRepasse(mes1)).toBe("Mês 1: recebe 3.500 · comissão 350 · dev 1.000 · você 2.150");
  });
  it("sem comissão e sem dev, só o essencial", () => {
    const [mes1] = cronogramaRepasse(3500, 1, 0, null, null);
    expect(linhaRepasse(mes1)).toBe("Mês 1: recebe 3.500 · você 3.500");
  });
});

describe("motivoVisivel", () => {
  const conta = contaSoftware({ bruto: 12_000, meses: 3, comissaoPercentual: 10, terceirizavel: true, devCusto: 3_000 });
  it("dono vê a sobra", () => {
    expect(conta?.veredito).toBe("vale");
    expect(motivoVisivel(conta!, true)).toContain("Sobra");
  });
  it("gestor não vê sobra nem margem", () => {
    const texto = motivoVisivel(conta!, false);
    expect(texto).not.toContain("Sobra");
    expect(texto).not.toContain("%");
  });
  it("os outros motivos não citam a sobra e passam iguais", () => {
    const pendente = contaSoftware({ bruto: 12_000, meses: 3, comissaoPercentual: 0, terceirizavel: null, devCusto: null });
    expect(motivoVisivel(pendente!, false)).toBe(pendente!.motivo);
  });
});

describe("entradaSoftwareSchema", () => {
  it("aceita resposta completa e vazios", () => {
    expect(
      entradaSoftwareSchema.safeParse({ compra: COMPRA, terceirizavel: true, devCusto: 2500.5, devParcelas: 3, contratoMeses: 12 }).success,
    ).toBe(true);
    expect(
      entradaSoftwareSchema.safeParse({ compra: COMPRA, terceirizavel: null, devCusto: null, devParcelas: null, contratoMeses: null }).success,
    ).toBe(true);
  });
  it("recusa chave ruim, parcelas e meses fora da faixa e custo negativo", () => {
    const base = { compra: COMPRA, terceirizavel: true, devCusto: 100, devParcelas: 2, contratoMeses: 6 };
    expect(entradaSoftwareSchema.safeParse({ ...base, compra: "x" }).success).toBe(false);
    expect(entradaSoftwareSchema.safeParse({ ...base, devParcelas: 61 }).success).toBe(false);
    expect(entradaSoftwareSchema.safeParse({ ...base, devParcelas: 1.5 }).success).toBe(false);
    expect(entradaSoftwareSchema.safeParse({ ...base, contratoMeses: 121 }).success).toBe(false);
    expect(entradaSoftwareSchema.safeParse({ ...base, devCusto: -1 }).success).toBe(false);
    expect(entradaSoftwareSchema.safeParse({ ...base, terceirizavel: "sim" }).success).toBe(false);
  });
});

describe("entradaComissaoSchema", () => {
  it("0 a 30% ou null", () => {
    expect(entradaComissaoSchema.safeParse({ compra: COMPRA, percentual: 10 }).success).toBe(true);
    expect(entradaComissaoSchema.safeParse({ compra: COMPRA, percentual: null }).success).toBe(true);
    expect(entradaComissaoSchema.safeParse({ compra: COMPRA, percentual: 31 }).success).toBe(false);
    expect(entradaComissaoSchema.safeParse({ compra: COMPRA, percentual: -1 }).success).toBe(false);
  });
});
