import { beforeEach, describe, expect, it, vi } from "vitest";
import { escolhasDoPerfil } from "@/core/whatsapp-alertas";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  zernioConfigurado: vi.fn<() => boolean>(),
  garantirWebhook: vi.fn(),
  lerConfig: vi.fn<(chave: string) => Promise<string | null>>(),
  gravarConfig: vi.fn<(chave: string, valor: string) => Promise<void>>(),
  descartarVencidos: vi.fn(),
  limparEventos: vi.fn(),
  listarVinculosAtivos: vi.fn(),
  listarVinculosGestoresExtras: vi.fn(),
  listarIdsEmpresasExtras: vi.fn(),
  listarMudancasDesde: vi.fn(),
  descartarAvulsosAntigos: vi.fn(),
  chavesRegistradas: vi.fn(),
  listarPendentes: vi.fn(),
  marcarEnviados: vi.fn(),
  registrarEnviados: vi.fn(),
  listarIdsEmpresasAtivas: vi.fn(),
  lerEmpresa: vi.fn(),
  listarPessoasDeAviso: vi.fn(),
  listarPipeline: vi.fn(),
  lerPreferencias: vi.fn(),
  entregarAlertasWa: vi.fn(),
  enviarParaPessoa: vi.fn(),
  lerMetaDisputas: vi.fn(),
  lerGanhosDaSemana: vi.fn(),
  listarPropostas: vi.fn(),
  listarMovimentosDePropostas: vi.fn(),
}));

vi.mock("@/lib/zernio", () => ({ zernioConfigurado: m.zernioConfigurado, garantirWebhook: m.garantirWebhook }));
vi.mock("@/db/whatsapp", () => ({
  lerConfig: m.lerConfig,
  gravarConfig: m.gravarConfig,
  descartarVencidos: m.descartarVencidos,
  limparEventos: m.limparEventos,
  listarVinculosAtivos: m.listarVinculosAtivos,
  listarVinculosGestoresExtras: m.listarVinculosGestoresExtras,
  listarMudancasDesde: m.listarMudancasDesde,
  descartarAvulsosAntigos: m.descartarAvulsosAntigos,
  chavesRegistradas: m.chavesRegistradas,
  listarPendentes: m.listarPendentes,
  marcarEnviados: m.marcarEnviados,
  registrarEnviados: m.registrarEnviados,
}));
vi.mock("@/db/empresas", () => ({ listarIdsEmpresasAtivas: m.listarIdsEmpresasAtivas, lerEmpresa: m.lerEmpresa }));
vi.mock("@/db/usuario-empresas", () => ({ listarIdsEmpresasExtras: m.listarIdsEmpresasExtras }));
vi.mock("@/db/avisos",() => ({ listarPessoasDeAviso: m.listarPessoasDeAviso }));
vi.mock("@/db/pipeline", () => ({ listarPipeline: m.listarPipeline }));
vi.mock("@/db/propostas", () => ({ listarPropostas: m.listarPropostas, listarMovimentosDePropostas: m.listarMovimentosDePropostas }));
vi.mock("@/db/meta", () => ({ lerMetaDisputas: m.lerMetaDisputas, lerGanhosDaSemana: m.lerGanhosDaSemana }));
vi.mock("@/db/preferencias", () => ({ lerPreferencias: m.lerPreferencias }));
vi.mock("@/lib/radar-dados", () => ({ obterRadar: vi.fn() }));
vi.mock("@/lib/whatsapp-envio", () => ({ entregarAlertasWa: m.entregarAlertasWa, enviarParaPessoa: m.enviarParaPessoa }));

import { enviarResumoAtrasado, executarAlertasWa, garantirWebhookConfigurado } from "./whatsapp-alertas-cron";

/** 10h UTC = 7h em São Paulo */
const SETE_DA_MANHA = new Date("2026-11-16T10:00:00Z");
/** 8h UTC = 5h em São Paulo */
const MADRUGADA = new Date("2026-11-16T08:00:00Z");
/** 13h UTC = 10h em São Paulo */
const DEZ_DA_MANHA = new Date("2026-11-16T13:00:00Z");

const EMPRESA = "11111111-1111-4111-8111-111111111111";
const USUARIO = "22222222-2222-4222-8222-222222222222";

function vinculo(agora: Date, papel: "dono" | "gestor" = "dono") {
  return {
    usuarioId: USUARIO,
    empresaId: EMPRESA,
    nome: "Pessoa",
    papel,
    permissoes: [],
    whatsapp: "5511999999999",
    avisoWhatsapp: true,
    conversaId: "conversa-1",
    ultimaEntrada: new Date(agora.getTime() - 3_600_000),
    ultimoTemplate: null,
    escolhas: escolhasDoPerfil(papel === "dono" ? "acompanhamento" : "operacional"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  const config = new Map<string, string>();
  m.zernioConfigurado.mockReturnValue(true);
  m.garantirWebhook.mockResolvedValue({ ok: true, criado: true });
  m.lerConfig.mockImplementation(async (chave) => config.get(chave) ?? null);
  m.gravarConfig.mockImplementation(async (chave, valor) => {
    config.set(chave, valor);
  });
  m.descartarVencidos.mockResolvedValue(0);
  m.limparEventos.mockResolvedValue(0);
  m.listarIdsEmpresasAtivas.mockResolvedValue([EMPRESA]);
  m.listarVinculosAtivos.mockImplementation(async () => [vinculo(new Date())]);
  m.listarVinculosGestoresExtras.mockResolvedValue([]);
  m.listarIdsEmpresasExtras.mockResolvedValue([]);
  m.listarPessoasDeAviso.mockResolvedValue([{ id: USUARIO }]);
  m.listarPipeline.mockResolvedValue([
    {
      id: "item-1",
      etapa: "analise",
      responsavelId: USUARIO,
      item: { objeto: "Compra de material", dataEncerramento: "2026-11-30T12:00:00Z" },
    },
  ]);
  m.listarMudancasDesde.mockResolvedValue([]);
  m.descartarAvulsosAntigos.mockResolvedValue(0);
  m.chavesRegistradas.mockResolvedValue(new Set<string>());
  m.listarPendentes.mockResolvedValue([]);
  m.lerEmpresa.mockResolvedValue(null);
  m.lerPreferencias.mockResolvedValue({});
  m.entregarAlertasWa.mockResolvedValue({ novos: 0, enviados: 0 });
  m.enviarParaPessoa.mockResolvedValue(true);
  m.lerMetaDisputas.mockResolvedValue({ minimo: 5, ideal: 10 });
  m.lerGanhosDaSemana.mockResolvedValue({ disputadas: 0, valorDisputadas: 0, estimadoDisputadas: false, vencidas: 0, valorVencidas: 0, estimadoVencidas: false });
  m.listarPropostas.mockResolvedValue([]);
  m.listarMovimentosDePropostas.mockResolvedValue([]);
});

describe("executarAlertasWa", () => {
  it("sem Zernio configurado não faz nada", async () => {
    m.zernioConfigurado.mockReturnValue(false);
    const r = await executarAlertasWa(DEZ_DA_MANHA);
    expect(r.ativo).toBe(false);
    expect(m.listarIdsEmpresasAtivas).not.toHaveBeenCalled();
    expect(m.descartarVencidos).not.toHaveBeenCalled();
  });

  it("fora do horário limpa a fila mas não gera alertas", async () => {
    const r = await executarAlertasWa(MADRUGADA);
    expect(r.ativo).toBe(true);
    expect(m.descartarVencidos).toHaveBeenCalledTimes(1);
    expect(m.descartarAvulsosAntigos).toHaveBeenCalledTimes(1);
    expect(m.limparEventos).toHaveBeenCalledTimes(1);
    expect(m.listarIdsEmpresasAtivas).not.toHaveBeenCalled();
    expect(m.entregarAlertasWa).not.toHaveBeenCalled();
    expect(m.enviarParaPessoa).not.toHaveBeenCalled();
  });

  it("dentro do horário entrega os alertas e soma as contagens", async () => {
    m.entregarAlertasWa.mockResolvedValue({ novos: 2, enviados: 1 });
    const r = await executarAlertasWa(DEZ_DA_MANHA);
    expect(m.entregarAlertasWa).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ ativo: true, empresas: 1, novos: 2, enviados: 1, resumos: 0 });
    // Fora das 7h não há resumo da manhã, nem leitura do Radar ou das etapas
    expect(m.enviarParaPessoa).not.toHaveBeenCalled();
    expect(m.listarMudancasDesde).not.toHaveBeenCalled();
    expect(m.lerEmpresa).not.toHaveBeenCalled();
  });

  it("na hora só vai o prazo urgente, para quem quer prazos", async () => {
    const agora = DEZ_DA_MANHA;
    m.listarVinculosAtivos.mockImplementation(async () => [vinculo(agora, "gestor")]);
    m.listarPipeline.mockResolvedValue([
      { id: "urgente", etapa: "cotando", responsavelId: null, item: { objeto: "Toner", dataEncerramento: new Date(agora.getTime() + 3_600_000).toISOString() } },
      { id: "dois-dias", etapa: "cotando", responsavelId: null, item: { objeto: "Papel", dataEncerramento: new Date(agora.getTime() + 30 * 3_600_000).toISOString() } },
    ]);
    await executarAlertasWa(agora);
    const alertas = m.entregarAlertasWa.mock.calls[0]?.[1] as Array<{ tipo: string; chave: string }>;
    expect(alertas.map((a) => a.chave)).toEqual(["prazo2:urgente"]);

    m.entregarAlertasWa.mockClear();
    m.listarVinculosAtivos.mockImplementation(async () => [vinculo(agora, "dono")]);
    await executarAlertasWa(agora);
    expect(m.entregarAlertasWa.mock.calls[0]?.[1]).toEqual([]);
  });

  it("pula a empresa sem pessoa vinculada", async () => {
    m.listarVinculosAtivos.mockResolvedValue([]);
    const r = await executarAlertasWa(DEZ_DA_MANHA);
    expect(r.empresas).toBe(0);
    expect(m.entregarAlertasWa).not.toHaveBeenCalled();
  });

  it("o resumo da manhã sai às 7h, uma vez por dia", async () => {
    m.listarVinculosAtivos.mockImplementation(async () => [vinculo(SETE_DA_MANHA)]);
    const primeira = await executarAlertasWa(SETE_DA_MANHA);
    expect(primeira.resumos).toBe(1);
    expect(m.enviarParaPessoa).toHaveBeenCalledTimes(1);
    expect(m.enviarParaPessoa.mock.calls[0]?.[3]).toMatchObject({ critico: true });

    const segunda = await executarAlertasWa(new Date(SETE_DA_MANHA.getTime() + 600_000));
    expect(segunda.resumos).toBe(0);
    expect(m.enviarParaPessoa).toHaveBeenCalledTimes(1);
  });

  it("dono recebe o acompanhamento: movimentos da equipe e meta", async () => {
    m.listarVinculosAtivos.mockImplementation(async () => [vinculo(SETE_DA_MANHA, "dono")]);
    m.listarPessoasDeAviso.mockResolvedValue([{ id: USUARIO, nome: "Dono" }, { id: "paulo", nome: "Paulo Henrique" }]);
    m.listarMudancasDesde.mockResolvedValue([
      { historicoId: "h1", itemId: "item-1", objeto: "Notebooks", de: "proposta", para: "disputa", porId: "paulo", responsavelId: null },
    ]);
    await executarAlertasWa(SETE_DA_MANHA);
    const texto = String(m.enviarParaPessoa.mock.calls[0]?.[1]);
    expect(texto).toContain("☀️ Bom dia, Pessoa!");
    expect(texto).toContain("• Paulo: Notebooks (Proposta pronta → Em disputa)");
    expect(texto).toContain("🏁 Entraram em disputa: 1");
    expect(texto).toContain("🎯 Meta: 1/5 disputas · faltam 4 até domingo");
    expect(texto).not.toContain("Fecham em 48 h");
  });

  it("a meta do resumo vem da configuração da empresa", async () => {
    m.listarVinculosAtivos.mockImplementation(async () => [vinculo(SETE_DA_MANHA, "dono")]);
    m.lerMetaDisputas.mockResolvedValue({ minimo: 3, ideal: 7 });
    await executarAlertasWa(SETE_DA_MANHA);
    expect(m.lerMetaDisputas).toHaveBeenCalledWith(EMPRESA);
    expect(String(m.enviarParaPessoa.mock.calls[0]?.[1])).toContain("🎯 Meta: 0/3 disputas · faltam 3 até domingo");
  });

  it("gestor recebe o operacional e os avisos da fila saem como enviados", async () => {
    m.listarVinculosAtivos.mockImplementation(async () => [vinculo(SETE_DA_MANHA, "gestor")]);
    m.listarPipeline.mockResolvedValue([
      { id: "item-1", etapa: "cotando", responsavelId: null, item: { objeto: "Toner", dataEncerramento: new Date(SETE_DA_MANHA.getTime() + 30 * 3_600_000).toISOString() } },
    ]);
    m.listarPendentes.mockResolvedValue([
      { id: "a1", tipo: "aviso", texto: "📝 Proposta para revisar", itemId: null },
      { id: "p1", tipo: "prazo24", texto: "⏰ prazo", itemId: "item-1" },
    ]);
    await executarAlertasWa(SETE_DA_MANHA);
    const texto = String(m.enviarParaPessoa.mock.calls[0]?.[1]);
    expect(texto).toContain("⏰ Fecham em 48 h: 1");
    expect(texto).toContain("📌 Para você: 1");
    expect(texto).not.toContain("⏰ prazo");
    expect(m.marcarEnviados).toHaveBeenCalledWith(["a1"], SETE_DA_MANHA);
  });

  it("com a janela fechada, o resumo da manhã é pedido como mensagem utilitária", async () => {
    m.listarVinculosAtivos.mockImplementation(async () => [
      { ...vinculo(SETE_DA_MANHA), ultimaEntrada: new Date(SETE_DA_MANHA.getTime() - 30 * 3_600_000) },
    ]);
    await executarAlertasWa(SETE_DA_MANHA);
    expect(m.enviarParaPessoa).toHaveBeenCalledTimes(1);
    expect(m.enviarParaPessoa.mock.calls[0]?.[3]).toMatchObject({ utilidade: true });
  });

  it("falha numa empresa não derruba as outras", async () => {
    m.listarIdsEmpresasAtivas.mockResolvedValue(["a", EMPRESA]);
    m.listarVinculosAtivos.mockRejectedValueOnce(new Error("banco fora"));
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await executarAlertasWa(DEZ_DA_MANHA);
    expect(r.empresas).toBe(1);
    erro.mockRestore();
  });
});

describe("gestor de várias empresas", () => {
  const EXTRA = "33333333-3333-4333-8333-333333333333";
  const sosMeta = { ...escolhasDoPerfil("acompanhamento"), grandes: false };

  function nomesDasEmpresas() {
    m.lerEmpresa.mockImplementation(async (id: string) => ({
      nomeFantasia: id === EMPRESA ? "Alfa" : "Beta",
      razaoSocial: id === EMPRESA ? "Alfa Comércio Ltda" : "Beta Serviços Ltda",
    }));
  }

  it("o resumo das 7h sai numa mensagem só, com um bloco por empresa, e uma vez por dia", async () => {
    nomesDasEmpresas();
    m.listarIdsEmpresasAtivas.mockResolvedValue([EMPRESA, EXTRA]);
    m.listarVinculosAtivos.mockImplementation(async (id: string) => (id === EMPRESA ? [{ ...vinculo(SETE_DA_MANHA), escolhas: sosMeta }] : []));
    m.listarIdsEmpresasExtras.mockResolvedValue([EXTRA]);
    const r = await executarAlertasWa(SETE_DA_MANHA);
    expect(r.resumos).toBe(1);
    expect(m.enviarParaPessoa).toHaveBeenCalledTimes(1);
    const texto = String(m.enviarParaPessoa.mock.calls[0]?.[1]);
    expect(texto.indexOf("🏢 *Alfa*")).toBeGreaterThan(0);
    expect(texto.indexOf("🏢 *Beta*")).toBeGreaterThan(texto.indexOf("🏢 *Alfa*"));
    expect(m.gravarConfig).toHaveBeenCalledWith(`manha:${USUARIO}:2026-11-16`, SETE_DA_MANHA.toISOString());
    expect(m.registrarEnviados).toHaveBeenCalledWith(EXTRA, [], SETE_DA_MANHA);

    await executarAlertasWa(new Date(SETE_DA_MANHA.getTime() + 600_000));
    expect(m.enviarParaPessoa).toHaveBeenCalledTimes(1);
  });

  it("sem extras o texto é o de sempre, sem cabeçalho de empresa", async () => {
    nomesDasEmpresas();
    m.listarVinculosAtivos.mockImplementation(async () => [{ ...vinculo(SETE_DA_MANHA), escolhas: sosMeta }]);
    await executarAlertasWa(SETE_DA_MANHA);
    const texto = String(m.enviarParaPessoa.mock.calls[0]?.[1]);
    expect(texto).not.toContain("🏢");
    expect(texto.startsWith("☀️ Bom dia, Pessoa!\n\n🎯 Meta")).toBe(true);
  });

  it("sem a tabela usuario_empresas o cron segue como hoje", async () => {
    nomesDasEmpresas();
    const semRelacao = Object.assign(new Error('relation "usuario_empresas" does not exist'), { code: "42P01" });
    m.listarVinculosGestoresExtras.mockRejectedValue(semRelacao);
    m.listarIdsEmpresasExtras.mockRejectedValue(semRelacao);
    m.listarVinculosAtivos.mockImplementation(async () => [{ ...vinculo(SETE_DA_MANHA), escolhas: sosMeta }]);
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await executarAlertasWa(SETE_DA_MANHA);
    expect(r.resumos).toBe(1);
    expect(String(m.enviarParaPessoa.mock.calls[0]?.[1])).not.toContain("🏢");
    expect(erro).not.toHaveBeenCalled();
    erro.mockRestore();
  });

  it("o prazo urgente da empresa extra chega ao gestor com o nome da empresa e sem botões de item", async () => {
    nomesDasEmpresas();
    m.listarIdsEmpresasAtivas.mockResolvedValue([EXTRA]);
    m.listarVinculosAtivos.mockResolvedValue([]);
    m.listarVinculosGestoresExtras.mockResolvedValue([{ ...vinculo(DEZ_DA_MANHA, "gestor"), empresaId: EMPRESA }]);
    m.listarPipeline.mockResolvedValue([
      { id: "urgente", etapa: "cotando", responsavelId: null, item: { objeto: "Toner", dataEncerramento: new Date(DEZ_DA_MANHA.getTime() + 3_600_000).toISOString() } },
    ]);
    await executarAlertasWa(DEZ_DA_MANHA);
    const chamada = m.entregarAlertasWa.mock.calls.find((c) => (c[1] as unknown[]).length > 0);
    expect(chamada?.[0]).toBe(EXTRA);
    const alertas = chamada?.[1] as Array<{ usuarioId: string; chave: string; texto: string; itemId: string | null }>;
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({ usuarioId: USUARIO, chave: "prazo2:urgente", itemId: "urgente" });
    expect(alertas[0]?.texto).toContain("(Beta)");
    expect(chamada?.[3]).toEqual({ semBotoes: true });
  });

  it("item com responsável da equipe que recebe prazo não vai também ao gestor de fora", async () => {
    nomesDasEmpresas();
    m.listarIdsEmpresasAtivas.mockResolvedValue([EXTRA]);
    m.listarVinculosAtivos.mockResolvedValue([{ ...vinculo(DEZ_DA_MANHA, "gestor"), usuarioId: "equipe", empresaId: EXTRA }]);
    m.listarVinculosGestoresExtras.mockResolvedValue([{ ...vinculo(DEZ_DA_MANHA, "gestor"), empresaId: EMPRESA }]);
    m.listarPipeline.mockResolvedValue([
      { id: "urgente", etapa: "cotando", responsavelId: "equipe", item: { objeto: "Toner", dataEncerramento: new Date(DEZ_DA_MANHA.getTime() + 3_600_000).toISOString() } },
    ]);
    await executarAlertasWa(DEZ_DA_MANHA);
    const doGestor = m.entregarAlertasWa.mock.calls.find((c) => (c[3] as { semBotoes?: boolean } | undefined)?.semBotoes === true);
    expect(doGestor?.[1]).toEqual([]);
  });
});

describe("garantirWebhookConfigurado", () => {
  it("registra só quando a URL muda", async () => {
    vi.stubEnv("ZERNIO_WEBHOOK_SECRET", "segredo");
    vi.stubEnv("APP_URL", "https://painel.exemplo.test/");
    expect(await garantirWebhookConfigurado()).toBe(true);
    expect(m.garantirWebhook).toHaveBeenCalledTimes(1);
    expect(m.garantirWebhook).toHaveBeenCalledWith("https://painel.exemplo.test/api/whatsapp/webhook", "segredo");
    expect(m.gravarConfig).toHaveBeenCalledWith("webhook_url", "https://painel.exemplo.test/api/whatsapp/webhook");

    expect(await garantirWebhookConfigurado()).toBe(true);
    expect(m.garantirWebhook).toHaveBeenCalledTimes(1);

    vi.stubEnv("APP_URL", "https://outro.exemplo.test");
    await garantirWebhookConfigurado();
    expect(m.garantirWebhook).toHaveBeenCalledTimes(2);
  });

  it("não grava a URL quando o registro falha, nem tenta sem segredo", async () => {
    vi.stubEnv("ZERNIO_WEBHOOK_SECRET", "segredo");
    m.garantirWebhook.mockResolvedValue({ ok: false, criado: false, erro: "falha" });
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await garantirWebhookConfigurado()).toBe(false);
    expect(m.gravarConfig).not.toHaveBeenCalledWith("webhook_url", expect.anything());
    erro.mockRestore();

    vi.unstubAllEnvs();
    m.garantirWebhook.mockClear();
    expect(await garantirWebhookConfigurado()).toBe(false);
    expect(m.garantirWebhook).not.toHaveBeenCalled();
  });
});

describe("propostas do dia no resumo do gestor", () => {
  const itemDoDia = {
    id: "item-1",
    etapa: "cotando",
    responsavelId: null,
    item: { objeto: "Toner", valorEstimado: 8000, dataEncerramento: new Date(SETE_DA_MANHA.getTime() + 30 * 3_600_000).toISOString() },
  };

  it("traz a seção, os botões Gerar e guarda a lista do dia", async () => {
    m.listarVinculosAtivos.mockImplementation(async () => [vinculo(SETE_DA_MANHA, "gestor")]);
    m.listarPipeline.mockResolvedValue([itemDoDia]);
    await executarAlertasWa(SETE_DA_MANHA);
    const texto = String(m.enviarParaPessoa.mock.calls[0]?.[1]);
    expect(texto).toContain("📝 Propostas para hoje: 1");
    expect(texto).toContain("R$ 8.000");
    expect(texto).toContain("Responda *gerar 1*");
    const opcoes = m.enviarParaPessoa.mock.calls[0]?.[3] as { botoes: Array<{ titulo: string; payload: string }> };
    expect(opcoes.botoes[0]).toEqual({ titulo: "Gerar 1", payload: "ger:item-1" });
    expect(m.gravarConfig).toHaveBeenCalledWith(`propdia:${USUARIO}:2026-11-16`, JSON.stringify(["item-1"]));
  });

  it("item que já tem proposta aprovada fica de fora", async () => {
    m.listarVinculosAtivos.mockImplementation(async () => [vinculo(SETE_DA_MANHA, "gestor")]);
    m.listarPipeline.mockResolvedValue([itemDoDia]);
    m.listarPropostas.mockResolvedValue([{ compraId: "item-1", status: "aprovada" }]);
    await executarAlertasWa(SETE_DA_MANHA);
    expect(String(m.enviarParaPessoa.mock.calls[0]?.[1])).not.toContain("Propostas para hoje");
  });

  it("o dono vê o que a equipe fez com as propostas", async () => {
    m.listarVinculosAtivos.mockImplementation(async () => [vinculo(SETE_DA_MANHA, "dono")]);
    m.listarMovimentosDePropostas.mockResolvedValue([
      { propostaId: "p1", objeto: "Toner", acao: "gerou", porId: "paulo", porNome: "Paulo Henrique", total: 8000 },
    ]);
    await executarAlertasWa(SETE_DA_MANHA);
    expect(String(m.enviarParaPessoa.mock.calls[0]?.[1])).toContain("• Paulo gerou a proposta de Toner (R$ 8.000)");
  });
});

describe("resumo atrasado", () => {
  const DEPOIS = new Date("2026-11-16T14:00:00Z");

  it("sai na primeira mensagem do dia quando o das 7h foi pulado, uma vez só", async () => {
    const v = vinculo(DEPOIS, "gestor");
    expect(await enviarResumoAtrasado(v, DEPOIS)).toBe(true);
    expect(m.gravarConfig).toHaveBeenCalledWith(`manha:${USUARIO}:2026-11-16`, DEPOIS.toISOString());
    expect(await enviarResumoAtrasado(v, DEPOIS)).toBe(false);
    expect(m.enviarParaPessoa).toHaveBeenCalledTimes(1);
  });

  it("não sai se o das 7h já foi enviado, fora do horário ou com alertas pausados", async () => {
    m.lerConfig.mockImplementation(async (chave) => (chave.startsWith("manha:") ? "2026-11-16T10:00:00Z" : null));
    expect(await enviarResumoAtrasado(vinculo(DEPOIS, "gestor"), DEPOIS)).toBe(false);
    m.lerConfig.mockResolvedValue(null);
    expect(await enviarResumoAtrasado(vinculo(MADRUGADA, "gestor"), MADRUGADA)).toBe(false);
    expect(await enviarResumoAtrasado({ ...vinculo(DEPOIS, "gestor"), avisoWhatsapp: false }, DEPOIS)).toBe(false);
    expect(m.enviarParaPessoa).not.toHaveBeenCalled();
  });

  it("sem nada a dizer não grava o envio, mas não tenta de novo no dia", async () => {
    const v = { ...vinculo(DEPOIS, "gestor"), escolhas: { ...escolhasDoPerfil("operacional"), meta: false, novas: false, grandes: false, pendencias: false, fechando: false, aguardando: false } };
    expect(await enviarResumoAtrasado(v, DEPOIS)).toBe(false);
    expect(m.gravarConfig).not.toHaveBeenCalledWith(`manha:${USUARIO}:2026-11-16`, expect.anything());
    expect(m.gravarConfig).toHaveBeenCalledWith(`atrasado:${USUARIO}:2026-11-16`, DEPOIS.toISOString());
  });
});
