import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { OportunidadeComScore } from "@/core/types";

vi.mock("server-only", () => ({}));

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local: o teste é pulado abaixo
}

const ID = `TESTE-CAIXA-${Date.now()}`;

const ficticio: OportunidadeComScore = {
  id: ID,
  objeto: "Objeto ficticio de teste do fluxo de caixa",
  valorEstimado: 5000,
  orgao: "Órgão de teste",
  orgaoCnpj: "00000000000000",
  unidade: "Unidade de teste",
  municipio: "Nova Iguaçu",
  codigoIbge: "3303500",
  uf: "RJ",
  regiao: "nova-iguacu",
  modalidadeId: 8,
  modalidadeNome: "Dispensa",
  dataAbertura: null,
  dataEncerramento: "2030-01-01T12:00:00-03:00",
  anoCompra: 2030,
  sequencialCompra: 1,
  linkPncp: "https://pncp.gov.br/app/editais/teste",
  linkOrigem: null,
  score: {
    total: 72,
    faixa: "go",
    criterios: [{ id: "cnae", rotulo: "CNAE", pontos: 40, maximo: 40, motivo: "Casou", aConfirmar: false }],
    cnaesCasados: ["4321-5/00"],
    frenteCasada: "servicos",
  },
};

describe.skipIf(!process.env.DATABASE_URL)("fluxo de caixa no banco", () => {
  type Pipeline = typeof import("./pipeline");
  type Caixa = typeof import("./fluxo-caixa");
  let pipeline: Pipeline;
  let m: Caixa;
  let E = "";
  let E2 = "";
  let limpar: (id: string) => Promise<void> = async () => undefined;

  beforeAll(async () => {
    pipeline = await import("./pipeline");
    m = await import("./fluxo-caixa");
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

  it("lê só os ganhos e grava recebido, data prevista e comissão", async () => {
    await pipeline.salvarItem(E, ficticio);
    expect(await m.listarGanhosParaCaixa(E)).toEqual([]);
    // Fora da etapa Ganha, nada grava.
    expect(await m.gravarComissaoDoItem(E, ID, 10)).toBe(false);

    await pipeline.moverItem(E, ID, "ganha");
    const [ganho] = await m.listarGanhosParaCaixa(E);
    expect(ganho?.id).toBe(ID);
    expect(ganho?.valorEstimado).toBe(5000);
    expect(ganho?.ganhoEm).not.toBeNull();
    expect(ganho?.recebidoEm).toBeNull();
    expect(ganho?.comissaoAjuste).toBeNull();

    expect(await m.gravarComissaoDoItem(E, ID, 15)).toBe(true);
    expect(await m.gravarPagamentoPrevisto(E, ID, "2030-02-15")).toBe(true);
    expect(await m.gravarRecebido(E, ID, { recebidoEm: "2030-02-20", valor: 4950.5 })).toBe(true);
    const [depois] = await m.listarGanhosParaCaixa(E);
    expect(depois?.comissaoAjuste).toBe(15);
    expect(depois?.pagamentoPrevisto).toBe("2030-02-15");
    expect(depois?.recebidoEm).toBe("2030-02-20");
    expect(depois?.valorRecebido).toBe(4950.5);

    expect(await m.gravarRecebido(E, ID, null)).toBe(true);
    expect(await m.gravarComissaoDoItem(E, ID, null)).toBe(true);
    const [limpo] = await m.listarGanhosParaCaixa(E);
    expect(limpo?.recebidoEm).toBeNull();
    expect(limpo?.valorRecebido).toBeNull();
    expect(limpo?.comissaoAjuste).toBeNull();
  }, 60_000);

  it("rejeita datas, valores e comissões inválidos", async () => {
    expect(await m.gravarComissaoDoItem(E, ID, 31)).toBe(false);
    expect(await m.gravarComissaoDoItem(E, ID, -1)).toBe(false);
    expect(await m.gravarPagamentoPrevisto(E, ID, "31/12/2030")).toBe(false);
    expect(await m.gravarRecebido(E, ID, { recebidoEm: "2030-02-31", valor: 10 })).toBe(false);
    expect(await m.gravarRecebido(E, ID, { recebidoEm: "2030-02-20", valor: -5 })).toBe(false);
  }, 30_000);

  it("não mostra nem mexe em dados de outra empresa", async () => {
    expect((await m.listarGanhosParaCaixa(E2)).some((g) => g.id === ID)).toBe(false);
    expect(await m.gravarComissaoDoItem(E2, ID, 10)).toBe(false);
    expect(await m.gravarPagamentoPrevisto(E2, ID, "2030-03-01")).toBe(false);
    expect(await m.gravarRecebido(E2, ID, { recebidoEm: "2030-03-01", valor: 10 })).toBe(false);
    expect((await m.listarGanhosParaCaixa(E)).find((g) => g.id === ID)?.recebidoEm).toBeNull();
    await pipeline.removerItem(E, ID);
  }, 30_000);
});
