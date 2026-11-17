import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemPipeline } from "@/components/pipeline/tipos";
import type { MensagemRecebida } from "@/core/whatsapp-alertas";
import type { VinculoWa } from "@/db/whatsapp";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  ativarPorCodigo: vi.fn(),
  lerVinculoPorNumero: vi.fn(),
  registrarEntrada: vi.fn(),
  definirAvisoWhatsapp: vi.fn(),
  gravarPendencia: vi.fn(),
  lerPendencia: vi.fn(),
  apagarPendencia: vi.fn(),
  listarPipeline: vi.fn(),
  moverItem: vi.fn(),
  definirResponsavel: vi.fn(),
  enviarParaPessoa: vi.fn(),
  enviarFila: vi.fn(),
  enviarTexto: vi.fn(),
  mostrarDigitando: vi.fn(),
  gerarTexto: vi.fn(),
  assistenteDisponivel: vi.fn(),
  registrarMensagem: vi.fn(),
  montarSistemaDoChat: vi.fn(),
}));

vi.mock("@/db/whatsapp", () => ({
  ativarPorCodigo: m.ativarPorCodigo,
  lerVinculoPorNumero: m.lerVinculoPorNumero,
  registrarEntrada: m.registrarEntrada,
  definirAvisoWhatsapp: m.definirAvisoWhatsapp,
  gravarPendencia: m.gravarPendencia,
  lerPendencia: m.lerPendencia,
  apagarPendencia: m.apagarPendencia,
}));
vi.mock("@/db/pipeline", () => ({
  ErroRevisaoJuridica: class ErroRevisaoJuridica extends Error {},
  listarPipeline: m.listarPipeline,
  moverItem: m.moverItem,
  definirResponsavel: m.definirResponsavel,
}));
vi.mock("@/lib/whatsapp-envio", () => ({ enviarParaPessoa: m.enviarParaPessoa, enviarFila: m.enviarFila }));
vi.mock("@/lib/zernio", () => ({ enviarTexto: m.enviarTexto, mostrarDigitando: m.mostrarDigitando }));
vi.mock("@/lib/gemini", () => ({ gerarTexto: m.gerarTexto, assistenteDisponivel: m.assistenteDisponivel }));
vi.mock("@/lib/assistente/limite", () => ({ registrarMensagem: m.registrarMensagem }));
vi.mock("@/lib/assistente/contexto", () => ({ montarSistemaDoChat: m.montarSistemaDoChat }));

import { processarMensagem } from "./whatsapp-agente";

const AGORA = new Date("2026-11-16T15:00:00Z");

function mensagem(texto: string, payloadBotao: string | null = null): MensagemRecebida {
  return { eventoId: "e1", contaId: null, conversationId: "conv-1", remetente: "5511999990000", nome: "Ana", texto, payloadBotao };
}

function vinculo(sobra: Partial<VinculoWa> = {}): VinculoWa {
  return {
    usuarioId: "u1",
    empresaId: "emp1",
    nome: "Ana Souza",
    papel: "gestor",
    permissoes: ["mover_pipeline", "usar_assistente"],
    whatsapp: "5511999990000",
    avisoWhatsapp: true,
    conversaId: "conv-0",
    ultimaEntrada: null,
    ultimoTemplate: null,
    ...sobra,
  };
}

function item(id: string, etapa: ItemPipeline["etapa"] = "radar"): ItemPipeline {
  return {
    id,
    etapa,
    item: { objeto: `Objeto do item ${id}`, dataEncerramento: "2026-11-18T15:00:00Z" },
  } as unknown as ItemPipeline;
}

function textosEnviados(): string[] {
  return m.enviarParaPessoa.mock.calls.map((c) => String(c[1]));
}

beforeEach(() => {
  vi.clearAllMocks();
  m.enviarParaPessoa.mockResolvedValue(true);
  m.enviarFila.mockResolvedValue(false);
  m.lerVinculoPorNumero.mockResolvedValue(vinculo());
  m.listarPipeline.mockResolvedValue([item("i1")]);
  m.assistenteDisponivel.mockReturnValue(true);
  m.registrarMensagem.mockReturnValue({ permitido: true, tentarEmMs: 0 });
  m.montarSistemaDoChat.mockResolvedValue("SISTEMA");
});

describe("processarMensagem", () => {
  it("sem vínculo: não responde (número compartilhado com o atendimento) e não grava nada", async () => {
    m.lerVinculoPorNumero.mockResolvedValue(null);
    await processarMensagem(mensagem("oi"), AGORA);
    expect(m.enviarTexto).not.toHaveBeenCalled();
    expect(m.registrarEntrada).not.toHaveBeenCalled();
    expect(m.enviarParaPessoa).not.toHaveBeenCalled();
  });

  it("ativar com código válido: confirma com o primeiro nome e manda a fila", async () => {
    m.ativarPorCodigo.mockResolvedValue({ ok: true, vinculo: vinculo() });
    await processarMensagem(mensagem("ATIVAR ABC234"), AGORA);
    expect(m.ativarPorCodigo).toHaveBeenCalledWith("ABC234", "5511999990000", "conv-1", AGORA);
    expect(textosEnviados()[0]).toContain("Alertas ligados, Ana.");
    expect(m.enviarFila).toHaveBeenCalledTimes(1);
  });

  it("ativar com código inválido ou número em uso", async () => {
    m.ativarPorCodigo.mockResolvedValueOnce({ ok: false, motivo: "codigo" });
    await processarMensagem(mensagem("ativar abc234"), AGORA);
    expect(String(m.enviarTexto.mock.calls[0]?.[1])).toContain("Código inválido ou vencido");
    m.ativarPorCodigo.mockResolvedValueOnce({ ok: false, motivo: "numero_em_uso" });
    await processarMensagem(mensagem("ativar abc234"), AGORA);
    expect(String(m.enviarTexto.mock.calls[1]?.[1])).toContain("já está ligado a outra pessoa");
    expect(m.enviarFila).not.toHaveBeenCalled();
  });

  it("parar: desliga o aviso e não manda a fila", async () => {
    await processarMensagem(mensagem("Parar"), AGORA);
    expect(m.registrarEntrada).toHaveBeenCalledWith("u1", "conv-1", AGORA);
    expect(m.definirAvisoWhatsapp).toHaveBeenCalledWith("u1", false);
    expect(textosEnviados()[0]).toContain("Alertas pausados");
    expect(m.enviarFila).not.toHaveBeenCalled();
  });

  it("botão atribuir sem permissão: recusa e não mexe no pipeline", async () => {
    m.lerVinculoPorNumero.mockResolvedValue(vinculo({ papel: "juridico", permissoes: ["revisao_juridica"] }));
    await processarMensagem(mensagem("", "atr:i1"), AGORA);
    expect(m.definirResponsavel).not.toHaveBeenCalled();
    expect(textosEnviados()[0]).toContain("não pode mexer no pipeline");
  });

  it("botão atribuir com permissão: define o responsável", async () => {
    m.definirResponsavel.mockResolvedValue({ existe: true, mudou: true });
    await processarMensagem(mensagem("", "atr:i1"), AGORA);
    expect(m.definirResponsavel).toHaveBeenCalledWith("emp1", "i1", "u1");
    expect(textosEnviados()[0]).toContain("✅ Feito");
  });

  it("pendência: sim executa e apaga; não cancela; sem pendência avisa", async () => {
    m.lerPendencia.mockResolvedValueOnce({ tipo: "participar", itemId: "i1" });
    await processarMensagem(mensagem("Sim"), AGORA);
    expect(m.moverItem).toHaveBeenCalledWith("emp1", "i1", "analisando", undefined, "u1");
    expect(m.apagarPendencia).toHaveBeenCalledWith("u1");
    expect(textosEnviados()[0]).toContain("✅ Feito");

    m.lerPendencia.mockResolvedValueOnce(null);
    await processarMensagem(mensagem("", "sim"), AGORA);
    expect(textosEnviados()[1]).toContain("Não tenho nada esperando confirmação");

    await processarMensagem(mensagem("Não"), AGORA);
    expect(m.apagarPendencia).toHaveBeenCalledTimes(2);
    expect(textosEnviados()[2]).toContain("Ok, não mudei nada");
  });

  it("linha ACAO do assistente vira pendência com Confirma? e botões", async () => {
    m.gerarTexto.mockResolvedValue("Posso levar o item i1 para análise.\nACAO: part i1");
    await processarMensagem(mensagem("quero participar do i1"), AGORA);
    expect(m.gravarPendencia).toHaveBeenCalledWith("u1", { tipo: "participar", itemId: "i1" }, new Date(AGORA.getTime() + 10 * 60_000));
    const chamada = m.enviarParaPessoa.mock.calls[0];
    expect(String(chamada?.[1])).toBe("Posso levar o item i1 para análise.\n\nConfirma?");
    expect(chamada?.[3]).toEqual({
      resposta: true,
      botoes: [
        { titulo: "Sim", payload: "sim" },
        { titulo: "Não", payload: "nao" },
      ],
    });
    expect(m.moverItem).not.toHaveBeenCalled();
  });

  it("ACAO para item que não é da empresa é ignorada", async () => {
    m.gerarTexto.mockResolvedValue("Ok.\nACAO: desc outro");
    await processarMensagem(mensagem("descarta o outro"), AGORA);
    expect(m.gravarPendencia).not.toHaveBeenCalled();
    expect(textosEnviados()[0]).toBe("Ok.");
  });

  it("falha do assistente responde em uma linha e não lança", async () => {
    m.gerarTexto.mockRejectedValue(new Error("falhou"));
    await expect(processarMensagem(mensagem("e aí?"), AGORA)).resolves.toBeUndefined();
    expect(textosEnviados()[0]).toBe("Não consegui responder agora. Tente de novo em instantes.");
  });

  it("ignora mensagem da própria conta", async () => {
    await processarMensagem({ ...mensagem("oi"), remetente: "5521969418669" }, AGORA);
    expect(m.lerVinculoPorNumero).not.toHaveBeenCalled();
  });
});
