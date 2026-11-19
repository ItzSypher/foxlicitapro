import { describe, expect, it } from "vitest";
import type { Faixa, OportunidadeComScore } from "@/core/types";
import { FILTROS_PADRAO } from "./radar-filtros";
import { lerPorPagina, montarPaginaRadar, paginar, type ConsultaRadar } from "./radar-pagina";

const AGORA = Date.parse("2026-11-14T12:00:00-03:00");
const EM_3_DIAS = "2026-11-17T12:00:00-03:00";

function oportunidade(
  n: number,
  extra: Partial<OportunidadeComScore> & { total?: number; faixa?: Faixa } = {},
): OportunidadeComScore {
  const { total = 50, faixa = "go", ...resto } = extra;
  return {
    id: `id-${n}`,
    objeto: `Objeto ${n}`,
    valorEstimado: 1000 * n,
    orgao: `Órgão ${n}`,
    orgaoCnpj: `${n}`.padStart(14, "0"),
    unidade: "",
    municipio: "Rio de Janeiro",
    codigoIbge: "3304557",
    uf: "RJ",
    regiao: "capital",
    modalidadeId: 8,
    modalidadeNome: "Dispensa",
    dataAbertura: null,
    dataEncerramento: EM_3_DIAS,
    anoCompra: 2026,
    sequencialCompra: n,
    linkPncp: "",
    linkOrigem: null,
    score: { total, faixa, criterios: [], cnaesCasados: [], frenteCasada: "servicos" },
    ...resto,
  };
}

function consulta(parcial: Partial<ConsultaRadar> = {}): ConsultaRadar {
  return {
    frente: "servicos",
    filtros: FILTROS_PADRAO,
    aba: "todas",
    busca: "",
    palavras: [],
    palavrasSalvas: [],
    pagina: 1,
    porPagina: 12,
    ...parcial,
  };
}

const lista = Array.from({ length: 30 }, (_, i) => oportunidade(i + 1, { total: i + 1 }));

function montar(c: ConsultaRadar, base = lista) {
  return montarPaginaRadar(base, c, AGORA, AGORA, "2026-11-14T11:30:00-03:00", []);
}

describe("paginar", () => {
  it("recorta a página pedida e informa o intervalo", () => {
    const f = paginar([1, 2, 3, 4, 5, 6, 7], 2, 3);
    expect(f.itens).toEqual([4, 5, 6]);
    expect(f).toMatchObject({ pagina: 2, totalPaginas: 3, inicio: 4, fim: 6 });
  });

  it("página além do fim vira a última; abaixo de 1 vira a primeira", () => {
    expect(paginar([1, 2, 3, 4], 9, 3)).toMatchObject({ itens: [4], pagina: 2, inicio: 4, fim: 4 });
    expect(paginar([1, 2, 3, 4], 0, 3).pagina).toBe(1);
  });

  it("lista vazia tem uma página e intervalo zerado", () => {
    expect(paginar([], 1, 12)).toEqual({ itens: [], pagina: 1, totalPaginas: 1, inicio: 0, fim: 0 });
  });
});

describe("lerPorPagina", () => {
  const de = (valor: string | null) => ({ get: () => valor });
  it("aceita 6, 12 e 18 e cai em 12 no resto", () => {
    expect(lerPorPagina(de("6"))).toBe(6);
    expect(lerPorPagina(de("18"))).toBe(18);
    expect(lerPorPagina(de("25"))).toBe(12);
    expect(lerPorPagina(de(null))).toBe(12);
    expect(lerPorPagina(de("abc"))).toBe(12);
  });
});

describe("página do Radar montada no servidor", () => {
  it("manda só a página atual, da melhor nota para a pior", () => {
    const p = montar(consulta());
    expect(p.itens).toHaveLength(12);
    expect(p.itens[0].id).toBe("id-30");
    expect(p.total).toBe(30);
    expect(p.totalPaginas).toBe(3);
    expect(p.contagensAbas.todas).toBe(30);
  });

  it("última página traz o resto e respeita 6 e 18 por página", () => {
    expect(montar(consulta({ pagina: 3 })).itens).toHaveLength(6);
    expect(montar(consulta({ porPagina: 6, pagina: 5 })).itens).toHaveLength(6);
    expect(montar(consulta({ porPagina: 18, pagina: 2 })).itens).toHaveLength(12);
  });

  it("filtra por UF e modalidade antes de paginar", () => {
    const mista = [
      oportunidade(1, { uf: "MG" }),
      oportunidade(2),
      oportunidade(3, { uf: "ES" }),
      oportunidade(4, { uf: "MG", modalidadeId: 6 }),
    ];
    const p = montar(consulta({ filtros: { ...FILTROS_PADRAO, ufs: ["MG"] } }), mista);
    expect(p.itens.map((i) => i.id).sort()).toEqual(["id-1", "id-4"]);
    expect(p.contagensUf).toEqual({ MG: 2, RJ: 1, ES: 1 });
    const pregoes = montar(consulta({ filtros: { ...FILTROS_PADRAO, modalidade: "pregao" } }), mista);
    expect(pregoes.itens.map((i) => i.id)).toEqual(["id-4"]);
  });

  it("busca sem acento e caixa em objeto, órgão e município", () => {
    const base = [
      oportunidade(1, { objeto: "Manutenção de computadores" }),
      oportunidade(2, { orgao: "Prefeitura de Nova Iguaçu" }),
      oportunidade(3, { municipio: "São João de Meriti" }),
      oportunidade(4),
    ];
    expect(montar(consulta({ busca: "MANUTENCAO" }), base).itens.map((i) => i.id)).toEqual(["id-1"]);
    expect(montar(consulta({ busca: "iguacu" }), base).itens.map((i) => i.id)).toEqual(["id-2"]);
    expect(montar(consulta({ busca: "sao joao" }), base).itens.map((i) => i.id)).toEqual(["id-3"]);
  });

  it("palavras-chave só valem se estiverem guardadas e contam como OU", () => {
    const base = [
      oportunidade(1, { objeto: "Licença de software" }),
      oportunidade(2, { objeto: "Compra de impressora" }),
      oportunidade(3, { objeto: "Merenda" }),
    ];
    const p = montar(consulta({ palavras: ["software", "impressora", "merenda"], palavrasSalvas: ["software", "impressora"] }), base);
    expect(p.selecionadas).toEqual(["software", "impressora"]);
    expect(p.itens.map((i) => i.id).sort()).toEqual(["id-1", "id-2"]);
  });

  it("'Para você' recomenda só faixa boa da frente ativa e devolve os motivos da página", () => {
    const base = [
      oportunidade(1, { total: 80 }),
      oportunidade(2, { total: 20, faixa: "nogo" }),
      oportunidade(3, { total: 70, score: { total: 70, faixa: "go", criterios: [], cnaesCasados: [], frenteCasada: "produtos" } }),
    ];
    const p = montar(consulta({ aba: "para-voce" }), base);
    expect(p.itens.map((i) => i.id)).toEqual(["id-1"]);
    expect(p.motivos["id-1"].length).toBeGreaterThan(0);
    expect(p.contagensAbas).toEqual({ "para-voce": 1, todas: 3, desertas: 0 });
    expect(p.baseRecomendacao).toBe(3);
  });

  it("'Para você' também pagina (6 por página)", () => {
    const boas = Array.from({ length: 9 }, (_, i) => oportunidade(i + 1, { total: 90 - i, orgaoCnpj: `${i}`.padStart(14, "0") }));
    const p1 = montar(consulta({ aba: "para-voce", porPagina: 6 }), boas);
    const p2 = montar(consulta({ aba: "para-voce", porPagina: 6, pagina: 2 }), boas);
    expect(p1.itens).toHaveLength(6);
    expect(p2.itens).toHaveLength(3);
    expect(p1.total).toBe(9);
    expect(Object.keys(p2.motivos)).toHaveLength(3);
  });

  it("resumo conta abertas e quem fecha em 24 h", () => {
    const base = [
      oportunidade(1, { dataEncerramento: "2026-11-14T20:00:00-03:00" }),
      oportunidade(2, { faixa: "atencao" }),
    ];
    const p = montar(consulta(), base);
    expect(p.resumo.abertas).toBe(2);
    expect(p.resumo.encerram24h).toBe(1);
  });

  it("faixa de valor tira o que está fora e os sem valor", () => {
    const base = [oportunidade(1), oportunidade(5), oportunidade(9), oportunidade(10, { valorEstimado: null })];
    const ids = (min: number | null, max: number | null) =>
      montar(consulta({ filtros: { ...FILTROS_PADRAO, valorMin: min, valorMax: max } }), base).itens.map((i) => i.id).sort();
    expect(ids(2000, 6000)).toEqual(["id-5"]);
    expect(ids(5000, null)).toEqual(["id-5", "id-9"]);
    expect(ids(null, 1000)).toEqual(["id-1"]);
  });

  it("filtra por fonte do link de origem", () => {
    const base = [
      oportunidade(1, { linkOrigem: "https://bnccompras.com/x" }),
      oportunidade(2, { linkOrigem: "https://bllcompras.com/y" }),
      oportunidade(3),
    ];
    const p = montar(consulta({ filtros: { ...FILTROS_PADRAO, fontes: ["BNC", "Outro portal"] } }), base);
    expect(p.itens.map((i) => i.id).sort()).toEqual(["id-1", "id-3"]);
    expect(p.contagensFonte).toEqual({ BNC: 1, BLL: 1, "Outro portal": 1 });
  });

  it("'Tudo do meu ramo' mostra o que casa com CNAE ou palavra-chave, mesmo nogo, ordenado pela nota", () => {
    const base = [
      oportunidade(1, { total: 20, faixa: "nogo", score: { total: 20, faixa: "nogo", criterios: [], cnaesCasados: ["95.11-8-00"], frenteCasada: "servicos" } }),
      oportunidade(2, { total: 80, faixa: "go", score: { total: 80, faixa: "go", criterios: [], cnaesCasados: ["95.11-8-00"], frenteCasada: "servicos" } }),
      oportunidade(3, { objeto: "Aquisição de cadeiras", score: { total: 60, faixa: "atencao", criterios: [], cnaesCasados: [], frenteCasada: null } }),
      oportunidade(4, { objeto: "Compra de toner", score: { total: 10, faixa: "nogo", criterios: [], cnaesCasados: [], frenteCasada: null } }),
    ];
    const c = consulta({
      aba: "para-voce",
      filtros: { ...FILTROS_PADRAO, tudoDoRamo: true },
      palavrasSalvas: ["cadeiras"],
    });
    const p = montar(c, base);
    expect(p.tudoDoRamo).toBe(true);
    expect(p.itens.map((i) => i.id)).toEqual(["id-2", "id-3", "id-1"]);
    expect(p.motivos["id-3"]).toEqual(["Palavra-chave: cadeiras"]);
  });
});

describe("aba Desertas", () => {
  const desertas = Array.from({ length: 5 }, (_, i) => ({
    id: `d-${i}`,
    uf: "RJ",
    codigoIbge: "3304557",
    municipio: "Rio de Janeiro",
    orgao: `Órgão ${i}`,
    orgaoCnpj: `${i}`.padStart(14, "0"),
    unidade: "",
    objeto: `Objeto ${i}`,
    valorEstimado: 100 * i,
    itensSemVencedor: 1,
    totalItens: 1,
    situacao: "deserta" as const,
    desertaEm: "2026-11-10T12:00:00-03:00",
    anoCompra: 2026,
    sequencialCompra: i + 1,
    linkPncp: "",
  }));

  it("pagina as desertas e deixa a lista de oportunidades vazia", () => {
    const p = montar(consulta({ aba: "desertas", desertas, porPagina: 2, pagina: 3 }));
    expect(p.itens).toEqual([]);
    expect(p.desertas.map((d) => d.id)).toEqual(["d-4"]);
    expect(p.total).toBe(5);
    expect(p.totalPaginas).toBe(3);
    expect(p.contagensAbas.desertas).toBe(5);
  });

  it("conta as desertas nas outras abas sem listá-las", () => {
    const p = montar(consulta({ aba: "todas", desertas }));
    expect(p.desertas).toEqual([]);
    expect(p.contagensAbas.desertas).toBe(5);
  });
});
