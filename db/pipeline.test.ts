import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { OportunidadeComScore } from "@/core/types";

vi.mock("server-only", () => ({}));

try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local: o teste é pulado abaixo
}

const ID = `TESTE-PIPELINE-${Date.now()}`;

const ficticio: OportunidadeComScore = {
  id: ID,
  objeto: "Objeto ficticio de teste do pipeline",
  valorEstimado: 1234.5,
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
    criterios: [
      { id: "cnae", rotulo: "CNAE", pontos: 40, maximo: 40, motivo: "Casou", aConfirmar: false },
    ],
    cnaesCasados: ["4321-5/00"],
    frenteCasada: "servicos",
  },
};

describe.skipIf(!process.env.DATABASE_URL)("pipeline no banco", () => {
  type Modulo = typeof import("./pipeline");
  let m: Modulo;
  let E = "";
  let E2 = "";
  let limpar: (id: string) => Promise<void> = async () => undefined;

  beforeAll(async () => {
    m = await import("./pipeline");
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

  it("salva, move, anota, lê o histórico e remove", async () => {
    expect((await m.salvarItem(E, ficticio)).criado).toBe(true);
    expect((await m.salvarItem(E, ficticio)).criado).toBe(false);
    expect((await m.idsNoPipeline(E)).has(ID)).toBe(true);

    expect(await m.moverItem(E, ID, "cotando")).toBe(true);
    expect(await m.moverItem(E, ID, "cotando")).toBe(true);
    expect(await m.moverItem(E, ID, "ganha")).toBe(true);
    expect(await m.atualizarNotas(E, ID, "nota de teste")).toBe(true);

    const itens = await m.listarPipeline(E);
    const achado = itens.find((i) => i.id === ID);
    expect(achado?.etapa).toBe("ganha");
    expect(achado?.notas).toBe("nota de teste");
    expect(achado?.item.objeto).toBe(ficticio.objeto);

    const historico = await m.listarHistorico(E, ID);
    expect(historico.map((h) => [h.de, h.para])).toEqual([
      [null, "radar"],
      ["radar", "cotando"],
      ["cotando", "ganha"],
    ]);

    const resumo = await m.resumoPipeline(E);
    expect(resumo.ganhas).toBeGreaterThanOrEqual(1);
    expect(resumo.taxaVitoria).not.toBeNull();

    expect(await m.moverItem(E, "TESTE-NAO-EXISTE", "radar")).toBe(false);
    expect(await m.removerItem(E, ID)).toBe(true);
    expect((await m.idsNoPipeline(E)).has(ID)).toBe(false);
    expect(await m.listarHistorico(E, ID)).toEqual([]);
  }, 60_000);

  it("não mostra nem mexe em dados de outra empresa", async () => {
    await m.salvarItem(E, ficticio);
    expect((await m.idsNoPipeline(E2)).has(ID)).toBe(false);
    expect((await m.listarPipeline(E2)).some((i) => i.id === ID)).toBe(false);
    expect(await m.moverItem(E2, ID, "ganha")).toBe(false);
    expect(await m.atualizarNotas(E2, ID, "invasão")).toBe(false);
    expect(await m.removerItem(E2, ID)).toBe(false);
    expect(await m.listarHistorico(E2, ID)).toEqual([]);
    // Item da outra empresa não aparece nem mexe nos números desta.
    const outro = { ...ficticio, id: `${ID}-B` };
    expect((await m.salvarItem(E2, outro)).criado).toBe(true);
    expect((await m.listarPipeline(E)).some((i) => i.id === outro.id)).toBe(false);
    await m.moverItem(E2, outro.id, "perdida");
    expect((await m.listarPipeline(E)).find((i) => i.id === ID)?.etapa).toBe("radar");
    expect((await m.resumoPipeline(E)).perdidas).toBe(0);
  }, 60_000);
});
