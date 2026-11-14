import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { configEvolution, enviarWhatsapp, montarPedidoEvolution, whatsappConfigurado } from "./whatsapp";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function configurar() {
  vi.stubEnv("EVOLUTION_API_URL", "https://evolution.exemplo.invalid/");
  vi.stubEnv("EVOLUTION_INSTANCE", "painel");
  vi.stubEnv("EVOLUTION_API_KEY", "chave-secreta");
}

describe("configEvolution", () => {
  it("só ativa com as três variáveis", () => {
    expect(configEvolution({})).toBeNull();
    expect(configEvolution({ EVOLUTION_API_URL: "https://a.invalid", EVOLUTION_INSTANCE: "x" })).toBeNull();
    expect(configEvolution({ EVOLUTION_API_URL: "https://a.invalid", EVOLUTION_INSTANCE: "x", EVOLUTION_API_KEY: " " })).toBeNull();
    expect(configEvolution({ EVOLUTION_API_URL: "https://a.invalid///", EVOLUTION_INSTANCE: "x", EVOLUTION_API_KEY: "k" })).toEqual({
      url: "https://a.invalid",
      instancia: "x",
      chave: "k",
    });
  });
});

describe("montarPedidoEvolution", () => {
  it("monta o POST de sendText com a chave no cabeçalho apikey", () => {
    const pedido = montarPedidoEvolution({ url: "https://a.invalid", instancia: "minha instancia", chave: "k" }, "5521999990000", "Olá");
    expect(pedido.url).toBe("https://a.invalid/message/sendText/minha%20instancia");
    expect(pedido.init.method).toBe("POST");
    expect(pedido.init.headers).toEqual({ apikey: "k", "Content-Type": "application/json" });
    expect(JSON.parse(String(pedido.init.body))).toEqual({ number: "5521999990000", text: "Olá" });
  });
});

describe("enviarWhatsapp", () => {
  it("sem as variáveis não envia e não quebra", async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    expect(whatsappConfigurado()).toBe(false);
    expect(await enviarWhatsapp("5521999990000", "x")).toEqual({ ok: false, erro: "whatsapp não configurado" });
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("envia pelo fetch com o pedido da Evolution", async () => {
    configurar();
    const fetchFalso = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal("fetch", fetchFalso);
    expect(whatsappConfigurado()).toBe(true);
    expect(await enviarWhatsapp("5521999990000", "Disputa em 5 h")).toEqual({ ok: true });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://evolution.exemplo.invalid/message/sendText/painel");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ apikey: "chave-secreta" });
    expect(JSON.parse(String(init.body))).toEqual({ number: "5521999990000", text: "Disputa em 5 h" });
  });

  it("registra a falha em vez de lançar", async () => {
    configurar();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    expect(await enviarWhatsapp("5521999990000", "x")).toEqual({ ok: false, erro: "falha 401" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede fora")));
    expect(await enviarWhatsapp("5521999990000", "x")).toEqual({ ok: false, erro: "rede fora" });
  });
});
