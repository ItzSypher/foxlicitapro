import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local: o teste é pulado abaixo
}

const EMAIL = `teste-${Date.now()}@teste.invalid`;

describe.skipIf(!process.env.DATABASE_URL)("usuários no banco", () => {
  type Modulo = typeof import("./usuarios");
  let m: Modulo;
  let E = "";
  let E2 = "";
  let limpar: (id: string) => Promise<void> = async () => undefined;

  beforeAll(async () => {
    m = await import("./usuarios");
    const t = await import("./empresa-teste");
    limpar = t.removerEmpresaDeTeste;
    E = await t.criarEmpresaDeTeste();
    E2 = await t.criarEmpresaDeTeste();
  }, 30_000);

  afterAll(async () => {
    await limpar(E);
    await limpar(E2);
    const { sql } = await import("./client");
    await sql.end({ timeout: 5 });
  }, 30_000);

  it("cria, lê credenciais, troca a senha, desativa e apaga", async () => {
    const { hashSenha, verificarSenha } = await import("@/lib/auth");

    const criado = await m.criarUsuario({
      empresaId: E,
      nome: "Pessoa de Teste",
      email: EMAIL.toUpperCase(),
      papel: "gestor",
      senhaHash: await hashSenha("senha-inicial-1"),
    });
    expect(criado).toMatchObject({ nome: "Pessoa de Teste", email: EMAIL, papel: "gestor", ativo: true });

    await expect(
      m.criarUsuario({ empresaId: E, nome: "Outra", email: EMAIL, papel: "gestor", senhaHash: await hashSenha("x") }),
    ).rejects.toBeInstanceOf(m.EmailJaCadastrado);

    const credenciais = await m.lerCredenciais(EMAIL);
    expect(credenciais?.usuario.id).toBe(criado.id);
    expect(await verificarSenha("senha-inicial-1", credenciais?.senhaHash ?? "")).toBe(true);
    expect(await m.lerCredenciais("ninguem@teste.invalid")).toBeNull();

    expect(await m.definirSenhaUsuario(E, criado.id, await hashSenha("senha-nova-2"))).toBe(true);
    expect(await verificarSenha("senha-nova-2", (await m.lerSenhaHash(criado.id)) ?? "")).toBe(true);

    expect((await m.listarUsuariosAtivos(E)).some((u) => u.id === criado.id)).toBe(true);
    expect(await m.definirAtivo(E, criado.id, false)).toBe(true);
    expect((await m.lerUsuario(criado.id))?.ativo).toBe(false);
    expect((await m.listarUsuariosAtivos(E)).some((u) => u.id === criado.id)).toBe(false);
    expect((await m.listarUsuarios(E)).some((u) => u.id === criado.id)).toBe(true);
    expect(await m.emailsDosUsuarios(E, [criado.id])).toEqual([]);

    // Outra empresa não enxerga nem mexe na pessoa.
    expect((await m.listarUsuarios(E2)).some((u) => u.id === criado.id)).toBe(false);
    expect(await m.lerUsuarioDaEmpresa(E2, criado.id)).toBeNull();
    expect(await m.excluirUsuario(E2, criado.id)).toBe(false);
    expect(await m.definirAtivo(E2, criado.id, true)).toBe(false);

    expect(await m.excluirUsuario(E, criado.id)).toBe(true);
    expect(await m.lerUsuario(criado.id)).toBeNull();
    expect(await m.excluirUsuario(E, criado.id)).toBe(false);
  }, 60_000);
});
