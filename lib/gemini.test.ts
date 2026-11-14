import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

import { ErroAssistente, assistenteDisponivel, gerarJson, gerarTexto, montarPedido, nomeDoModelo, nomeDoModeloFicha, urlDoModelo } from "./gemini";

const CHAVE = "chave-secreta-de-teste";
const OPCOES = { esperaRetryMs: 0 };

function respostaGemini(texto: string, extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: texto }] }, finishReason: "STOP", ...extra }] }), {
    status: 200,
  });
}

beforeEach(() => {
  process.env.GEMINI_API_KEY = CHAVE;
  delete process.env.GEMINI_MODEL;
  delete process.env.GEMINI_MODEL_FICHA;
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  vi.restoreAllMocks();
});

describe("configuração", () => {
  it("só fica disponível com a chave definida", () => {
    expect(assistenteDisponivel()).toBe(true);
    process.env.GEMINI_API_KEY = "  ";
    expect(assistenteDisponivel()).toBe(false);
    delete process.env.GEMINI_API_KEY;
    expect(assistenteDisponivel()).toBe(false);
  });

  it("a ficha usa GEMINI_MODEL_FICHA, depois GEMINI_MODEL, depois o padrão", () => {
    delete process.env.GEMINI_MODEL_FICHA;
    expect(nomeDoModeloFicha()).toBe("gemini-3.8-flash");
    process.env.GEMINI_MODEL = "gemini-4-hydrogen";
    expect(nomeDoModeloFicha()).toBe("gemini-4-hydrogen");
    process.env.GEMINI_MODEL_FICHA = "gemini-4-lite";
    expect(nomeDoModeloFicha()).toBe("gemini-4-lite");
    process.env.GEMINI_MODEL_FICHA = "../x?y=1";
    expect(nomeDoModeloFicha()).toBe("gemini-4-hydrogen");
    delete process.env.GEMINI_MODEL_FICHA;
  });

  it("usa GEMINI_MODEL quando válido e o padrão caso contrário", () => {
    expect(nomeDoModelo()).toBe("gemini-3.8-flash");
    process.env.GEMINI_MODEL = "gemini-4-hydrogen";
    expect(nomeDoModelo()).toBe("gemini-4-hydrogen");
    process.env.GEMINI_MODEL = "../outro?x=1";
    expect(nomeDoModelo()).toBe("gemini-3.8-flash");
    expect(urlDoModelo("gemini-3.8-flash")).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
    );
  });
});

describe("montarPedido", () => {
  it("gera a estrutura do JSON com esquema, sem a chave no corpo", () => {
    const pedido = montarPedido({
      sistema: "Sistema",
      conteudos: [{ role: "user", parts: [{ inlineData: { mimeType: "application/pdf", data: "QUJD" } }, { text: "Olá" }] }],
      maxTokens: 1000,
      esquemaJson: { type: "object" },
    });
    expect(pedido).toEqual({
      systemInstruction: { parts: [{ text: "Sistema" }] },
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: "application/pdf", data: "QUJD" } }, { text: "Olá" }] }],
      generationConfig: { maxOutputTokens: 1000, responseMimeType: "application/json", responseJsonSchema: { type: "object" } },
    });
    expect(JSON.stringify(pedido)).not.toContain(CHAVE);
  });

  it("sem esquema, pede texto livre", () => {
    const pedido = montarPedido({ sistema: "S", conteudos: [], maxTokens: 10 });
    expect(pedido.generationConfig).toEqual({ maxOutputTokens: 10 });
  });
});

describe("chamadas", () => {
  const esquema = z.object({ ok: z.boolean() });
  const pedidoJson = { sistema: "S", partes: [{ tipo: "texto" as const, texto: "oi" }], esquema, esquemaJson: { type: "object" }, maxTokens: 100 };

  it("envia a chave só no cabeçalho e devolve o JSON validado", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(respostaGemini('{"ok":true}'));
    await expect(gerarJson(pedidoJson, { ...OPCOES, fetchImpl })).resolves.toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("/models/gemini-3.8-flash:generateContent");
    expect((init?.headers as Record<string, string>)["x-goog-api-key"]).toBe(CHAVE);
    expect(String(init?.body)).not.toContain(CHAVE);
  });

  it("refaz uma vez em 429 e depois conclui", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(respostaGemini("Olá"));
    await expect(gerarTexto({ sistema: "S", historico: [{ papel: "usuario", texto: "oi" }], maxTokens: 10 }, { ...OPCOES, fetchImpl })).resolves.toBe("Olá");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("falha em português depois da segunda resposta 5xx", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(new Response("{}", { status: 503 })));
    await expect(gerarTexto({ sistema: "S", historico: [{ papel: "usuario", texto: "oi" }], maxTokens: 10 }, { ...OPCOES, fetchImpl })).rejects.toMatchObject({
      codigo: "indisponivel",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("pede correção uma vez quando o JSON não passa na validação", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(respostaGemini('{"ok":"sim"}'))
      .mockResolvedValueOnce(respostaGemini('{"ok":false}'));
    await expect(gerarJson(pedidoJson, { ...OPCOES, fetchImpl })).resolves.toEqual({ ok: false });
    const segundo = JSON.parse(String(fetchImpl.mock.calls[1][1]?.body)) as { contents: unknown[] };
    expect(segundo.contents).toHaveLength(3);
  });

  it("erro claro quando a correção também falha", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(respostaGemini("não é json")));
    const erro = await gerarJson(pedidoJson, { ...OPCOES, fetchImpl }).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroAssistente);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("sem chave, não chama a rede", async () => {
    delete process.env.GEMINI_API_KEY;
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(gerarTexto({ sistema: "S", historico: [], maxTokens: 1 }, { ...OPCOES, fetchImpl })).rejects.toMatchObject({ codigo: "sem-chave" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
