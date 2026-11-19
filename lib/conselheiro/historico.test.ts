import { describe, expect, it } from "vitest";
import { MAX_TEXTO_GRAVADO, MAX_TITULO, idDeConversaValido, quandoFoi, textoParaGravar, tituloDaConversa } from "./historico";

describe("tituloDaConversa", () => {
  it("usa a pergunta inteira quando é curta, numa linha só", () => {
    expect(tituloDaConversa("  Vale a pena\n entrar   nesta dispensa?  ")).toBe("Vale a pena entrar nesta dispensa?");
  });

  it("corta pergunta longa na palavra e marca com reticências", () => {
    const pergunta = "Quero saber como montar a proposta da dispensa de papel A4 da prefeitura de Nova Iguaçu com entrega parcelada em seis meses";
    const titulo = tituloDaConversa(pergunta);
    expect(titulo.length).toBeLessThanOrEqual(MAX_TITULO);
    expect(titulo.endsWith("…")).toBe(true);
    expect(pergunta.startsWith(titulo.slice(0, -1))).toBe(true);
    expect(titulo.slice(0, -1).endsWith(" ")).toBe(false);
  });

  it("corta no limite quando não há espaço para quebrar", () => {
    const titulo = tituloDaConversa("a".repeat(200));
    expect(titulo).toBe(`${"a".repeat(MAX_TITULO - 1)}…`);
  });

  it("pergunta vazia ganha um título padrão", () => {
    expect(tituloDaConversa("   ")).toBe("Conversa sem título");
  });
});

describe("idDeConversaValido", () => {
  it("aceita uuid e recusa o resto", () => {
    expect(idDeConversaValido("3f2b8c1e-9d4a-4b6e-8f10-2a3b4c5d6e7f")).toBe(true);
    expect(idDeConversaValido("3f2b8c1e")).toBe(false);
    expect(idDeConversaValido("'; drop table x; --")).toBe(false);
    expect(idDeConversaValido(null)).toBe(false);
    expect(idDeConversaValido(42)).toBe(false);
  });
});

describe("textoParaGravar", () => {
  it("tira espaços das pontas e respeita o limite da coluna", () => {
    expect(textoParaGravar("  oi  ")).toBe("oi");
    expect(textoParaGravar("x".repeat(MAX_TEXTO_GRAVADO + 50))).toHaveLength(MAX_TEXTO_GRAVADO);
  });
});

describe("quandoFoi", () => {
  const agora = new Date("2026-11-18T15:00:00-03:00");

  it("mostra só a hora para conversas de hoje em Brasília", () => {
    expect(quandoFoi("2026-11-18T09:05:00-03:00", agora)).toBe("hoje, 09:05");
  });

  it("mostra data e hora para outros dias", () => {
    expect(quandoFoi("2026-11-17T23:30:00-03:00", agora)).toBe("17/11/2026, 23:30");
  });

  it("data inválida vira texto vazio", () => {
    expect(quandoFoi("ontem", agora)).toBe("");
  });
});
