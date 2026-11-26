import { describe, expect, it } from "vitest";
import {
  dataPrevistaDoGanho,
  diasEntre,
  itemDoCaixa,
  lerValorDigitado,
  montarFluxoCaixa,
  somarDias,
  valorDoGanho,
  type GanhoParaCaixa,
} from "./fluxo-caixa";

const HOJE = "2026-11-26";

function ganho(parcial: Partial<GanhoParaCaixa> = {}): GanhoParaCaixa {
  return {
    id: "G1",
    objeto: "Fornecimento de material de escritório",
    orgao: "Prefeitura de teste",
    valorEstimado: 10_000,
    valorProposto: null,
    valorHomologado: null,
    valorRecebido: null,
    custoReal: null,
    comissaoAjuste: null,
    pagamentoPrevisto: null,
    recebidoEm: null,
    ganhoEm: "2026-11-01T15:00:00.000Z",
    prazoEntregaDias: null,
    prazoPagamentoDias: null,
    frente: "produtos",
    ...parcial,
  };
}

describe("datas", () => {
  it("soma dias e conta a diferença pelo dia civil", () => {
    expect(somarDias("2026-11-26", 5)).toBe("2026-12-01");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(diasEntre("2026-11-01", "2026-11-26")).toBe(25);
    expect(diasEntre("2026-11-26", "2026-11-01")).toBe(-25);
  });
});

describe("valor digitado", () => {
  it("lê formato brasileiro e americano", () => {
    expect(lerValorDigitado("1.234,56")).toBe(1234.56);
    expect(lerValorDigitado("R$ 900")).toBe(900);
    expect(lerValorDigitado("12,5")).toBe(12.5);
    expect(lerValorDigitado("1234.56")).toBe(1234.56);
    expect(lerValorDigitado("10.000")).toBe(10_000);
  });

  it("recusa o que não é número", () => {
    expect(lerValorDigitado("")).toBeNull();
    expect(lerValorDigitado("abc")).toBeNull();
    expect(lerValorDigitado("-5")).toBeNull();
    expect(lerValorDigitado("1,2,3")).toBeNull();
  });
});

describe("valor da entrada", () => {
  it("segue a ordem recebido, homologado, proposta, estimado", () => {
    expect(valorDoGanho(ganho({ valorRecebido: 900, valorHomologado: 800, valorProposto: 700 }))).toEqual({ valor: 900, origem: "recebido" });
    expect(valorDoGanho(ganho({ valorHomologado: 800, valorProposto: 700 }))).toEqual({ valor: 800, origem: "homologado" });
    expect(valorDoGanho(ganho({ valorProposto: 700 }))).toEqual({ valor: 700, origem: "proposta" });
    expect(valorDoGanho(ganho())).toEqual({ valor: 10_000, origem: "estimado" });
    expect(valorDoGanho(ganho({ valorEstimado: null }))).toEqual({ valor: 0, origem: "nenhuma" });
  });
});

describe("data prevista", () => {
  it("usa a data combinada quando existe", () => {
    expect(dataPrevistaDoGanho(ganho({ pagamentoPrevisto: "2026-12-15" }), HOJE)).toEqual({ data: "2026-12-15", estimada: false });
  });

  it("sem ficha: vitória + 30 dias de entrega + 30 de pagamento", () => {
    expect(dataPrevistaDoGanho(ganho(), HOJE)).toEqual({ data: "2026-12-31", estimada: true });
  });

  it("com ficha: soma a entrega e o pagamento do edital", () => {
    const g = ganho({ prazoEntregaDias: 10, prazoPagamentoDias: 15 });
    expect(dataPrevistaDoGanho(g, HOJE)).toEqual({ data: "2026-11-26", estimada: true });
  });

  it("sem data da vitória, parte de hoje", () => {
    expect(dataPrevistaDoGanho(ganho({ ganhoEm: null }), HOJE).data).toBe("2027-01-25");
  });
});

describe("item do caixa", () => {
  it("a receber com custo estimado e comissão padrão", () => {
    const i = itemDoCaixa(ganho(), 12, HOJE);
    expect(i.status).toBe("a-receber");
    expect(i.valor).toBe(10_000);
    expect(i.comissao).toBe(1_200);
    expect(i.custo).toBe(8_000);
    expect(i.custoEstimado).toBe(true);
    expect(i.resultado).toBe(800);
    expect(i.comissaoAjustada).toBe(false);
  });

  it("usa custo real e o ajuste de comissão da licitação", () => {
    const i = itemDoCaixa(ganho({ custoReal: 6_000, comissaoAjuste: 15 }), 12, HOJE);
    expect(i.custo).toBe(6_000);
    expect(i.custoEstimado).toBe(false);
    expect(i.comissaoPercentual).toBe(15);
    expect(i.comissao).toBe(1_500);
    expect(i.resultado).toBe(2_500);
    expect(i.comissaoAjustada).toBe(true);
  });

  it("atrasado quando a data já passou sem receber", () => {
    const i = itemDoCaixa(ganho({ pagamentoPrevisto: "2026-11-20" }), 12, HOJE);
    expect(i.status).toBe("atrasado");
    expect(i.diasAtraso).toBe(6);
  });

  it("vencendo hoje ainda é a receber", () => {
    expect(itemDoCaixa(ganho({ pagamentoPrevisto: HOJE }), 12, HOJE).status).toBe("a-receber");
  });

  it("recebido usa o valor recebido e a data do recebimento", () => {
    const i = itemDoCaixa(ganho({ pagamentoPrevisto: "2026-11-01", recebidoEm: "2026-11-10", valorRecebido: 9_500 }), 12, HOJE);
    expect(i.status).toBe("recebido");
    expect(i.valor).toBe(9_500);
    expect(i.dataPrevista).toBe("2026-11-10");
    expect(i.recebidoEm).toBe("2026-11-10");
    expect(i.diasAtraso).toBe(0);
  });

  it("sem nenhum valor, não entra dinheiro nem comissão", () => {
    const i = itemDoCaixa(ganho({ valorEstimado: null }), 12, HOJE);
    expect(i.valor).toBe(0);
    expect(i.comissao).toBe(0);
    expect(i.custo).toBe(0);
  });
});

describe("fluxo por mês", () => {
  it("agrupa, soma e resume", () => {
    const fluxo = montarFluxoCaixa(
      [
        ganho({ id: "A", valorEstimado: 10_000, custoReal: 7_000, recebidoEm: "2026-11-05", valorRecebido: 10_000 }),
        ganho({ id: "B", valorEstimado: 5_000, custoReal: 3_000, pagamentoPrevisto: "2026-11-15" }),
        ganho({ id: "C", valorEstimado: 20_000, custoReal: 12_000, pagamentoPrevisto: "2026-12-20", comissaoAjuste: 10 }),
      ],
      12,
      HOJE,
    );
    expect(fluxo.meses.map((m) => m.mes)).toEqual(["2026-11", "2026-12"]);
    const nov = fluxo.meses[0];
    expect(nov.recebido).toBe(10_000);
    expect(nov.aReceber).toBe(5_000);
    expect(nov.custo).toBe(10_000);
    expect(nov.comissao).toBe(1_800);
    expect(nov.saldo).toBe(3_200);
    expect(nov.itens.map((i) => i.id)).toEqual(["A", "B"]);
    const dez = fluxo.meses[1];
    expect(dez.aReceber).toBe(20_000);
    expect(dez.comissao).toBe(2_000);
    expect(dez.saldo).toBe(6_000);

    expect(fluxo.resumo).toEqual({ aReceber: 25_000, atrasado: 5_000, recebidoNoMes: 10_000, saldo: 9_200 });
  });

  it("sem ganhos, tudo zerado", () => {
    expect(montarFluxoCaixa([], 12, HOJE)).toEqual({
      meses: [],
      resumo: { aReceber: 0, atrasado: 0, recebidoNoMes: 0, saldo: 0 },
    });
  });
});
