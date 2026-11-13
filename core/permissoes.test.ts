import { describe, expect, it } from "vitest";
import {
  PERMISSOES,
  ehPapel,
  normalizarPermissoes,
  permissoesDaAcaoRevisao,
  permissoesPadrao,
  podeAgirNaRevisao,
  temPermissao,
} from "./permissoes";

describe("permissões", () => {
  it("o dono passa em tudo, mesmo sem permissões gravadas", () => {
    for (const p of PERMISSOES) expect(temPermissao({ papel: "dono", permissoes: [] }, p)).toBe(true);
  });

  it("gestor e jurídico só têm o que está marcado", () => {
    const gestor = { papel: "gestor" as const, permissoes: permissoesPadrao("gestor") };
    expect(temPermissao(gestor, "mover_pipeline")).toBe(true);
    expect(temPermissao(gestor, "aprovar_propostas")).toBe(true);
    expect(temPermissao(gestor, "editar_preferencias")).toBe(false);
    expect(temPermissao(gestor, "revisao_juridica")).toBe(false);

    const juridico = { papel: "juridico" as const, permissoes: permissoesPadrao("juridico") };
    expect(temPermissao(juridico, "revisao_juridica")).toBe(true);
    expect(temPermissao(juridico, "usar_assistente")).toBe(true);
    expect(temPermissao(juridico, "mover_pipeline")).toBe(false);
    expect(temPermissao(juridico, "editar_propostas")).toBe(false);
  });

  it("padrões por papel seguem o combinado", () => {
    expect(permissoesPadrao("gestor")).toEqual(["mover_pipeline", "editar_propostas", "aprovar_propostas", "usar_assistente"]);
    expect(permissoesPadrao("juridico")).toEqual(["revisao_juridica", "usar_assistente"]);
    expect(permissoesPadrao("dono")).toEqual([...PERMISSOES]);
  });

  it("normaliza: descarta desconhecidas e repetidas, na ordem do conjunto fechado", () => {
    expect(normalizarPermissoes(["usar_assistente", "voar", "mover_pipeline", "usar_assistente", 3])).toEqual([
      "mover_pipeline",
      "usar_assistente",
    ]);
  });

  it("reconhece só os três papéis", () => {
    expect(ehPapel("dono") && ehPapel("gestor") && ehPapel("juridico")).toBe(true);
    expect(ehPapel("admin")).toBe(false);
  });

  it("revisão: aprovar exige aprovar_propostas; devolver também vale para revisão jurídica", () => {
    const juridico = { papel: "juridico" as const, permissoes: permissoesPadrao("juridico") };
    const gestor = { papel: "gestor" as const, permissoes: permissoesPadrao("gestor") };
    expect(podeAgirNaRevisao(juridico, "aprovar")).toBe(false);
    expect(podeAgirNaRevisao(juridico, "devolver")).toBe(true);
    expect(podeAgirNaRevisao(juridico, "enviar")).toBe(false);
    expect(podeAgirNaRevisao(gestor, "aprovar")).toBe(true);
    expect(podeAgirNaRevisao(gestor, "enviar")).toBe(true);
    expect(permissoesDaAcaoRevisao("reabrir")).toEqual(["aprovar_propostas"]);
  });
});
