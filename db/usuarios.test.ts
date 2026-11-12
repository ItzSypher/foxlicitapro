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
  let criadoId: string | null = null;

  beforeAll(async () => {
    m = await import("./usuarios");
  }, 30_000);

  afterAll(async () => {
    if (criadoId) await m.excluirUsuario(criadoId);
    const { sql } = await import("./client");
    await sql.end({ timeout: 5 });
  }, 30_000);

  it("cria, lê credenciais, troca a senha, desativa e apaga", async () => {
    const { hashSenha, verificarSenha } = await import("@/lib/auth");

    const criado = await m.criarUsuario({
      nome: "Pessoa de Teste",
      email: EMAIL.toUpperCase(),
      papel: "gestor",
      senhaHash: await hashSenha("senha-inicial-1"),
    });
    criadoId = criado.id;
    expect(criado).toMatchObject({ nome: "Pessoa de Teste", email: EMAIL, papel: "gestor", ativo: true });

    await expect(
      m.criarUsuario({ nome: "Outra", email: EMAIL, papel: "gestor", senhaHash: await hashSenha("x") }),
    ).rejects.toBeInstanceOf(m.EmailJaCadastrado);

    const credenciais = await m.lerCredenciais(EMAIL);
    expect(credenciais?.usuario.id).toBe(criado.id);
    expect(await verificarSenha("senha-inicial-1", credenciais?.senhaHash ?? "")).toBe(true);
    expect(await m.lerCredenciais("ninguem@teste.invalid")).toBeNull();

    expect(await m.definirSenhaUsuario(criado.id, await hashSenha("senha-nova-2"))).toBe(true);
    expect(await verificarSenha("senha-nova-2", (await m.lerSenhaHash(criado.id)) ?? "")).toBe(true);

    expect((await m.listarUsuariosAtivos()).some((u) => u.id === criado.id)).toBe(true);
    expect(await m.definirAtivo(criado.id, false)).toBe(true);
    expect((await m.lerUsuario(criado.id))?.ativo).toBe(false);
    expect((await m.listarUsuariosAtivos()).some((u) => u.id === criado.id)).toBe(false);
    expect((await m.listarUsuarios()).some((u) => u.id === criado.id)).toBe(true);
    expect(await m.emailsDosUsuarios([criado.id])).toEqual([]);

    expect(await m.excluirUsuario(criado.id)).toBe(true);
    criadoId = null;
    expect(await m.lerUsuario(criado.id)).toBeNull();
    expect(await m.excluirUsuario(criado.id)).toBe(false);
  }, 60_000);
});
