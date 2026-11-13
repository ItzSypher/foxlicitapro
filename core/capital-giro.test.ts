import { describe, expect, it } from "vitest";
import { calcularCapitalGiro } from "./capital-giro";

const base = { prazoEntregaDias: null, prazoPagamentoDias: null, medicaoMensal: null, pagamentoAntecipado: null };

describe("calcularCapitalGiro", () => {
  it("soma entrega e pagamento e classifica em baixo até 30 dias", () => {
    const r = calcularCapitalGiro({ ...base, prazoEntregaDias: 5, prazoPagamentoDias: 25 });
    expect(r.dias).toBe(30);
    expect(r.nivel).toBe("baixo");
    expect(r.motivo).toContain("30 dias com dinheiro parado");
  });

  it("classifica em médio de 31 a 60 dias", () => {
    expect(calcularCapitalGiro({ ...base, prazoEntregaDias: 10, prazoPagamentoDias: 21 }).nivel).toBe("medio");
    expect(calcularCapitalGiro({ ...base, prazoEntregaDias: 30, prazoPagamentoDias: 30 }).nivel).toBe("medio");
  });

  it("classifica em alto acima de 60 dias", () => {
    const r = calcularCapitalGiro({ ...base, prazoEntregaDias: 45, prazoPagamentoDias: 30 });
    expect(r.dias).toBe(75);
    expect(r.nivel).toBe("alto");
  });

  it("pagamento antecipado deixa o capital baixo, mesmo com prazos longos", () => {
    const r = calcularCapitalGiro({ ...base, prazoEntregaDias: 60, prazoPagamentoDias: 60, pagamentoAntecipado: true });
    expect(r.nivel).toBe("baixo");
    expect(r.dias).toBe(120);
    expect(r.motivo).toContain("antecipado");
  });

  it("medição mensal sem prazo de entrega conta 30 dias de serviço", () => {
    const r = calcularCapitalGiro({ ...base, medicaoMensal: true, prazoPagamentoDias: 30 });
    expect(r.dias).toBe(60);
    expect(r.nivel).toBe("medio");
    expect(r.motivo).toContain("medição");
  });

  it("sem os dois prazos não estima", () => {
    expect(calcularCapitalGiro({ ...base, prazoEntregaDias: 10 })).toMatchObject({ dias: null, nivel: null });
    expect(calcularCapitalGiro({ ...base, prazoPagamentoDias: 30 })).toMatchObject({ dias: null, nivel: null });
    expect(calcularCapitalGiro(base)).toMatchObject({ dias: null, nivel: null });
  });

  it("aceita prazo zero e singular", () => {
    const r = calcularCapitalGiro({ ...base, prazoEntregaDias: 0, prazoPagamentoDias: 1 });
    expect(r.dias).toBe(1);
    expect(r.motivo).toContain("1 dia com dinheiro parado");
  });
});
