import { describe, expect, it } from "vitest";
import { calcularResultados, mesesDoPeriodo, rotuloMes, type ItemResultado } from "./resultados";

const AGORA = new Date("2026-11-12T10:00:00.000Z");
const MENSAL = { prazoEntregaDias: 10, prazoPagamentoDias: 30, medicaoMensal: true, pagamentoAntecipado: false };
const UNICO = { prazoEntregaDias: 10, prazoPagamentoDias: 30, medicaoMensal: false, pagamentoAntecipado: false };

function item(id: string, etapa: string, etapaEm: string, valorEstimado: number | null, extra: Partial<ItemResultado> = {}): ItemResultado {
  return { id, etapa, etapaEm, valorEstimado, valorProposto: null, ficha: null, ...extra };
}

describe("mesesDoPeriodo", () => {
  it("conta para trás e atravessa o ano", () => {
    expect(mesesDoPeriodo(new Date("2026-02-10T12:00:00Z"), 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
    expect(mesesDoPeriodo(AGORA, 1)).toEqual(["2026-11"]);
    expect(mesesDoPeriodo(AGORA, 12)).toHaveLength(12);
    expect(rotuloMes("2026-03")).toBe("mar/26");
  });
});

describe("calcularResultados", () => {
  const itens: ItemResultado[] = [
    item("g1", "ganha", "2026-10-15T12:00:00Z", 120000, { ficha: MENSAL }),
    item("g2", "ganha", "2026-11-05T12:00:00Z", 50000, { valorProposto: 40000, ficha: UNICO }),
    item("g3", "ganha", "2026-01-10T12:00:00Z", 30000, { ficha: UNICO }),
    item("p1", "perdida", "2026-11-01T12:00:00Z", 10000),
    item("p2", "perdida", "2026-01-01T12:00:00Z", 10000),
    item("x", "disputa", "2026-11-01T12:00:00Z", 99999),
  ];
  const movimentos = [
    { itemId: "g1", em: "2026-10-01T12:00:00Z" },
    { itemId: "g1", em: "2026-10-10T12:00:00Z" },
    { itemId: "p1", em: "2026-11-02T12:00:00Z" },
    { itemId: "velho", em: "2026-01-02T12:00:00Z" },
  ];
  const propostasEnviadasEm = ["2026-10-20T12:00:00Z", "2026-11-03T12:00:00Z", "2026-02-03T12:00:00Z"];

  it("agrega o período de 3 meses", () => {
    const r = calcularResultados({ agora: AGORA, periodo: 3, itens, movimentos, propostasEnviadasEm });
    expect(r.analisadas).toBe(2);
    expect(r.propostasEnviadas).toBe(2);
    expect(r.ganhas).toBe(2);
    expect(r.perdidas).toBe(1);
    expect(r.taxaVitoria).toBeCloseTo(2 / 3);
    expect(r.valorGanho).toBe(160000);
    expect(r.receitaMensal).toBe(10000);
    expect(r.porMes.map((m) => [m.mes, m.ganhas, m.valorGanho])).toEqual([
      ["2026-09", 0, 0],
      ["2026-10", 1, 120000],
      ["2026-11", 1, 40000],
    ]);
  });

  it("capital comprometido conta só ganhas em andamento, de qualquer época", () => {
    const r = calcularResultados({ agora: AGORA, periodo: 1, itens, movimentos, propostasEnviadasEm });
    // g1 (mensal, 12 meses) = 80% de 10.000; g2 (recebe em 40 dias, em andamento) = 80% de 40.000; g3 (janeiro) já recebeu.
    expect(r.ganhasEmAndamento).toBe(2);
    expect(r.capitalComprometido).toBeCloseTo(8000 + 32000);
    expect(r.ganhas).toBe(1);
    expect(r.porMes).toHaveLength(1);
  });

  it("sem disputas decididas a taxa é nula", () => {
    const r = calcularResultados({ agora: AGORA, periodo: 1, itens: [], movimentos: [], propostasEnviadasEm: [] });
    expect(r.taxaVitoria).toBeNull();
    expect(r.valorGanho).toBe(0);
  });
});
