import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const contar = vi.fn<(empresaId: string, usuarioId: string, de: Date, ate: Date) => Promise<number>>();
const ler = vi.fn<(id: string) => Promise<unknown>>();
vi.mock("@/db/propostas", () => ({
  contarPropostasDoAssistente: (empresaId: string, usuarioId: string, de: Date, ate: Date) => contar(empresaId, usuarioId, de, ate),
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

describe("restantesHoje", () => {
  beforeEach(() => {
    contar.mockReset();
    ler.mockReset();
  });

  it("conta só o dia de São Paulo da data injetada", async () => {
    const { restantesHoje } = await import("./cota");
    ler.mockResolvedValue(usuario("gestor", 3));
    contar.mockResolvedValue(2);
    const cota = await restantesHoje("u1", new Date("2026-11-13T02:30:00Z"));
    expect(cota).toEqual({ ilimitada: false, limite: 3, usadas: 2, restantes: 1 });
    const [, id, de, ate] = contar.mock.calls[0];
    expect(id).toBe("u1");
    expect(de.toISOString()).toBe("2026-11-12T03:00:00.000Z");
    expect(ate.toISOString()).toBe("2026-11-13T03:00:00.000Z");
  });

  it("dono é ilimitado e nem consulta o banco de propostas", async () => {
    const { restantesHoje } = await import("./cota");
    ler.mockResolvedValue(usuario("dono", 3));
    expect(await restantesHoje("u1")).toEqual({ ilimitada: true });
    expect(contar).not.toHaveBeenCalled();
  });

  it("limite editado por pessoa vale", async () => {
    const { restantesHoje } = await import("./cota");
    ler.mockResolvedValue(usuario("gestor", 10));
    contar.mockResolvedValue(3);
    expect(await restantesHoje("u1")).toMatchObject({ restantes: 7 });
  });

  it("pessoa inexistente fica sem cota", async () => {
    const { restantesHoje } = await import("./cota");
    ler.mockResolvedValue(null);
    expect(await restantesHoje("x")).toMatchObject({ restantes: 0 });
  });
});
