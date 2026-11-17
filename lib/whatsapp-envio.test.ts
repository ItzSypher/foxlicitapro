import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VinculoWa } from "@/db/whatsapp";

vi.mock("server-only", () => ({}));

const contadores = new Map<string, number>();
const m = vi.hoisted(() => ({
  enviarTexto: vi.fn(),
  zernioConfigurado: vi.fn(),
}));

vi.mock("@/lib/zernio", () => ({
  enviarTexto: m.enviarTexto,
  enviarTemplate: vi.fn(),
  zernioConfigurado: m.zernioConfigurado,
}));

vi.mock("@/db/whatsapp", () => ({
  somarContador: vi.fn(async (chave: string, n: number) => {
    const total = (contadores.get(chave) ?? 0) + n;
    contadores.set(chave, total);
    return total;
  }),
  descartarVencidos: vi.fn(),
  enfileirarAlertas: vi.fn(),
  lerVinculoPorUsuario: vi.fn(),
  listarPendentes: vi.fn(),
  marcarEnviados: vi.fn(),
  marcarTemplateEnviado: vi.fn(),
}));

const { enviarParaPessoa } = await import("@/lib/whatsapp-envio");

const AGORA = new Date("2026-11-17T15:00:00Z");

function vinculo(): VinculoWa {
  return {
    usuarioId: "u1",
    empresaId: "e1",
    nome: "Ana",
    papel: "dono",
    permissoes: [],
    whatsapp: "5521999990000",
    avisoWhatsapp: true,
    conversaId: "conv-1",
    ultimaEntrada: new Date(AGORA.getTime() - 60_000),
    ultimoTemplate: null,
  };
}

describe("tetos de envio do mês", () => {
  beforeEach(() => {
    contadores.clear();
    m.enviarTexto.mockReset().mockResolvedValue({ ok: true });
    m.zernioConfigurado.mockReturnValue(true);
  });

  it("alerta para no teto de alertas, mesmo crítico", async () => {
    contadores.set("alertas:2026-11", 300);
    expect(await enviarParaPessoa(vinculo(), "prazo", AGORA, { critico: true })).toBe(false);
    expect(m.enviarTexto).not.toHaveBeenCalled();
  });

  it("resposta ainda sai com o teto de alertas batido", async () => {
    contadores.set("alertas:2026-11", 300);
    expect(await enviarParaPessoa(vinculo(), "oi", AGORA, { resposta: true })).toBe(true);
    expect(contadores.get("alertas:2026-11")).toBe(300);
    expect(contadores.get("envios:2026-11")).toBe(1);
  });

  it("teto duro barra tudo, inclusive resposta", async () => {
    contadores.set("envios:2026-11", 900);
    expect(await enviarParaPessoa(vinculo(), "oi", AGORA, { resposta: true })).toBe(false);
    expect(m.enviarTexto).not.toHaveBeenCalled();
  });

  it("alerta enviado conta nos dois tetos", async () => {
    expect(await enviarParaPessoa(vinculo(), "prazo", AGORA)).toBe(true);
    expect(contadores.get("alertas:2026-11")).toBe(1);
    expect(contadores.get("envios:2026-11")).toBe(1);
  });

  it("janela fechada não envia", async () => {
    const v = { ...vinculo(), ultimaEntrada: new Date(AGORA.getTime() - 24 * 3_600_000) };
    expect(await enviarParaPessoa(v, "prazo", AGORA)).toBe(false);
  });
});
