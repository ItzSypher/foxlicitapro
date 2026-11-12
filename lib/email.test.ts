import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { enviarEmail, linkAbsoluto, montarEmail } from "./email";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("enviarEmail", () => {
  it("sem as variáveis não envia e não quebra", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("RESEND_FROM", "");
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    expect(await enviarEmail({ para: ["a@teste.invalid"], assunto: "x", html: "<p>x</p>", texto: "x" })).toEqual({
      ok: false,
      erro: "e-mail não configurado",
    });
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("envia ao Resend com chave e remetente", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_teste");
    vi.stubEnv("RESEND_FROM", "Teste <avisos@teste.invalid>");
    const fetchFalso = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchFalso);
    const r = await enviarEmail({ para: ["a@teste.invalid", "a@teste.invalid"], assunto: "Oi", html: "<p>oi</p>", texto: "oi" });
    expect(r).toEqual({ ok: true });
    const [url, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_teste");
    expect(JSON.parse(String(init.body))).toMatchObject({ to: ["a@teste.invalid"], subject: "Oi" });
  });

  it("devolve o erro da API sem lançar", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_teste");
    vi.stubEnv("RESEND_FROM", "avisos@teste.invalid");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "domínio não verificado" }), { status: 403 })));
    expect(await enviarEmail({ para: ["a@teste.invalid"], assunto: "x", html: "x", texto: "x" })).toEqual({
      ok: false,
      erro: "domínio não verificado",
    });
  });
});

describe("modelo do e-mail", () => {
  it("usa a base padrão ou APP_URL e escapa o texto", () => {
    vi.stubEnv("APP_URL", "");
    expect(linkAbsoluto("/propostas/1")).toBe("https://licitapro.foxtisolutions.com.br/propostas/1");
    vi.stubEnv("APP_URL", "https://exemplo.teste/");
    expect(linkAbsoluto("/pipeline")).toBe("https://exemplo.teste/pipeline");

    const { html, texto } = montarEmail({
      titulo: "Proposta devolvida",
      paragrafos: ['Ana devolveu "<b>x</b>".'],
      destaque: "Corrigir o prazo",
      botao: { rotulo: "Abrir proposta", caminho: "/propostas/1" },
    });
    expect(html).toContain("#F57E11");
    expect(html).toContain("raposa.svg");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<b>x</b>");
    expect(texto).toContain("https://exemplo.teste/propostas/1");
    expect(`${html}${texto}`).not.toMatch(/\b(IA|Claude|Gemini)\b/);
  });
});
