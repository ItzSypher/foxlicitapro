import { describe, expect, it } from "vitest";
import {
  PASSOS_JURIDICOS,
  checklistCompleto,
  ehAvanco,
  okJuridico,
  passosFaltando,
  validarSaidaDaRevisao,
  type MarcaJuridica,
  type PassoJuridicoId,
} from "./revisao-juridica";

function marca(passo: PassoJuridicoId, em: string, porNome: string | null = "Ana"): MarcaJuridica {
  return { passo, porId: "u1", porNome, em };
}

const TODAS: MarcaJuridica[] = [
  marca("habilitacao", "2026-11-10T10:00:00.000Z"),
  marca("clausulas_risco", "2026-11-10T10:05:00.000Z"),
  marca("garantia_multas", "2026-11-10T11:00:00.000Z", "Bruno"),
  marca("prazos", "2026-11-10T09:00:00.000Z"),
];

describe("checklist jurídico", () => {
  it("tem os 4 passos fixos", () => {
    expect(PASSOS_JURIDICOS.map((p) => p.id)).toEqual(["habilitacao", "clausulas_risco", "garantia_multas", "prazos"]);
  });

  it("vazio: todos faltam e não está completo", () => {
    expect(passosFaltando([])).toHaveLength(4);
    expect(checklistCompleto([])).toBe(false);
    expect(okJuridico([])).toBeNull();
  });

  it("parcial: lista o que falta na ordem do checklist", () => {
    const parcial = [marca("habilitacao", "2026-11-10T10:00:00.000Z"), marca("prazos", "2026-11-10T10:01:00.000Z")];
    expect(passosFaltando(parcial)).toEqual(["clausulas_risco", "garantia_multas"]);
    expect(okJuridico(parcial)).toBeNull();
  });

  it("completo: o ok jurídico é de quem marcou por último", () => {
    expect(checklistCompleto(TODAS)).toBe(true);
    expect(okJuridico(TODAS)).toEqual({ porNome: "Bruno", em: "2026-11-10T11:00:00.000Z" });
  });
});

describe("ehAvanco", () => {
  it("só para etapas adiante e nunca para perdida", () => {
    expect(ehAvanco("revisao_juridica", "proposta")).toBe(true);
    expect(ehAvanco("revisao_juridica", "ganha")).toBe(true);
    expect(ehAvanco("revisao_juridica", "cotando")).toBe(false);
    expect(ehAvanco("revisao_juridica", "perdida")).toBe(false);
    expect(ehAvanco("revisao_juridica", "revisao_juridica")).toBe(false);
  });
});

describe("validarSaidaDaRevisao", () => {
  it("avançar com checklist incompleto é barrado e diz o que falta", () => {
    const r = validarSaidaDaRevisao("revisao_juridica", "proposta", [marca("habilitacao", "2026-11-10T10:00:00.000Z")]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erro).toContain("cláusulas de risco lidas");
      expect(r.erro).not.toContain("habilitação ok");
    }
  });

  it("avançar com checklist completo passa", () => {
    expect(validarSaidaDaRevisao("revisao_juridica", "proposta", TODAS)).toEqual({ ok: true });
  });

  it("voltar e desistir não exigem o checklist", () => {
    expect(validarSaidaDaRevisao("revisao_juridica", "cotando", [])).toEqual({ ok: true });
    expect(validarSaidaDaRevisao("revisao_juridica", "perdida", [])).toEqual({ ok: true });
  });

  it("outras etapas não são afetadas", () => {
    expect(validarSaidaDaRevisao("cotando", "proposta", [])).toEqual({ ok: true });
  });
});
