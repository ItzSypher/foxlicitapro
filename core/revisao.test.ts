import { describe, expect, it } from "vitest";
import { estaAprovada, podeEditar, podeGerarLink, podeRevisar, statusAposEdicao, transicao } from "./revisao";

const AUTOR = "autor-1";
const OUTRO = "outro-2";

describe("enviar para revisão", () => {
  it("vale para rascunho e devolvida, sem pendências", () => {
    for (const s of ["rascunho", "devolvida"] as const) {
      expect(transicao(s, "enviar", { usuarioId: AUTOR, criadoPor: AUTOR, autor: "usuario", pendencias: 0 })).toEqual({
        ok: true,
        status: "em_revisao",
      });
    }
  });

  it("bloqueia com pendências ou em outro status", () => {
    const ctx = { usuarioId: AUTOR, criadoPor: AUTOR, autor: "usuario" as const };
    expect(transicao("rascunho", "enviar", { ...ctx, pendencias: 2 }).ok).toBe(false);
    for (const s of ["em_revisao", "aprovada", "pronta", "enviada"] as const) {
      expect(transicao(s, "enviar", ctx).ok).toBe(false);
    }
  });
});

describe("aprovar e devolver", () => {
  it("outra pessoa aprova", () => {
    expect(transicao("em_revisao", "aprovar", { usuarioId: OUTRO, criadoPor: AUTOR, autor: "usuario" })).toEqual({
      ok: true,
      status: "aprovada",
    });
  });

  it("o autor não revisa a própria proposta", () => {
    const r = transicao("em_revisao", "aprovar", { usuarioId: AUTOR, criadoPor: AUTOR, autor: "usuario" });
    expect(r.ok).toBe(false);
  });

  it("proposta do assistente ou sem autor conhecido pode ser revisada por qualquer um", () => {
    expect(podeRevisar("em_revisao", { usuarioId: AUTOR, criadoPor: AUTOR, autor: "assistente" })).toBe(true);
    expect(podeRevisar("em_revisao", { usuarioId: AUTOR, criadoPor: null, autor: "usuario" })).toBe(true);
    expect(podeRevisar("rascunho", { usuarioId: OUTRO, criadoPor: AUTOR, autor: "usuario" })).toBe(false);
  });

  it("devolver exige nota", () => {
    const ctx = { usuarioId: OUTRO, criadoPor: AUTOR, autor: "usuario" as const };
    expect(transicao("em_revisao", "devolver", ctx).ok).toBe(false);
    expect(transicao("em_revisao", "devolver", { ...ctx, nota: "   " }).ok).toBe(false);
    expect(transicao("em_revisao", "devolver", { ...ctx, nota: "Corrigir o prazo" })).toEqual({
      ok: true,
      status: "devolvida",
    });
  });

  it("só decide proposta em revisão", () => {
    const ctx = { usuarioId: OUTRO, criadoPor: AUTOR, autor: "usuario" as const, nota: "x" };
    expect(transicao("rascunho", "aprovar", ctx).ok).toBe(false);
    expect(transicao("aprovada", "devolver", ctx).ok).toBe(false);
  });
});

describe("retirar e reabrir", () => {
  it("só o autor retira da revisão", () => {
    expect(transicao("em_revisao", "retirar", { usuarioId: AUTOR, criadoPor: AUTOR, autor: "usuario" })).toEqual({
      ok: true,
      status: "rascunho",
    });
    expect(transicao("em_revisao", "retirar", { usuarioId: OUTRO, criadoPor: AUTOR, autor: "usuario" }).ok).toBe(false);
  });

  it("aprovada (ou pronta) volta para rascunho", () => {
    const ctx = { usuarioId: AUTOR, criadoPor: AUTOR, autor: "usuario" as const };
    expect(transicao("aprovada", "reabrir", ctx).ok).toBe(true);
    expect(transicao("pronta", "reabrir", ctx).ok).toBe(true);
    expect(transicao("rascunho", "reabrir", ctx).ok).toBe(false);
  });
});

describe("regras auxiliares", () => {
  it("pronta é sinônimo de aprovada e libera o link; enviada continua liberada", () => {
    expect(estaAprovada("pronta")).toBe(true);
    expect(podeGerarLink("aprovada")).toBe(true);
    expect(podeGerarLink("pronta")).toBe(true);
    expect(podeGerarLink("enviada")).toBe(true);
    expect(podeGerarLink("rascunho")).toBe(false);
    expect(podeGerarLink("em_revisao")).toBe(false);
    expect(podeGerarLink("devolvida")).toBe(false);
  });

  it("só trava a edição em revisão", () => {
    expect(podeEditar("em_revisao")).toBe(false);
    for (const s of ["rascunho", "devolvida", "aprovada", "pronta", "enviada"] as const) {
      expect(podeEditar(s)).toBe(true);
    }
  });

  it("editar o que já foi aprovado exige nova revisão", () => {
    expect(statusAposEdicao("aprovada", true)).toBe("rascunho");
    expect(statusAposEdicao("pronta", true)).toBe("rascunho");
    expect(statusAposEdicao("devolvida", true)).toBe("devolvida");
    expect(statusAposEdicao("enviada", true)).toBe("enviada");
    expect(statusAposEdicao("enviada", false)).toBe("rascunho");
  });
});
