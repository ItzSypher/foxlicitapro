import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const contar = vi.fn<(empresaId: string, usuarioId: string, de: Date, ate: Date) => Promise<number>>();
const ler = vi.fn<(id: string) => Promise<unknown>>();
vi.mock("@/db/conselheiro", () => ({
  contarAnalisesDaPessoa: (empresaId: string, usuarioId: string, de: Date, ate: Date) => contar(empresaId, usuarioId, de, ate),
}));
vi.mock("@/db/usuarios", () => ({ lerUsuario: (id: string) => ler(id) }));

const usuario = (papel: string, limite: number) => ({
  id: "u1",
  nome: "Teste",
  email: "t@t.invalid",
  papel,
  ativo: true,
  empresaId: "e1",
  superadmin: false,
  permissoes: [],
  limitePropostasAssistenteDia: limite,
});

describe("analisesRestantesHoje", () => {
  beforeEach(() => {
    contar.mockReset();
    ler.mockReset();
  });

  it("conta o dia de São Paulo e multiplica o limite da pessoa", async () => {
    const { analisesRestantesHoje, ANALISES_POR_PROPOSTA } = await import("./cota");
    ler.mockResolvedValue(usuario("gestor", 3));
    contar.mockResolvedValue(4);
    const cota = await analisesRestantesHoje("u1", new Date("2026-11-13T02:30:00Z"));
    const limite = 3 * ANALISES_POR_PROPOSTA;
    expect(cota).toEqual({ ilimitada: false, limite, usadas: 4, restantes: limite - 4 });
    const [, , de, ate] = contar.mock.calls[0];
    expect(de.toISOString()).toBe("2026-11-12T03:00:00.000Z");
    expect(ate.toISOString()).toBe("2026-11-13T03:00:00.000Z");
  });

  it("dono é ilimitado; limite zero bloqueia; pessoa inexistente fica sem cota", async () => {
    const { analisesRestantesHoje } = await import("./cota");
    ler.mockResolvedValue(usuario("dono", 3));
    expect(await analisesRestantesHoje("u1")).toEqual({ ilimitada: true });
    expect(contar).not.toHaveBeenCalled();
    ler.mockResolvedValue(usuario("gestor", 0));
    contar.mockResolvedValue(0);
    expect(await analisesRestantesHoje("u1")).toMatchObject({ restantes: 0 });
    ler.mockResolvedValue(null);
    expect(await analisesRestantesHoje("x")).toMatchObject({ restantes: 0 });
  });
});
