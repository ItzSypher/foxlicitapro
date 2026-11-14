import { describe, expect, it } from "vitest";
import { margemEmPercentual, resumirCotacoes, type CotacaoParaResumo } from "./cotacoes-resumo";

function cotacao(parcial: Partial<CotacaoParaResumo>): CotacaoParaResumo {
  return {
    descricao: "Monitor 24 polegadas",
    frente: "produtos",
    precoVenda: 1000,
    custo: 700,
    margem: 0.2,
    criadoEm: "2026-11-01T10:00:00.000Z",
    ...parcial,
  };
}

describe("resumirCotacoes", () => {
  it("devolve null sem cotações", () => {
    expect(resumirCotacoes([])).toBeNull();
  });

  it("calcula quantidade, média, menor e maior de venda e de custo", () => {
    const r = resumirCotacoes([
      cotacao({ precoVenda: 1000, custo: 700 }),
      cotacao({ precoVenda: 1200, custo: 800, criadoEm: "2026-11-02T10:00:00.000Z" }),
      cotacao({ precoVenda: 1100, custo: 600, criadoEm: "2026-11-03T10:00:00.000Z" }),
    ]);
    const g = r?.frentes[0];
    expect(r?.quantidade).toBe(3);
    expect(g?.venda).toEqual({ media: 1100, menor: 1000, maior: 1200 });
    expect(g?.custo).toEqual({ media: 700, menor: 600, maior: 800 });
  });

  it("usa a cotação mais recente no selo", () => {
    const r = resumirCotacoes([
      cotacao({ precoVenda: 900, margem: 0.1, criadoEm: "2026-11-01T10:00:00.000Z" }),
      cotacao({ precoVenda: 1500, margem: 0.25, criadoEm: "2026-11-05T10:00:00.000Z" }),
    ]);
    expect(r?.ultima.precoVenda).toBe(1500);
    expect(margemEmPercentual(r?.ultima.margem ?? 0)).toBe(25);
  });

  it("separa por frente (produtos antes de serviços) e agrupa listas pela descrição normalizada", () => {
    const r = resumirCotacoes([
      cotacao({ descricao: "Instalação de câmeras", frente: "servicos", precoVenda: 500, custo: 300 }),
      cotacao({ descricao: "Monitor 24 Polegadas!", precoVenda: 1000 }),
      cotacao({ descricao: "monitor 24 polegadas", precoVenda: 1400, criadoEm: "2026-11-02T10:00:00.000Z" }),
      cotacao({ descricao: "Teclado", precoVenda: 80, custo: 50 }),
    ]);
    expect(r?.frentes.map((g) => g.frente)).toEqual(["produtos", "servicos"]);
    const produtos = r?.frentes[0];
    expect(produtos?.quantidade).toBe(3);
    expect(produtos?.listas).toHaveLength(2);
    const monitor = produtos?.listas.find((l) => l.chave === "monitor 24 polegadas");
    expect(monitor?.quantidade).toBe(2);
    expect(monitor?.descricao).toBe("monitor 24 polegadas");
    expect(monitor?.venda).toEqual({ media: 1200, menor: 1000, maior: 1400 });
    expect(r?.frentes[1]?.listas).toHaveLength(1);
  });
});
