import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { assinaturaValida, enviarTexto, garantirWebhook, zernioConfigurado } from "./zernio";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function configurar() {
  vi.stubEnv("ZERNIO_API_KEY", "chave-secreta");
  vi.stubEnv("ZERNIO_WHATSAPP_ACCOUNT_ID", "conta-1");
}

function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
}

describe("assinaturaValida", () => {
  const corpo = '{"event":"message.received"}';
  const hex = createHmac("sha256", "segredo").update(corpo).digest("hex");
  it("aceita a assinatura certa", () => {
    expect(assinaturaValida(corpo, hex, "segredo")).toBe(true);
    expect(assinaturaValida(corpo, `sha256=${hex}`, "segredo")).toBe(true);
  });
  it("recusa corpo alterado, segredo errado, tamanho diferente e ausência", () => {
    expect(assinaturaValida(`${corpo} `, hex, "segredo")).toBe(false);
    expect(assinaturaValida(corpo, hex, "outro")).toBe(false);
    expect(assinaturaValida(corpo, hex.slice(0, 10), "segredo")).toBe(false);
    expect(assinaturaValida(corpo, null, "segredo")).toBe(false);
    expect(assinaturaValida(corpo, hex, "")).toBe(false);
  });
});

describe("zernioConfigurado", () => {
  it("exige as duas variáveis", () => {
    vi.stubEnv("ZERNIO_API_KEY", "");
    vi.stubEnv("ZERNIO_WHATSAPP_ACCOUNT_ID", "");
    expect(zernioConfigurado()).toBe(false);
    vi.stubEnv("ZERNIO_API_KEY", "k");
    expect(zernioConfigurado()).toBe(false);
    vi.stubEnv("ZERNIO_WHATSAPP_ACCOUNT_ID", "a");
    expect(zernioConfigurado()).toBe(true);
  });
});

describe("enviarTexto", () => {
  it("sem configuração, não envia", async () => {
    vi.stubEnv("ZERNIO_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await enviarTexto("c1", "oi")).ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("manda no máximo 3 botões com título de 20 caracteres e devolve o id", async () => {
    configurar();
    const fetchMock = vi.fn().mockResolvedValue(resposta({ message: { id: "m1" } }));
    vi.stubGlobal("fetch", fetchMock);
    const botoes = Array.from({ length: 4 }, (_, i) => ({ titulo: "x".repeat(30), payload: `p${i}` }));
    const r = await enviarTexto("c1", "oi", botoes);
    expect(r).toEqual({ ok: true, messageId: "m1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://zernio.com/api/v1/inbox/conversations/c1/messages");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer chave-secreta");
    const corpo = JSON.parse(String(init.body)) as { accountId: string; buttons: Array<{ type: string; title: string }> };
    expect(corpo.accountId).toBe("conta-1");
    expect(corpo.buttons).toHaveLength(3);
    expect(corpo.buttons[0]).toMatchObject({ type: "postback", title: "x".repeat(20) });
  });
  it("não lança e não vaza a chave no log quando falha", async () => {
    configurar();
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta({ code: "invalid_token", detalhe: "chave-secreta" }, 401)));
    const r = await enviarTexto("c1", "oi");
    expect(r).toEqual({ ok: false, erro: "falha 401" });
    expect(JSON.stringify(erro.mock.calls)).not.toContain("chave-secreta");
    erro.mockRestore();
  });
  it("erro de rede vira resultado", async () => {
    configurar();
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede")));
    expect((await enviarTexto("c1", "oi")).ok).toBe(false);
    erro.mockRestore();
  });
});

describe("garantirWebhook", () => {
  it("não cria quando já existe com a mesma URL (lista em `webhooks`)", async () => {
    configurar();
    const fetchMock = vi.fn().mockResolvedValue(resposta({ webhooks: [{ _id: "w1", url: "https://x/api", events: ["message.received"] }] }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await garantirWebhook("https://x/api", "seg")).toEqual({ ok: true, criado: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("cria quando não existe (lista em `data`)", async () => {
    configurar();
    const fetchMock = vi.fn().mockResolvedValueOnce(resposta({ data: [] })).mockResolvedValueOnce(resposta({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await garantirWebhook("https://x/api", "seg")).toEqual({ ok: true, criado: true });
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      name: "foxlicita-whatsapp",
      url: "https://x/api",
      events: ["message.received"],
      secret: "seg",
      accountIds: ["conta-1"],
    });
  });
});
