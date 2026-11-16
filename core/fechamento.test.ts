import { describe, expect, it } from "vitest";
import { MOTIVOS_PERDA, ROTULO_MOTIVO, calcularLucro, ehMotivoPerda } from "./fechamento";

describe("calcularLucro", () => {
  it("lucro é homologado menos custo e a margem é sobre o homologado", () => {
    const r = calcularLucro(10000, 7500);
    expect(r.lucro).toBe(2500);
    expect(r.margem).toBeCloseTo(0.25);
  });

  it("prejuízo dá lucro e margem negativos", () => {
    const r = calcularLucro(1000, 1500);
    expect(r.lucro).toBe(-500);
    expect(r.margem).toBeCloseTo(-0.5);
  });

  it("sem custo não há lucro; com valor zerado não há margem", () => {
    expect(calcularLucro(1000, null)).toEqual({ lucro: null, margem: null });
    expect(calcularLucro(null, 500)).toEqual({ lucro: null, margem: null });
    expect(calcularLucro(0, 500)).toEqual({ lucro: -500, margem: null });
  });
});

describe("motivos de perda", () => {
  it("tem rótulo para todos e reconhece só os conhecidos", () => {
    for (const m of MOTIVOS_PERDA) expect(ROTULO_MOTIVO[m]).not.toBe("");
    expect(ehMotivoPerda("preco")).toBe(true);
    expect(ehMotivoPerda("bola")).toBe(false);
    expect(ehMotivoPerda(null)).toBe(false);
  });
});
