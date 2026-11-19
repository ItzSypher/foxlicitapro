import { describe, expect, it } from "vitest";
import { escolherParaProposta, propostaProntaLigada, prontasPorCompra } from "./propostas-prontas";
import type { Faixa, OportunidadeComScore } from "./types";

const AGORA = new Date("2026-11-18T10:00:00-03:00");

function op(
  id: string,
  total: number,
  encerramento: string,
  extra: { faixa?: Faixa; cnaes?: string[]; cnpj?: string } = {},
): OportunidadeComScore {
  return {
    id,
    objeto: "Objeto",
    valorEstimado: 1000,
    orgao: "Órgão",
    orgaoCnpj: extra.cnpj ?? "11111111000111",
    unidade: "",
    municipio: "Nova Iguaçu",
    codigoIbge: "3303500",
    uf: "RJ",
    regiao: "rj",
    modalidadeId: 8,
    modalidadeNome: "Dispensa",
    dataAbertura: null,
    dataEncerramento: encerramento,
    anoCompra: 2026,
    sequencialCompra: 1,
    linkPncp: "https://pncp.gov.br",
    linkOrigem: null,
    score: {
      total,
      faixa: extra.faixa ?? "go",
      criterios: [],
      cnaesCasados: extra.cnaes ?? ["43.21-5-00"],
      frenteCasada: "servicos",
    },
  };
}

describe("propostaProntaLigada", () => {
  it("vale desligada por padrão e liga com true, 1, sim ou on", () => {
    expect(propostaProntaLigada(undefined)).toBe(false);
    expect(propostaProntaLigada("")).toBe(false);
    for (const v of ["true", " TRUE ", "1", "sim", "on"]) expect(propostaProntaLigada(v)).toBe(true);
  });

  it("desliga com false, 0, nao ou off", () => {
    for (const v of ["false", "FALSE", " 0 ", "nao", "não", "off"]) expect(propostaProntaLigada(v)).toBe(false);
  });
});

describe("escolherParaProposta", () => {
  const em2dias = "2026-11-20T10:00:00-03:00";
  const em4dias = "2026-11-22T10:00:00-03:00";
  const em9dias = "2026-11-27T10:00:00-03:00";

  it("pega as 3 de maior nota que fecham em até 5 dias", () => {
    const lista = [op("A", 60, em2dias), op("B", 90, em4dias), op("C", 70, em4dias), op("D", 80, em2dias), op("E", 99, em9dias)];
    expect(escolherParaProposta([lista], AGORA, new Set()).map((o) => o.id)).toEqual(["B", "D", "C"]);
  });

  it("ignora as que já têm proposta, fora do ramo, nogo, sem CNPJ e já encerradas", () => {
    const lista = [
      op("COM", 95, em2dias),
      op("FORA", 95, em2dias, { cnaes: [] }),
      op("NOGO", 95, em2dias, { faixa: "nogo" }),
      op("SEMCNPJ", 95, em2dias, { cnpj: "" }),
      op("PASSOU", 95, "2026-11-18T09:00:00-03:00"),
      op("OK", 50, em2dias),
    ];
    expect(escolherParaProposta([lista], AGORA, new Set(["COM"])).map((o) => o.id)).toEqual(["OK"]);
  });

  it("junta as frentes e fica com a maior nota de cada oportunidade", () => {
    const servicos = [op("A", 55, em2dias)];
    const produtos = [op("A", 75, em2dias), op("B", 60, em2dias)];
    const r = escolherParaProposta([servicos, produtos], AGORA, new Set());
    expect(r.map((o) => [o.id, o.score.total])).toEqual([["A", 75], ["B", 60]]);
  });

  it("desempata pelo prazo mais curto e respeita o máximo", () => {
    const lista = [op("T", 70, em4dias), op("S", 70, em2dias)];
    expect(escolherParaProposta([lista], AGORA, new Set(), 1).map((o) => o.id)).toEqual(["S"]);
    expect(escolherParaProposta([lista], AGORA, new Set(), 0)).toEqual([]);
  });
});

describe("prontasPorCompra", () => {
  it("só as do assistente ainda não enviadas, a mais recente de cada compra", () => {
    const mapa = prontasPorCompra([
      { id: "p1", compraId: "C1", autor: "assistente", status: "em_revisao" },
      { id: "p2", compraId: "C1", autor: "assistente", status: "rascunho" },
      { id: "p3", compraId: "C2", autor: "usuario", status: "em_revisao" },
      { id: "p4", compraId: "C3", autor: "assistente", status: "enviada" },
      { id: "p5", compraId: null, autor: "assistente", status: "em_revisao" },
    ]);
    expect(mapa).toEqual({ C1: "p1" });
  });
});
