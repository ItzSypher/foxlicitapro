import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local: o teste é pulado abaixo
}

/** Pula também enquanto a migration 019 não foi aplicada no banco. */
describe.skipIf(!process.env.DATABASE_URL)("conversas do chat no banco", () => {
  type Modulo = typeof import("./conselheiro-conversas");
  let m: Modulo;
  let pronto = false;
  let E = "";
  let E2 = "";
  let pessoa = "";
  let outra = "";
  let limpar: (id: string) => Promise<void> = async () => undefined;

  beforeAll(async () => {
    const { sql } = await import("./client");
    const [tabela] = await sql<{ existe: boolean }[]>`select to_regclass('public.conselheiro_conversas') is not null as existe`;
    pronto = tabela?.existe === true;
    if (!pronto) return;
    m = await import("./conselheiro-conversas");
    const t = await import("./empresa-teste");
    const u = await import("./usuarios");
    limpar = t.removerEmpresaDeTeste;
    E = await t.criarEmpresaDeTeste();
    E2 = await t.criarEmpresaDeTeste();
    const marca = Date.now();
    pessoa = (await u.criarUsuario({ empresaId: E, nome: "Gestor", email: `conv-a-${marca}@teste.invalid`, papel: "gestor", senhaHash: "x" })).id;
    outra = (await u.criarUsuario({ empresaId: E, nome: "Jurídico", email: `conv-b-${marca}@teste.invalid`, papel: "gestor", senhaHash: "x" })).id;
  }, 30_000);

  afterAll(async () => {
    if (E) await limpar(E);
    if (E2) await limpar(E2);
    const { sql } = await import("./client");
    await sql.end({ timeout: 5 });
  }, 30_000);

  it("grava trocas, continua, lista e apaga só as da pessoa", async (ctx) => {
    if (!pronto) ctx.skip();

    const id = await m.registrarTroca(E, pessoa, { conversaId: null, pergunta: "Vale a pena a dispensa de toner?", resposta: "Vale.", rota: "/pipeline" });
    const mesmo = await m.registrarTroca(E, pessoa, { conversaId: id, pergunta: "E o prazo?", resposta: "Cinco dias.", rota: "/pipeline" });
    expect(mesmo).toBe(id);

    const aberta = await m.lerConversa(E, pessoa, id);
    expect(aberta?.titulo).toBe("Vale a pena a dispensa de toner?");
    expect(aberta?.mensagens).toEqual([
      { papel: "usuario", texto: "Vale a pena a dispensa de toner?" },
      { papel: "assistente", texto: "Vale." },
      { papel: "usuario", texto: "E o prazo?" },
      { papel: "assistente", texto: "Cinco dias." },
    ]);

    const lista = await m.listarConversas(E, pessoa);
    expect(lista.map((c) => [c.id, c.mensagens])).toEqual([[id, 4]]);

    // Outra pessoa da empresa e outra empresa não veem, não continuam e não apagam.
    expect(await m.listarConversas(E, outra)).toEqual([]);
    expect(await m.lerConversa(E, outra, id)).toBeNull();
    expect(await m.lerConversa(E2, pessoa, id)).toBeNull();
    expect(await m.apagarConversa(E, outra, id)).toBe(false);
    const nova = await m.registrarTroca(E, outra, { conversaId: id, pergunta: "Posso ver?", resposta: "Não.", rota: "/" });
    expect(nova).not.toBe(id);
    expect((await m.lerConversa(E, pessoa, id))?.mensagens).toHaveLength(4);

    expect(await m.apagarConversa(E, pessoa, id)).toBe(true);
    expect(await m.lerConversa(E, pessoa, id)).toBeNull();
    expect(await m.apagarConversa(E, pessoa, id)).toBe(false);
  }, 30_000);
});
