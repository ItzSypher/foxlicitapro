import { describe, expect, it } from "vitest";
import {
  criarToken,
  gerarSenhaInicial,
  hashSenha,
  lerToken,
  textosIguais,
  verificarSenha,
  DURACAO_SESSAO_SEGUNDOS,
} from "./auth";
import type { SessaoToken } from "@/core/types-equipe";

const SEGREDO = "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres";
const sessao: SessaoToken = { usuarioId: "6f1d9c1e-0000-4000-8000-000000000001", nome: "Arthur Silva Moura", papel: "dono" };

describe("senha com scrypt", () => {
  it("gera o formato esperado e confere a senha certa", async () => {
    const hash = await hashSenha("uma senha de teste");
    const partes = hash.split("$");
    expect(partes.slice(0, 4)).toEqual(["scrypt", "16384", "8", "1"]);
    expect(partes).toHaveLength(6);
    expect(await verificarSenha("uma senha de teste", hash)).toBe(true);
  });

  it("recusa a senha errada e hash malformado", async () => {
    const hash = await hashSenha("certa");
    expect(await verificarSenha("errada", hash)).toBe(false);
    expect(await verificarSenha("certa", "texto qualquer")).toBe(false);
    expect(await verificarSenha("certa", "scrypt$16384$8$1$abc")).toBe(false);
    expect(await verificarSenha("certa", "scrypt$999999999$8$1$YWJj$YWJj")).toBe(false);
  });

  it("usa sal diferente a cada hash", async () => {
    expect(await hashSenha("igual")).not.toBe(await hashSenha("igual"));
  });
});

describe("utilitários", () => {
  it("compara textos em tempo constante", () => {
    expect(textosIguais("abc", "abc")).toBe(true);
    expect(textosIguais("abc", "abd")).toBe(false);
    expect(textosIguais("abc", "abcd")).toBe(false);
  });

  it("gera senha inicial sem caracteres ambíguos", () => {
    const senha = gerarSenhaInicial();
    expect(senha).toHaveLength(14);
    expect(senha).toMatch(/^[a-zA-Z2-9]+$/);
    expect(senha).not.toMatch(/[0OIl1]/);
  });
});

describe("token de sessão", () => {
  it("aceita um token válido e devolve a sessão", async () => {
    const token = await criarToken(SEGREDO, sessao, 1_000);
    expect(await lerToken(token, SEGREDO, 2_000)).toEqual(sessao);
  });

  it("preserva acentos no nome", async () => {
    const token = await criarToken(SEGREDO, { ...sessao, nome: "João Conceição" });
    expect((await lerToken(token, SEGREDO))?.nome).toBe("João Conceição");
  });

  it("recusa token vencido", async () => {
    const token = await criarToken(SEGREDO, sessao, 1_000);
    const depois = 1_000 + DURACAO_SESSAO_SEGUNDOS * 1000 + 1;
    expect(await lerToken(token, SEGREDO, depois)).toBeNull();
  });

  it("recusa token adulterado (carga ou assinatura) e segredo diferente", async () => {
    const token = await criarToken(SEGREDO, sessao);
    const [carga, assinatura] = token.split(".");
    const outraCarga = Buffer.from(JSON.stringify({ u: sessao.usuarioId, p: "dono", n: "Outro", e: Date.now() + 1e9 })).toString("base64url");
    expect(await lerToken(`${outraCarga}.${assinatura}`, SEGREDO)).toBeNull();
    expect(await lerToken(`${carga}.${assinatura}x`, SEGREDO)).toBeNull();
    expect(await lerToken(token, "outro-segredo-qualquer-com-tamanho-suficiente")).toBeNull();
  });

  it("recusa ausência de token, de segredo e formatos estranhos", async () => {
    const token = await criarToken(SEGREDO, sessao);
    expect(await lerToken(undefined, SEGREDO)).toBeNull();
    expect(await lerToken(token, undefined)).toBeNull();
    expect(await lerToken("a.b.c", SEGREDO)).toBeNull();
    expect(await lerToken("", SEGREDO)).toBeNull();
  });
});
