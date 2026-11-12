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

  beforeAll(async () => {
    m = await import("./pipeline");
    await m.removerItem(ID);
  }, 30_000);

  afterAll(async () => {
    await m.removerItem(ID);
    const { sql } = await import("./client");
    await sql.end({ timeout: 5 });
  }, 30_000);

  it("salva, move, anota, lê o histórico e remove", async () => {
    expect((await m.salvarItem(ficticio)).criado).toBe(true);
    expect((await m.salvarItem(ficticio)).criado).toBe(false);
    expect((await m.idsNoPipeline()).has(ID)).toBe(true);

    expect(await m.moverItem(ID, "cotando")).toBe(true);
    expect(await m.moverItem(ID, "cotando")).toBe(true);
    expect(await m.moverItem(ID, "ganha")).toBe(true);
    expect(await m.atualizarNotas(ID, "nota de teste")).toBe(true);

    const itens = await m.listarPipeline();
    const achado = itens.find((i) => i.id === ID);
    expect(achado?.etapa).toBe("ganha");
    expect(achado?.notas).toBe("nota de teste");
    expect(achado?.item.objeto).toBe(ficticio.objeto);

    const historico = await m.listarHistorico(ID);
    expect(historico.map((h) => [h.de, h.para])).toEqual([
      [null, "radar"],
      ["radar", "cotando"],
      ["cotando", "ganha"],
    ]);

    const resumo = await m.resumoPipeline();
    expect(resumo.ganhas).toBeGreaterThanOrEqual(1);
    expect(resumo.taxaVitoria).not.toBeNull();

    expect(await m.moverItem("TESTE-NAO-EXISTE", "radar")).toBe(false);
    expect(await m.removerItem(ID)).toBe(true);
    expect((await m.idsNoPipeline()).has(ID)).toBe(false);
    expect(await m.listarHistorico(ID)).toEqual([]);
  }, 60_000);
});
