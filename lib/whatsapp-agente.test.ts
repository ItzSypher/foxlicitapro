import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemPipeline } from "@/components/pipeline/tipos";
import { escolhasDoPerfil, type MensagemRecebida } from "@/core/whatsapp-alertas";
import type { VinculoWa } from "@/db/whatsapp";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  ativarPorCodigo: vi.fn(),
  lerVinculoPorNumero: vi.fn(),
  registrarEntrada: vi.fn(),
  definirAvisoWhatsapp: vi.fn(),
  gravarPendencia: vi.fn(),
  lerPendencia: vi.fn(),
  lerResponsavelPadrao: vi.fn(),
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
  adicionarChave: vi.fn(),
  enviarResumoAtrasado: vi.fn(),
  gerarPropostaPeloWhatsapp: vi.fn(),
  aprovarPropostaPeloWhatsapp: vi.fn(),
}));

vi.mock("@/db/whatsapp", () => ({
  ativarPorCodigo: m.ativarPorCodigo,
  lerVinculoPorNumero: m.lerVinculoPorNumero,
  registrarEntrada: m.registrarEntrada,
  definirAvisoWhatsapp: m.definirAvisoWhatsapp,
  gravarPendencia: m.gravarPendencia,
  lerPendencia: m.lerPendencia,
  lerResponsavelPadrao: m.lerResponsavelPadrao,
  apagarPendencia: m.apagarPendencia,
}));
vi.mock("@/db/pipeline", () => ({
  ErroRevisaoJuridica: class ErroRevisaoJuridica extends Error {},
  listarPipeline: m.listarPipeline,
  moverItem: m.moverItem,
  definirResponsavel: m.definirResponsavel,
}));
vi.mock("@/lib/whatsapp-envio", () => ({ enviarParaPessoa: m.enviarParaPessoa, enviarFila: m.enviarFila }));
vi.mock("@/lib/whatsapp-alertas-cron", () => ({ enviarResumoAtrasado: m.enviarResumoAtrasado }));
vi.mock("@/lib/whatsapp-propostas", () => ({
  gerarPropostaPeloWhatsapp: m.gerarPropostaPeloWhatsapp,
  aprovarPropostaPeloWhatsapp: m.aprovarPropostaPeloWhatsapp,
}));
vi.mock("@/lib/zernio", () => ({ enviarTexto: m.enviarTexto, mostrarDigitando: m.mostrarDigitando }));
vi.mock("@/lib/gemini", () => ({ gerarTexto: m.gerarTexto, assistenteDisponivel: m.assistenteDisponivel }));
vi.mock("@/lib/assistente/limite", () => ({ registrarMensagem: m.registrarMensagem }));
vi.mock("@/lib/adicionar-pelo-link", () => ({ adicionarChave: m.adicionarChave }));
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
    escolhas: escolhasDoPerfil("operacional"),
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
  m.lerResponsavelPadrao.mockResolvedValue(null);
  m.lerVinculoPorNumero.mockResolvedValue(vinculo());
  m.listarPipeline.mockResolvedValue([item("i1")]);
  m.assistenteDisponivel.mockReturnValue(true);
  m.registrarMensagem.mockReturnValue({ permitido: true, tentarEmMs: 0 });
  m.montarSistemaDoChat.mockResolvedValue("SISTEMA");
  m.enviarResumoAtrasado.mockResolvedValue(false);
});

describe("processarMensagem", () => {
  it("sem vínculo: não responde (número compartilhado com o atendimento) e não grava nada", async () => {
    m.lerVinculoPorNumero.mockResolvedValue(null);
    await processarMensagem(mensagem("oi"), AGORA);
    expect(m.enviarTexto).not.toHaveBeenCalled();
    expect(m.registrarEntrada).not.toHaveBeenCalled();
    expect(m.enviarParaPessoa).not.toHaveBeenCalled();
  });

  it("ativar com código válido: confirma com o primeiro nome e manda só o urgente da fila", async () => {
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

  it("botão atribuir sem responsável padrão: o item fica com quem tocou", async () => {
    m.definirResponsavel.mockResolvedValue({ existe: true, mudou: true });
    await processarMensagem(mensagem("", "atr:i1"), AGORA);
    expect(m.definirResponsavel).toHaveBeenCalledWith("emp1", "i1", "u1");
    expect(textosEnviados()[0]).toContain("agora é seu");
  });

  it("botão atribuir com responsável padrão: o item vai para ele", async () => {
    m.lerResponsavelPadrao.mockResolvedValue({ id: "u2", nome: "Paulo Henrique" });
    m.definirResponsavel.mockResolvedValue({ existe: true, mudou: true });
    await processarMensagem(mensagem("", "atr:i1"), AGORA);
    expect(m.definirResponsavel).toHaveBeenCalledWith("emp1", "i1", "u2");
    expect(textosEnviados()[0]).toContain("agora está com Paulo.");
  });

  it("quem é o responsável padrão e toca atribuir recebe o item como seu", async () => {
    m.lerResponsavelPadrao.mockResolvedValue({ id: "u1", nome: "Ana Souza" });
    m.definirResponsavel.mockResolvedValue({ existe: true, mudou: true });
    await processarMensagem(mensagem("", "atr:i1"), AGORA);
    expect(m.definirResponsavel).toHaveBeenCalledWith("emp1", "i1", "u1");
    expect(textosEnviados()[0]).toContain("agora é seu");
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
    const texto = textosEnviados()[0] ?? "";
    expect(texto).toContain("Prazos dos próximos 7 dias");
    expect(texto).toContain("*gerar N*");
    expect(texto).toContain("O assistente está ocupado; tente a pergunta de novo em alguns minutos.");
  });

  it("saudação não chama o modelo: responde com prazos e comandos", async () => {
    for (const oi of ["alô", "Bom dia", "oi"]) await processarMensagem(mensagem(oi), AGORA);
    expect(m.gerarTexto).not.toHaveBeenCalled();
    expect(textosEnviados()).toHaveLength(3);
    for (const t of textosEnviados()) {
      expect(t).toContain("Prazos dos próximos 7 dias");
      expect(t).toContain("*analisar <link>*");
      expect(t).not.toContain("ocupado");
    }
  });

  it("saudação com o resumo atrasado pendente: manda o resumo e não a resposta curta", async () => {
    m.enviarResumoAtrasado.mockResolvedValueOnce(true);
    await processarMensagem(mensagem("oi"), AGORA);
    expect(m.enviarResumoAtrasado).toHaveBeenCalledTimes(1);
    expect(m.enviarParaPessoa).not.toHaveBeenCalled();
    expect(m.gerarTexto).not.toHaveBeenCalled();
  });

  it("qualquer outra mensagem do dia também dispara o resumo atrasado (uma tentativa por mensagem)", async () => {
    await processarMensagem(mensagem("pipeline"), AGORA);
    expect(m.enviarResumoAtrasado).toHaveBeenCalledTimes(1);
    await processarMensagem(mensagem("Parar"), AGORA);
    expect(m.enviarResumoAtrasado).toHaveBeenCalledTimes(1);
  });

  it("gerar N e o botão Gerar montam o rascunho; Aprovar aprova pela mesma função da tela", async () => {
    m.gerarPropostaPeloWhatsapp.mockResolvedValue({ texto: "📝 Rascunho pronto", botoes: [{ titulo: "Aprovar", payload: "apr:p1" }] });
    await processarMensagem(mensagem("gerar 2"), AGORA);
    expect(m.gerarPropostaPeloWhatsapp).toHaveBeenLastCalledWith(expect.objectContaining({ usuarioId: "u1" }), { numero: 2 }, AGORA);
    expect(m.enviarParaPessoa.mock.calls[0]?.[3]).toEqual({ resposta: true, botoes: [{ titulo: "Aprovar", payload: "apr:p1" }] });

    await processarMensagem(mensagem("", "ger:i1"), AGORA);
    expect(m.gerarPropostaPeloWhatsapp).toHaveBeenLastCalledWith(expect.anything(), { itemId: "i1" }, AGORA);

    m.aprovarPropostaPeloWhatsapp.mockResolvedValue({ texto: "✅ Proposta aprovada" });
    await processarMensagem(mensagem("", "apr:p1"), AGORA);
    expect(m.aprovarPropostaPeloWhatsapp).toHaveBeenCalledWith(expect.anything(), "p1", AGORA);
    expect(textosEnviados()[2]).toBe("✅ Proposta aprovada");
    expect(m.gerarTexto).not.toHaveBeenCalled();
  });

  describe("analisar link", () => {
    const LINK = "https://pncp.gov.br/app/editais/12345678000199/2025/123";
    const ok = { ok: true, jaEstava: false, titulo: "Material de escritório", etapa: "radar", rotuloEtapa: "Radar", href: "/licitacao/12345678000199/2025/123" };

    it("analisar <link>: adiciona na empresa da pessoa e responde com título, etapa e link do sistema", async () => {
      m.adicionarChave.mockResolvedValue(ok);
      await processarMensagem(mensagem("analisar " + LINK), AGORA);
      expect(m.adicionarChave).toHaveBeenCalledWith("emp1", "u1", { cnpj: "12345678000199", ano: 2025, sequencial: 123 });
      const texto = textosEnviados()[0] ?? "";
      expect(texto).toContain("Material de escritório");
      expect(texto).toContain("Etapa: Radar");
      expect(texto).toMatch(/https?:\/\/\S+\/licitacao\/12345678000199\/2025\/123/);
      expect(m.gerarTexto).not.toHaveBeenCalled();
    });

    it("só o link colado funciona e vários links viram várias respostas na mesma mensagem", async () => {
      m.adicionarChave.mockResolvedValueOnce(ok).mockResolvedValueOnce({ ...ok, jaEstava: true, etapa: "cotando", rotuloEtapa: "Cotando" });
      await processarMensagem(mensagem(LINK + "\n12345678000199-1-000007/2024"), AGORA);
      expect(m.adicionarChave).toHaveBeenCalledTimes(2);
      expect(textosEnviados()).toHaveLength(1);
      expect(textosEnviados()[0]).toContain("Já estava no Pipeline");
      expect(textosEnviados()[0]).toContain("Etapa: Cotando");
    });

    it("erro de um link não derruba os outros", async () => {
      m.adicionarChave.mockResolvedValueOnce({ ok: false, erro: "Não achei essa contratação no PNCP." }).mockResolvedValueOnce(ok);
      await processarMensagem(mensagem(LINK + "\n12345678000199-1-000007/2024"), AGORA);
      expect(textosEnviados()[0]).toContain("Não achei essa contratação no PNCP.");
      expect(textosEnviados()[0]).toContain("Adicionada ao Pipeline");
    });

    it("sem link reconhecido explica como usar", async () => {
      await processarMensagem(mensagem("analisar isso"), AGORA);
      expect(m.adicionarChave).not.toHaveBeenCalled();
      expect(textosEnviados()[0]).toContain("analisar");
      expect(textosEnviados()[0]).toContain("PNCP");
    });

    it("sem a permissão de mexer no pipeline: recusa e não adiciona", async () => {
      m.lerVinculoPorNumero.mockResolvedValue(vinculo({ papel: "juridico", permissoes: ["revisao_juridica"] }));
      await processarMensagem(mensagem("analisar " + LINK), AGORA);
      expect(m.adicionarChave).not.toHaveBeenCalled();
      expect(textosEnviados()[0]).toContain("não pode mexer no pipeline");
    });
  });

  it("ignora mensagem da própria conta", async () => {
    await processarMensagem({ ...mensagem("oi"), remetente: "5521969418669" }, AGORA);
    expect(m.lerVinculoPorNumero).not.toHaveBeenCalled();
  });
});
