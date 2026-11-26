import { describe, expect, it } from "vitest";
import { POSTURA_PARA_GANHAR } from "./postura";
import { sistemaConselheiro } from "./prompt";

describe("postura do conselheiro", () => {
  const sistema = sistemaConselheiro({ porte: "me" });

  it("o parecer parte de como ganhar e traz a postura inteira", () => {
    expect(sistema).toContain("mostrar como a empresa pode ganhar");
    expect(sistema).toContain(POSTURA_PARA_GANHAR);
  });

  it("risco só entra concreto e com a saída", () => {
    expect(POSTURA_PARA_GANHAR).toContain("Risco só entra quando é concreto");
    expect(POSTURA_PARA_GANHAR).toContain("Sem saída proposta, não cite");
    expect(sistema).toContain('"o risco: a saída"');
    expect(sistema).toContain("Exclusividade ME/EPP é vantagem, não risco");
  });

  it("dado que falta não derruba o veredito", () => {
    expect(sistema).toContain("Dado que falta (cotação, documento a conferir) não impede a decisão");
    expect(sistema).toContain('só "vale" ou "nao-vale"');
  });

  it("mantém as regras legais", () => {
    for (const texto of [POSTURA_PARA_GANHAR, sistema]) {
      expect(texto).toContain("conluio");
      expect(texto).toContain("inexequível");
      expect(texto).toContain("direcionamento");
    }
  });

  it("não fala de ferramentas nem de tecnologia", () => {
    expect(sistema).not.toMatch(/\b(IA|Gemini|Claude|intelig[eê]ncia artificial)\b/i);
    expect(POSTURA_PARA_GANHAR).not.toMatch(/\b(IA|Gemini|Claude|intelig[eê]ncia artificial)\b/i);
  });
});
