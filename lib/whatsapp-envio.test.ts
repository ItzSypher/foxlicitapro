import { beforeEach, describe, expect, it, vi } from "vitest";
import { escolhasDoPerfil, type AlertaWa } from "@/core/whatsapp-alertas";
import type { AlertaPendente, VinculoWa } from "@/db/whatsapp";

vi.mock("server-only", () => ({}));

const contadores = new Map<string, number>();
const m = vi.hoisted(() => ({
  enviarTexto: vi.fn(),
  zernioConfigurado: vi.fn(),
  enfileirarAlertas: vi.fn(),
  lerVinculoPorUsuario: vi.fn(),
  lerResponsavelPadrao: vi.fn(),
  listarPendentes: vi.fn(),
  marcarEnviados: vi.fn(),
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
  enfileirarAlertas: m.enfileirarAlertas,
  lerResponsavelPadrao: m.lerResponsavelPadrao,
  lerVinculoPorUsuario: m.lerVinculoPorUsuario,
  listarPendentes: m.listarPendentes,
  marcarEnviados: m.marcarEnviados,
  marcarTemplateEnviado: vi.fn(),
}));

const { entregarAlertasWa, enviarFila, enviarParaPessoa } = await import("@/lib/whatsapp-envio");

// 12h em São Paulo
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
    escolhas: escolhasDoPerfil("operacional"),
  };
}

describe("tetos de envio do mês", () => {
  beforeEach(() => {
    contadores.clear();
    m.enviarTexto.mockReset().mockResolvedValue({ ok: true });
    m.zernioConfigurado.mockReturnValue(true);
  });

  it("teto de alertas padrão é 150 e vale mesmo para o crítico", async () => {
    contadores.set("alertas:2026-11", 149);
    expect(await enviarParaPessoa(vinculo(), "prazo", AGORA, { critico: true })).toBe(true);
  });

  it("alerta para no teto de alertas, mesmo crítico", async () => {
    contadores.set("alertas:2026-11", 150);
    expect(await enviarParaPessoa(vinculo(), "prazo", AGORA, { critico: true })).toBe(false);
    expect(m.enviarTexto).not.toHaveBeenCalled();
  });

  it("resposta ainda sai com o teto de alertas batido", async () => {
    contadores.set("alertas:2026-11", 150);
    expect(await enviarParaPessoa(vinculo(), "oi", AGORA, { resposta: true })).toBe(true);
    expect(contadores.get("alertas:2026-11")).toBe(150);
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

function alerta(parcial: Partial<AlertaWa> & { tipo: AlertaWa["tipo"] }): AlertaWa {
  return { usuarioId: "u1", chave: `${parcial.tipo}:i1`, texto: `texto ${parcial.tipo}`, itemId: "i1", validade: null, ...parcial };
}

function pendente(a: AlertaWa, id: string): AlertaPendente {
  return { id, tipo: a.tipo, texto: a.texto, itemId: a.itemId };
}

describe("entrega dos alertas", () => {
  beforeEach(() => {
    contadores.clear();
    vi.clearAllMocks();
    m.enviarTexto.mockResolvedValue({ ok: true });
    m.zernioConfigurado.mockReturnValue(true);
    m.lerVinculoPorUsuario.mockResolvedValue(vinculo());
    m.lerResponsavelPadrao.mockResolvedValue({ id: "u2", nome: "Paulo Henrique" });
    m.enfileirarAlertas.mockImplementation(async (_empresa: string, lista: AlertaWa[]) => lista);
  });

  it("prazo urgente sai na hora com o botão do responsável padrão", async () => {
    const prazo = alerta({ tipo: "prazo24" });
    m.listarPendentes.mockResolvedValue([pendente(prazo, "p1")]);
    const r = await entregarAlertasWa("e1", [prazo], AGORA);
    expect(r).toEqual({ novos: 1, enviados: 1 });
    const botoes = m.enviarTexto.mock.calls[0]?.[2] as Array<{ titulo: string }>;
    expect(botoes.map((b) => b.titulo)).toContain("Atribuir a Paulo");
    expect(m.marcarEnviados).toHaveBeenCalledWith(["p1"], AGORA);
  });

  it("aviso entra na fila e espera o resumo da manhã", async () => {
    const aviso = alerta({ tipo: "aviso", itemId: null, chave: "aviso:x" });
    const r = await entregarAlertasWa("e1", [aviso], AGORA);
    expect(r).toEqual({ novos: 1, enviados: 0 });
    expect(m.enfileirarAlertas).toHaveBeenCalledWith("e1", [aviso]);
    expect(m.enviarTexto).not.toHaveBeenCalled();
  });

  it("acompanhamento não recebe prazo nem aviso, nem na fila", async () => {
    m.lerVinculoPorUsuario.mockResolvedValue({ ...vinculo(), escolhas: escolhasDoPerfil("acompanhamento") });
    const r = await entregarAlertasWa("e1", [alerta({ tipo: "prazo2" }), alerta({ tipo: "aviso", chave: "aviso:x" })], AGORA);
    expect(r).toEqual({ novos: 0, enviados: 0 });
    expect(m.enfileirarAlertas).not.toHaveBeenCalled();
    expect(m.enviarTexto).not.toHaveBeenCalled();
  });

  it("tipos antigos (Radar, etapa, sem responsável, 48 h) não entram mais", async () => {
    const lista = (["radar", "etapa", "sem_responsavel", "prazo48"] as const).map((tipo) => alerta({ tipo }));
    expect(await entregarAlertasWa("e1", lista, AGORA)).toEqual({ novos: 0, enviados: 0 });
    expect(m.enfileirarAlertas).not.toHaveBeenCalled();
  });

  it("quem escreve recebe só o urgente da fila, não os avisos", async () => {
    const prazo = alerta({ tipo: "prazo2" });
    const aviso = alerta({ tipo: "aviso", itemId: null, chave: "aviso:x" });
    m.listarPendentes.mockResolvedValue([pendente(aviso, "a1"), pendente(prazo, "p1")]);
    expect(await enviarFila(vinculo(), AGORA)).toBe(true);
    expect(m.enviarTexto).toHaveBeenCalledTimes(1);
    expect(m.enviarTexto.mock.calls[0]?.[1]).toBe(prazo.texto);
    expect(m.marcarEnviados).toHaveBeenCalledWith(["p1"], AGORA);
  });

  it("quem escreve sem urgente na fila não recebe nada", async () => {
    m.listarPendentes.mockResolvedValue([pendente(alerta({ tipo: "aviso", itemId: null }), "a1")]);
    expect(await enviarFila(vinculo(), AGORA)).toBe(false);
    expect(m.enviarTexto).not.toHaveBeenCalled();
    expect(m.marcarEnviados).not.toHaveBeenCalled();
  });
});
