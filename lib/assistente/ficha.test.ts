import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FICHA_EXEMPLO } from "@/core/ficha.fixture";
import type { FichaEdital, FichaSalva } from "@/core/ficha";
import type { DetalheCompra } from "@/core/types-detalhe";
import type { Sessao } from "@/core/types-equipe";

vi.mock("server-only", () => ({}));

import type { EditalLido } from "./edital-pdf";
import { ESQUEMA_JSON_FICHA, TEMPERATURA_FICHA, obterFichaEdital, textoPedidoFicha, type DependenciasFicha } from "./ficha";

const CHAVE = { cnpj: "10779511000107", ano: 2026, sequencial: 235 };
const SESSAO: Sessao = { usuarioId: "11111111-1111-4111-8111-111111111111", nome: "Ana", papel: "gestor", empresaId: "e1", superadmin: false, permissoes: [] };
const ID_PNCP = "10779511000107-1-000235/2026";

const DETALHE: DetalheCompra = {
  chave: CHAVE,
  numeroControle: ID_PNCP,
  numeroCompra: "90012",
  processo: "123/2026",
  objeto: "Suporte técnico de TI",
  informacaoComplementar: null,
  modalidadeId: 6,
  modalidadeNome: "Pregão Eletrônico",
  modoDisputa: "Aberto",
  amparoLegal: null,
  situacao: null,
  srp: false,
  orgao: "Órgão de teste",
  orgaoCnpj: CHAVE.cnpj,
  unidade: "",
  municipio: "Nova Iguaçu",
  uf: "RJ",
  codigoIbge: "3303500",
  valorEstimado: 10000,
  valorHomologado: null,
  dataInclusao: null,
  dataPublicacao: null,
  dataAbertura: null,
  dataEncerramento: "2026-11-16T08:00:00-03:00",
  dataAtualizacao: null,
  linkPncp: "https://pncp.gov.br/app/editais/10779511000107/2026/235",
  linkOrigem: null,
  linkProcesso: null,
  itens: [],
  totalItens: 0,
  arquivos: [],
  falhas: [],
};

function respostaGemini(corpo: unknown): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(corpo) }] }, finishReason: "STOP" }] }),
    { status: 200 },
  );
}

interface Banco {
  guardada: FichaSalva | null;
  gravacoes: Array<{ id: string; usuarioId: string }>;
  /** Markdown do edital guardado com a ficha */
  editalMd?: string | null;
}

function montarDependencias(
  banco: Banco,
  fetchImpl: typeof fetch,
  extra: Partial<DependenciasFicha> = {},
): DependenciasFicha {
  return {
    buscarDetalhe: vi.fn(async () => DETALHE),
    lerEdital: vi.fn(async (): Promise<EditalLido | null> => ({ tipo: "pdf", base64: "QUJD" })),
    lerEditalMd: vi.fn(async () => banco.editalMd ?? null),
    lerFicha: vi.fn(async () => banco.guardada),
    gravarFicha: vi.fn(async (id: string, ficha: FichaEdital, usuarioId: string, editalMd: string | null) => {
      banco.gravacoes.push({ id, usuarioId });
      if (editalMd !== null) banco.editalMd = editalMd;
      banco.guardada = {
        ficha,
        geradaEm: "2026-11-13T15:00:00.000Z",
        geradaPorNome: SESSAO.nome,
        confirmadaPorNome: null,
        confirmadaEm: null,
      };
    }),
    opcoesGemini: { fetchImpl, esperaRetryMs: 0 },
    ...extra,
  };
}

beforeEach(() => {
  process.env.GEMINI_API_KEY = "chave-secreta-de-teste";
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  vi.restoreAllMocks();
});

describe("obterFichaEdital", () => {
  it("PDF com texto: manda o Markdown ao modelo (sem PDF inline), guarda o texto e usa GEMINI_MODEL_FICHA", async () => {
    process.env.GEMINI_MODEL_FICHA = "modelo-barato";
    const banco: Banco = { guardada: null, gravacoes: [] };
    const fetchImpl = vi.fn(async () => respostaGemini(FICHA_EXEMPLO));
    const deps = montarDependencias(banco, fetchImpl as unknown as typeof fetch, {
      lerEdital: vi.fn(async (): Promise<EditalLido | null> => ({ tipo: "texto", markdown: "## Página 1\n\nO pagamento será em 30 dias." })),
    });
    const r = await obterFichaEdital(CHAVE, SESSAO, false, deps);
    delete process.env.GEMINI_MODEL_FICHA;

    expect(r.ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/modelo-barato:generateContent");
    const corpo = JSON.parse(String(init.body)) as { contents: Array<{ parts: Array<{ text?: string; inlineData?: unknown }> }> };
    expect(corpo.contents[0].parts.some((p) => p.inlineData)).toBe(false);
    expect(corpo.contents[0].parts[0].text).toContain("## Página 1");
    expect(corpo.contents[0].parts[1].text).toContain("texto Markdown");
    expect(banco.editalMd).toContain("O pagamento será em 30 dias.");
  });

  it("'Ler de novo' reaproveita o Markdown guardado e não baixa o PDF outra vez", async () => {
    const banco: Banco = {
      guardada: { ficha: FICHA_EXEMPLO, geradaEm: "2026-11-13T15:00:00.000Z", geradaPorNome: "Ana", confirmadaPorNome: null, confirmadaEm: null },
      gravacoes: [],
      editalMd: "## Página 1\n\nTexto guardado do edital.",
    };
    const fetchImpl = vi.fn(async () => respostaGemini(FICHA_EXEMPLO));
    const deps = montarDependencias(banco, fetchImpl as unknown as typeof fetch);
    const r = await obterFichaEdital(CHAVE, SESSAO, true, deps);

    expect(r.ok).toBe(true);
    expect(deps.lerEdital).not.toHaveBeenCalled();
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(init.body)).toContain("Texto guardado do edital.");
    expect(String(init.body)).not.toContain("inlineData");
  });

  it("PDF escaneado cai para o PDF inline e não guarda Markdown", async () => {
    const banco: Banco = { guardada: null, gravacoes: [] };
    const fetchImpl = vi.fn(async () => respostaGemini(FICHA_EXEMPLO));
    const deps = montarDependencias(banco, fetchImpl as unknown as typeof fetch);
    await obterFichaEdital(CHAVE, SESSAO, false, deps);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(init.body)).toContain('"inlineData"');
    expect(banco.editalMd ?? null).toBeNull();
  });

  it("lê o PDF, valida, grava e devolve a ficha com temperatura baixa e esquema fixo", async () => {
    const banco: Banco = { guardada: null, gravacoes: [] };
    const fetchImpl = vi.fn(async () => respostaGemini(FICHA_EXEMPLO));
    const r = await obterFichaEdital(CHAVE, SESSAO, false, montarDependencias(banco, fetchImpl as unknown as typeof fetch));

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ficha.ficha).toEqual(FICHA_EXEMPLO);
      expect(r.ficha.geradaPorNome).toBe("Ana");
      expect(r.ficha.confirmadaEm).toBeNull();
    }
    expect(banco.gravacoes).toEqual([{ id: ID_PNCP, usuarioId: SESSAO.usuarioId }]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const corpo = JSON.parse(String(init.body)) as {
      contents: Array<{ parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }>;
      generationConfig: { temperature: number; maxOutputTokens: number; responseJsonSchema: unknown };
    };
    expect(corpo.generationConfig.temperature).toBe(TEMPERATURA_FICHA);
    expect(corpo.generationConfig.maxOutputTokens).toBe(4096);
    expect(corpo.contents[0].parts.filter((p) => p.inlineData)).toHaveLength(1);
    expect(corpo.generationConfig.responseJsonSchema).toEqual(ESQUEMA_JSON_FICHA);
    expect(corpo.contents[0].parts[0].inlineData).toEqual({ mimeType: "application/pdf", data: "QUJD" });
    expect(JSON.stringify(corpo)).not.toContain("chave-secreta-de-teste");
  });

  it("reaproveita a ficha guardada: segundo pedido não chama o assistente", async () => {
    const banco: Banco = { guardada: null, gravacoes: [] };
    const fetchImpl = vi.fn(async () => respostaGemini(FICHA_EXEMPLO));
    const deps = montarDependencias(banco, fetchImpl as unknown as typeof fetch);

    await obterFichaEdital(CHAVE, SESSAO, false, deps);
    const outra: Sessao = { usuarioId: "22222222-2222-4222-8222-222222222222", nome: "Beto", papel: "dono", empresaId: "e1", superadmin: false, permissoes: [] };
    const r = await obterFichaEdital(CHAVE, outra, false, deps);

    expect(r.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(banco.gravacoes).toHaveLength(1);
    expect(deps.lerEdital).toHaveBeenCalledTimes(1);
  });

  it("com a ficha guardada, funciona mesmo sem chave do assistente", async () => {
    delete process.env.GEMINI_API_KEY;
    const banco: Banco = {
      guardada: { ficha: FICHA_EXEMPLO, geradaEm: "2026-11-13T15:00:00.000Z", geradaPorNome: "Ana", confirmadaPorNome: "Beto", confirmadaEm: "2026-11-13T16:00:00.000Z" },
      gravacoes: [],
    };
    const fetchImpl = vi.fn();
    const r = await obterFichaEdital(CHAVE, SESSAO, false, montarDependencias(banco, fetchImpl as unknown as typeof fetch));
    expect(r.ok && r.ficha.confirmadaPorNome).toBe("Beto");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("'Ler de novo' regenera, grava por cima e zera a conferência", async () => {
    const banco: Banco = {
      guardada: { ficha: FICHA_EXEMPLO, geradaEm: "2026-11-13T15:00:00.000Z", geradaPorNome: "Ana", confirmadaPorNome: "Beto", confirmadaEm: "2026-11-13T16:00:00.000Z" },
      gravacoes: [],
    };
    const nova: FichaEdital = { ...FICHA_EXEMPLO, modoDisputa: { valor: "Fechado", trecho: null, pagina: null } };
    const fetchImpl = vi.fn(async () => respostaGemini(nova));
    const r = await obterFichaEdital(CHAVE, SESSAO, true, montarDependencias(banco, fetchImpl as unknown as typeof fetch));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(banco.gravacoes).toHaveLength(1);
    expect(r.ok && r.ficha.ficha.modoDisputa.valor).toBe("Fechado");
    expect(r.ok && r.ficha.confirmadaEm).toBeNull();
  });

  it("sem chave e sem ficha guardada, avisa e não chama a rede", async () => {
    delete process.env.GEMINI_API_KEY;
    const banco: Banco = { guardada: null, gravacoes: [] };
    const fetchImpl = vi.fn();
    const deps = montarDependencias(banco, fetchImpl as unknown as typeof fetch);
    const r = await obterFichaEdital(CHAVE, SESSAO, false, deps);
    expect(r).toEqual({ ok: false, erro: "O assistente ainda não está ativado." });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(deps.lerEdital).not.toHaveBeenCalled();
  });

  it("sem PDF do edital, não inventa: devolve erro", async () => {
    const banco: Banco = { guardada: null, gravacoes: [] };
    const fetchImpl = vi.fn();
    const deps = montarDependencias(banco, fetchImpl as unknown as typeof fetch, { lerEdital: vi.fn(async () => null) });
    const r = await obterFichaEdital(CHAVE, SESSAO, false, deps);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("PDF do edital");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(banco.gravacoes).toHaveLength(0);
  });

  it("mostra a mensagem do ErroAssistente quando o assistente falha", async () => {
    const banco: Banco = { guardada: null, gravacoes: [] };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429 }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await obterFichaEdital(CHAVE, SESSAO, false, montarDependencias(banco, fetchImpl as unknown as typeof fetch));
    expect(r).toEqual({ ok: false, erro: "O assistente recebeu pedidos demais agora. Espere um pouco e tente de novo." });
    expect(banco.gravacoes).toHaveLength(0);
  });

  it("resposta fora do esquema vira erro numa chamada só, sem correção, e nada é gravado", async () => {
    const banco: Banco = { guardada: null, gravacoes: [] };
    const fetchImpl = vi.fn(async () => respostaGemini({ ...FICHA_EXEMPLO, comoCompetir: ["só uma"] }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await obterFichaEdital(CHAVE, SESSAO, false, montarDependencias(banco, fetchImpl as unknown as typeof fetch));
    expect(r.ok).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(banco.gravacoes).toHaveLength(0);
  });

  it("licitação inexistente e falha ao ler dados viram erro em português", async () => {
    const banco: Banco = { guardada: null, gravacoes: [] };
    const fetchImpl = vi.fn();
    const semCompra = montarDependencias(banco, fetchImpl as unknown as typeof fetch, { buscarDetalhe: vi.fn(async () => null) });
    expect(await obterFichaEdital(CHAVE, SESSAO, false, semCompra)).toEqual({ ok: false, erro: "Esta licitação não foi encontrada." });
    const falha = montarDependencias(banco, fetchImpl as unknown as typeof fetch, {
      buscarDetalhe: vi.fn(async () => {
        throw new Error("PNCP fora");
      }),
    });
    const r = await obterFichaEdital(CHAVE, SESSAO, false, falha);
    expect(r.ok).toBe(false);
  });
});

describe("pedido da ficha", () => {
  it("o texto traz os dados da licitação e o esquema tem os 17 campos", () => {
    expect(textoPedidoFicha(DETALHE)).toContain("Suporte técnico de TI");
    const props = (ESQUEMA_JSON_FICHA as { properties: Record<string, unknown> }).properties;
    expect(Object.keys(props)).toHaveLength(17);
    expect(Object.keys(props)).toEqual(Object.keys(FICHA_EXEMPLO));
  });
});
