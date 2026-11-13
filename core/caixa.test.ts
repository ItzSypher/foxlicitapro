import { describe, expect, it } from "vitest";
import {
  ALERTA_CAIXA,
  FRACAO_CUSTO_ESTIMADA,
  SEM_LIMITES,
  avaliarLimites,
  calcularCaixa,
  capitalNecessario,
  type EntradaCaixa,
} from "./caixa";

const INICIO = new Date("2026-11-02T12:00:00.000Z");

function entrada(sobrescrever: Partial<EntradaCaixa> = {}): EntradaCaixa {
  return {
    custoTotal: 10_000,
    prazoEntregaDias: 15,
    prazoPagamentoDias: 30,
    medicaoMensal: false,
    pagamentoAntecipado: false,
    valorContrato: 14_000,
    mesesContrato: null,
    inicio: INICIO,
    limites: SEM_LIMITES,
    ...sobrescrever,
  };
}

describe("capitalNecessario", () => {
  it("usa o custo informado", () => {
    expect(capitalNecessario(10_000, 50_000)).toEqual({ valor: 10_000, fonte: "informado" });
  });
  it("sem custo, estima pelo valor do edital", () => {
    expect(capitalNecessario(null, 10_000)).toEqual({ valor: 10_000 * FRACAO_CUSTO_ESTIMADA, fonte: "estimado" });
    expect(capitalNecessario(0, 10_000)?.fonte).toBe("estimado");
  });
  it("sem nada, null", () => {
    expect(capitalNecessario(null, null)).toBeNull();
  });
});

describe("calcularCaixa", () => {
  it("soma entrega e pagamento e projeta a data de recebimento", () => {
    const r = calcularCaixa(entrada());
    expect(r.capital).toEqual({ valor: 10_000, fonte: "informado" });
    expect(r.diasParado).toBe(45);
    expect(r.dataRecebimento).toBe("2026-12-17T12:00:00.000Z");
    expect(r.receitaMensal).toBe(false);
    expect(r.valorMensal).toBeNull();
    expect(r.totalContrato).toBe(14_000);
    expect(r.faltando).toEqual([]);
  });

  it("receita mensal: valor mensal pelo prazo padrão de 12 meses e total do contrato", () => {
    const r = calcularCaixa(entrada({ medicaoMensal: true, prazoEntregaDias: null, valorContrato: 120_000 }));
    expect(r.receitaMensal).toBe(true);
    expect(r.mesesContrato).toBe(12);
    expect(r.valorMensal).toBe(10_000);
    expect(r.totalContrato).toBe(120_000);
    expect(r.diasParado).toBe(60);
  });

  it("receita mensal com duração informada", () => {
    const r = calcularCaixa(entrada({ medicaoMensal: true, mesesContrato: 24, valorContrato: 48_000, custoTotal: null }));
    expect(r.valorMensal).toBe(2_000);
    // sem custo, o capital estimado parte do valor de um mês
    expect(r.capital).toEqual({ valor: 2_000 * FRACAO_CUSTO_ESTIMADA, fonte: "estimado" });
  });

  it("sem prazos não dá data nem dias e pede os prazos", () => {
    const r = calcularCaixa(entrada({ prazoEntregaDias: null, prazoPagamentoDias: null }));
    expect(r.diasParado).toBeNull();
    expect(r.dataRecebimento).toBeNull();
    expect(r.faltando).toEqual(["prazos"]);
  });

  it("sem custo pede o custo", () => {
    const r = calcularCaixa(entrada({ custoTotal: null }));
    expect(r.faltando).toEqual(["custo"]);
  });

  it("sem valor do contrato não inventa valor mensal", () => {
    const r = calcularCaixa(entrada({ medicaoMensal: true, valorContrato: null }));
    expect(r.valorMensal).toBeNull();
    expect(r.totalContrato).toBeNull();
  });
});

describe("avaliarLimites", () => {
  const limites = { capitalMaximo: 5_000, diasMaximosParado: 30 };

  it("sem limites nunca alerta nem pede dado", () => {
    const a = avaliarLimites({ valor: 1e9, fonte: "informado" }, 999, false, SEM_LIMITES);
    expect(a).toMatchObject({ excede: false, faltaDado: false, alerta: null, motivos: [] });
  });

  it("capital acima do máximo vira o alerta", () => {
    const a = avaliarLimites({ valor: 10_000, fonte: "informado" }, 10, false, limites);
    expect(a.excedeCapital).toBe(true);
    expect(a.excedeDias).toBe(false);
    expect(a.alerta).toBe(ALERTA_CAIXA);
    expect(a.motivos).toHaveLength(1);
  });

  it("no limite exato não alerta", () => {
    const a = avaliarLimites({ valor: 5_000, fonte: "informado" }, 30, false, limites);
    expect(a.excede).toBe(false);
  });

  it("dias parado acima do máximo alerta", () => {
    const a = avaliarLimites({ valor: 100, fonte: "informado" }, 45, false, limites);
    expect(a.excedeDias).toBe(true);
    expect(a.alerta).toBe(ALERTA_CAIXA);
  });

  it("pagamento antecipado não conta como dinheiro parado", () => {
    expect(avaliarLimites({ valor: 100, fonte: "informado" }, 90, true, limites).excedeDias).toBe(false);
  });

  it("falta dado quando há limite e nada para comparar", () => {
    expect(avaliarLimites(null, null, null, limites).faltaDado).toBe(true);
    expect(avaliarLimites(null, null, null, limites).excede).toBe(false);
  });

  it("os dois estourados geram dois motivos e um só alerta", () => {
    const a = avaliarLimites({ valor: 9_000, fonte: "estimado" }, 60, false, limites);
    expect(a.motivos).toHaveLength(2);
    expect(a.motivos[0]).toContain("estimado");
    expect(a.alerta).toBe(ALERTA_CAIXA);
  });
});
