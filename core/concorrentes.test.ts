import { describe, expect, it } from "vitest";
import {
  calcularEstatisticas,
  descontoPct,
  ehParecida,
  palavrasChaveDoObjeto,
  selecionarParecidas,
  valorProvavel,
  type AmostraConcorrente,
} from "./concorrentes";

function amostra(p: Partial<AmostraConcorrente> & { idPncp: string }): AmostraConcorrente {
  return {
    objeto: "Aquisição de computadores desktop",
    uf: "RJ",
    orgao: "Prefeitura",
    valorEstimado: 100_000,
    valorHomologado: 90_000,
    publicadaEm: "2026-06-01T10:00:00.000Z",
    link: "https://pncp.gov.br/app/editais/1/2026/1",
    ...p,
  };
}

describe("palavrasChaveDoObjeto", () => {
  it("tira acento, genéricas, números e repetidas; singulariza", () => {
    expect(palavrasChaveDoObjeto("Contratação de empresa especializada em manutenção de Computadores e computador, 2026")).toEqual([
      "manutencao",
      "computador",
    ]);
  });
  it("limita a 6, as mais longas primeiro", () => {
    const r = palavrasChaveDoObjeto("alfa beta gama delta epsilon zeta etapa omega sigma lambda");
    expect(r).toHaveLength(6);
    expect(r[0]).toBe("epsilon");
  });
});

describe("ehParecida", () => {
  const palavras = ["manutencao", "computador", "impressora"];
  it("exige 2 palavras (singular ou plural)", () => {
    expect(ehParecida(palavras, "Manutenção de computadores e notebooks")).toBe(true);
    expect(ehParecida(palavras, "Manutenção de ar-condicionado")).toBe(false);
  });
  it("objeto com uma só palavra-chave casa com ela", () => {
    expect(ehParecida(["software"], "Licença de software")).toBe(true);
    expect(ehParecida([], "qualquer coisa")).toBe(false);
  });
});

describe("selecionarParecidas", () => {
  const palavras = ["computador", "desktop"];
  it("mesma UF primeiro, exclui a própria licitação e as sem homologado ou sem semelhança", () => {
    const lista = selecionarParecidas(
      [
        amostra({ idPncp: "a", uf: "SP", publicadaEm: "2026-09-01T00:00:00.000Z" }),
        amostra({ idPncp: "b", uf: "RJ", publicadaEm: "2026-01-01T00:00:00.000Z" }),
        amostra({ idPncp: "c", uf: "RJ", objeto: "Cadeiras de escritório" }),
        amostra({ idPncp: "d", uf: "RJ", valorHomologado: 0 }),
        amostra({ idPncp: "propria", uf: "RJ" }),
      ],
      palavras,
      "rj",
      "propria",
    );
    expect(lista.map((x) => x.idPncp)).toEqual(["b", "a"]);
    expect(lista[0].mesmaUf).toBe(true);
    expect(lista[1].mesmaUf).toBe(false);
  });
});

describe("estatísticas dos concorrentes", () => {
  it("média, mínimo, máximo e nº de amostras", () => {
    const e = calcularEstatisticas([
      amostra({ idPncp: "1", valorHomologado: 80_000 }),
      amostra({ idPncp: "2", valorHomologado: 100_000 }),
      amostra({ idPncp: "3", valorHomologado: 120_000 }),
    ]);
    expect(e).toMatchObject({ amostras: 3, media: 100_000, minimo: 80_000, maximo: 120_000 });
  });

  it("desconto médio sobre o estimado, ignorando quem não tem estimado", () => {
    const e = calcularEstatisticas([
      amostra({ idPncp: "1", valorEstimado: 100_000, valorHomologado: 90_000 }), // 10%
      amostra({ idPncp: "2", valorEstimado: 200_000, valorHomologado: 150_000 }), // 25%
      amostra({ idPncp: "3", valorEstimado: null, valorHomologado: 50_000 }),
    ]);
    expect(e.descontoMedioPct).toBeCloseTo(17.5, 6);
    expect(e.amostrasComDesconto).toBe(2);
    expect(e.amostras).toBe(3);
  });

  it("sem amostras, tudo nulo", () => {
    expect(calcularEstatisticas([])).toEqual({
      amostras: 0,
      media: null,
      minimo: null,
      maximo: null,
      descontoMedioPct: null,
      amostrasComDesconto: 0,
    });
  });

  it("descontoPct e valorProvavel", () => {
    expect(descontoPct(100, 80)).toBeCloseTo(20, 6);
    expect(descontoPct(null, 80)).toBeNull();
    expect(descontoPct(0, 80)).toBeNull();
    expect(valorProvavel(50_000, 20)).toBeCloseTo(40_000, 6);
    expect(valorProvavel(null, 20)).toBeNull();
    expect(valorProvavel(50_000, null)).toBeNull();
  });
});

describe("montarResultado", () => {
  it("lista só as 5 mais parecidas, mas as estatísticas usam todas", async () => {
    const { montarResultado } = await import("./concorrentes");
    const todas = Array.from({ length: 7 }, (_, i) => amostra({ idPncp: `x${i}`, valorHomologado: 90_000 + i * 1000 }));
    const r = montarResultado(todas, "Aquisição de computadores desktop", "RJ", "outro", 50_000);
    expect(r.maisParecidas).toHaveLength(5);
    expect(r.estatisticas.amostras).toBe(7);
    expect(r.naMesmaUf).toBe(7);
    expect(r.valorProvavel).not.toBeNull();
  });
});
