import { describe, expect, it } from "vitest";
import { JANELA_MS, MAX_TENTATIVAS, bloqueado, limparFalhas, registrarFalha } from "./limite-tentativas";

describe("limite de tentativas de login", () => {
  it("bloqueia depois de 5 falhas e libera quando a janela passa", () => {
    const chave = "limite@teste.invalid";
    const t0 = 1_000_000;
    for (let i = 0; i < MAX_TENTATIVAS - 1; i += 1) registrarFalha(chave, t0 + i);
    expect(bloqueado(chave, t0 + 10)).toBe(false);
    registrarFalha(chave, t0 + 10);
    expect(bloqueado(chave, t0 + 11)).toBe(true);
    expect(bloqueado(chave, t0 + JANELA_MS + 11)).toBe(false);
  });

  it("limpar zera a contagem e cada e-mail conta separado", () => {
    const a = "a@teste.invalid";
    const b = "b@teste.invalid";
    for (let i = 0; i < MAX_TENTATIVAS; i += 1) registrarFalha(a, 5_000_000);
    expect(bloqueado(a, 5_000_001)).toBe(true);
    expect(bloqueado(b, 5_000_001)).toBe(false);
    limparFalhas(a);
    expect(bloqueado(a, 5_000_002)).toBe(false);
  });
});
