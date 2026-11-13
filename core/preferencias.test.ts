import { describe, expect, it } from "vitest";
import { normalizarEmails, normalizarTermos, preferenciasPadrao, preferenciasSchema } from "./preferencias";

describe("normalizarTermos", () => {
  it("minúsculas, sem acento, aparados e sem repetidos", () => {
    expect(normalizarTermos(["  Câmera ", "camera", "CFTV", "", "Licença de  Software"])).toEqual([
      "camera",
      "cftv",
      "licenca de software",
    ]);
  });
});

describe("normalizarEmails", () => {
  it("aparados, minúsculos e sem repetidos", () => {
    expect(normalizarEmails([" A@x.com ", "a@x.com", ""])).toEqual(["a@x.com"]);
  });
});

describe("preferenciasSchema", () => {
  it("normaliza termos e e-mails ao validar", () => {
    const r = preferenciasSchema.parse({
      termosPrioritarios: ["Sistema", "sistema"],
      termosBloqueadosParaVoce: ["Vídeo Monitoramento"],
      emailsResumo: [" Dono@Empresa.com.br "],
      resumoAtivo: false,
    });
    expect(r).toEqual({
      termosPrioritarios: ["sistema"],
      termosBloqueadosParaVoce: ["video monitoramento"],
      emailsResumo: ["dono@empresa.com.br"],
      resumoAtivo: false,
      capitalMaximo: null,
      diasMaximosParado: null,
    });
  });

  it("aceita os limites de caixa e deixa nulo quando ausentes", () => {
    const base = { termosPrioritarios: [], termosBloqueadosParaVoce: [], emailsResumo: [], resumoAtivo: true };
    expect(preferenciasSchema.parse({ ...base, capitalMaximo: 5000, diasMaximosParado: 45 })).toMatchObject({
      capitalMaximo: 5000,
      diasMaximosParado: 45,
    });
    expect(preferenciasSchema.parse(base)).toMatchObject({ capitalMaximo: null, diasMaximosParado: null });
  });

  it("recusa limite de caixa negativo ou dias quebrados", () => {
    const base = { termosPrioritarios: [], termosBloqueadosParaVoce: [], emailsResumo: [], resumoAtivo: true };
    expect(preferenciasSchema.safeParse({ ...base, capitalMaximo: -1 }).success).toBe(false);
    expect(preferenciasSchema.safeParse({ ...base, diasMaximosParado: 10.5 }).success).toBe(false);
    expect(preferenciasSchema.safeParse({ ...base, diasMaximosParado: -3 }).success).toBe(false);
  });

  it("recusa e-mail inválido", () => {
    expect(
      preferenciasSchema.safeParse({
        termosPrioritarios: [],
        termosBloqueadosParaVoce: [],
        emailsResumo: ["sem-arroba"],
        resumoAtivo: true,
      }).success,
    ).toBe(false);
  });

  it("os padrões passam na validação e vêm como cópia", () => {
    const padrao = preferenciasPadrao();
    expect(preferenciasSchema.parse(padrao)).toEqual(padrao);
    padrao.termosPrioritarios.push("x");
    expect(preferenciasPadrao().termosPrioritarios).not.toContain("x");
  });
});
