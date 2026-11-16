import { describe, expect, it } from "vitest";
import {
  FILTROS_PADRAO,
  calcularResultados,
  consultaResultados,
  deslocarPeriodo,
  lerFiltros,
  lerPeriodo,
  linhasParaCsv,
  listarLinhas,
  mesesDoPeriodo,
  mesesDoSeletor,
  rotuloMes,
  tituloRelatorio,
  type ItemResultado,
  type PeriodoResultados,
} from "./resultados";

const AGORA = new Date("2026-11-12T10:00:00.000Z");
const MENSAL = { prazoEntregaDias: 10, prazoPagamentoDias: 30, medicaoMensal: true, pagamentoAntecipado: false };
const UNICO = { prazoEntregaDias: 10, prazoPagamentoDias: 30, medicaoMensal: false, pagamentoAntecipado: false };
const TRES_MESES: PeriodoResultados = { tipo: "ultimos", meses: 3 };
const NOVEMBRO: PeriodoResultados = { tipo: "mes", mes: "2026-11" };
const ANA = "11111111-1111-4111-8111-111111111111";

function item(id: string, etapa: string, etapaEm: string, valorEstimado: number | null, extra: Partial<ItemResultado> = {}): ItemResultado {
  return {
    id,
    etapa,
    etapaEm,
    valorEstimado,
    valorProposto: null,
    ficha: null,
    objeto: `Objeto ${id}`,
    orgao: "Prefeitura",
    regiao: "nova-iguacu",
    frente: "servicos",
    responsavelId: null,
    responsavelNome: null,
    valorHomologado: null,
    custoReal: null,
    fechadoEm: null,
    motivoPerda: null,
    ...extra,
  };
}

describe("mesesDoPeriodo e seletor", () => {
  it("conta para trás e atravessa o ano", () => {
    expect(mesesDoPeriodo(new Date("2026-02-10T12:00:00Z"), 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
    expect(mesesDoPeriodo(AGORA, 1)).toEqual(["2026-11"]);
    expect(mesesDoPeriodo(AGORA, 12)).toHaveLength(12);
    expect(rotuloMes("2026-03")).toBe("mar/26");
  });

  it("cobre mês, últimos meses e ano (o corrente só até o mês atual)", () => {
    expect(mesesDoSeletor(NOVEMBRO, AGORA)).toEqual(["2026-11"]);
    expect(mesesDoSeletor({ tipo: "ultimos", meses: 12 }, AGORA)).toHaveLength(12);
    expect(mesesDoSeletor({ tipo: "ano", ano: 2026 }, AGORA)).toHaveLength(11);
    expect(mesesDoSeletor({ tipo: "ano", ano: 2025 }, AGORA)).toHaveLength(12);
  });

  it("lê o período da URL e volta ao padrão no que for inválido", () => {
    expect(lerPeriodo({}, AGORA)).toEqual(TRES_MESES);
    expect(lerPeriodo({ periodo: "12" }, AGORA)).toEqual({ tipo: "ultimos", meses: 12 });
    expect(lerPeriodo({ periodo: "1" }, AGORA)).toEqual(NOVEMBRO);
    expect(lerPeriodo({ periodo: "mes", mes: "2026-10" }, AGORA)).toEqual({ tipo: "mes", mes: "2026-10" });
    expect(lerPeriodo({ periodo: "mes", mes: "2027-01" }, AGORA)).toEqual(NOVEMBRO);
    expect(lerPeriodo({ periodo: "mes", mes: "abc" }, AGORA)).toEqual(NOVEMBRO);
    expect(lerPeriodo({ periodo: "ano", ano: "2025" }, AGORA)).toEqual({ tipo: "ano", ano: 2025 });
    expect(lerPeriodo({ periodo: "ano", ano: "2099" }, AGORA)).toEqual({ tipo: "ano", ano: 2026 });
  });

  it("anda de mês em mês e de ano em ano, sem entrar no futuro", () => {
    expect(deslocarPeriodo(NOVEMBRO, -1, AGORA)).toEqual({ tipo: "mes", mes: "2026-10" });
    expect(deslocarPeriodo(NOVEMBRO, 1, AGORA)).toBeNull();
    expect(deslocarPeriodo({ tipo: "mes", mes: "2026-01" }, -1, AGORA)).toEqual({ tipo: "mes", mes: "2025-12" });
    expect(deslocarPeriodo({ tipo: "ano", ano: 2025 }, 1, AGORA)).toEqual({ tipo: "ano", ano: 2026 });
    expect(deslocarPeriodo({ tipo: "ano", ano: 2026 }, 1, AGORA)).toBeNull();
    expect(deslocarPeriodo(TRES_MESES, -1, AGORA)).toBeNull();
  });

  it("monta o título do relatório", () => {
    expect(tituloRelatorio(NOVEMBRO, AGORA)).toBe("Relatório de resultados — novembro/2026");
    expect(tituloRelatorio(TRES_MESES, AGORA)).toBe("Relatório de resultados — set/26 a nov/26");
    expect(tituloRelatorio({ tipo: "ano", ano: 2025 }, AGORA)).toBe("Relatório de resultados — 2025");
  });
});

describe("filtros na URL", () => {
  it("lê e devolve só o que foge do padrão", () => {
    expect(lerFiltros({})).toEqual(FILTROS_PADRAO);
    const f = lerFiltros({ etapa: "ganha", regiao: "capital", frente: "produtos", resp: ANA, ordem: "lucro", dir: "asc" });
    expect(f).toEqual({ etapa: "ganha", regiao: "capital", frente: "produtos", responsavel: ANA, ordem: "lucro", direcao: "asc" });
    expect(consultaResultados(NOVEMBRO, FILTROS_PADRAO)).toBe("?periodo=mes&mes=2026-11");
    expect(consultaResultados(TRES_MESES, f)).toBe(`?periodo=3&etapa=ganha&regiao=capital&frente=produtos&resp=${ANA}&ordem=lucro&dir=asc`);
  });

  it("ignora valores desconhecidos", () => {
    expect(lerFiltros({ etapa: "x", regiao: "lua", frente: "y", resp: "não é id", ordem: "z", dir: "w" })).toEqual(FILTROS_PADRAO);
    expect(lerFiltros({ resp: "sem" }).responsavel).toBe("sem");
  });
});

describe("calcularResultados", () => {
  const itens: ItemResultado[] = [
    item("g1", "ganha", "2026-10-15T12:00:00Z", 120000, { ficha: MENSAL, custoReal: 90000, regiao: "capital", frente: "produtos", responsavelId: ANA, responsavelNome: "Ana" }),
    item("g2", "ganha", "2026-11-05T12:00:00Z", 50000, { valorProposto: 40000, ficha: UNICO, valorHomologado: 38000, custoReal: 30000 }),
    item("g3", "ganha", "2026-01-10T12:00:00Z", 30000, { ficha: UNICO }),
    item("g4", "ganha", "2026-11-06T12:00:00Z", 20000, { ficha: UNICO, regiao: "baixada", frente: null }),
    item("p1", "perdida", "2026-11-01T12:00:00Z", 10000, { motivoPerda: "preco", regiao: "capital" }),
    item("p2", "perdida", "2026-01-01T12:00:00Z", 10000),
    item("p3", "perdida", "2026-10-20T12:00:00Z", 10000, { motivoPerda: "preco" }),
    item("p4", "perdida", "2026-10-21T12:00:00Z", 10000),
    item("x", "disputa", "2026-11-01T12:00:00Z", 99999),
  ];
  const movimentos = [
    { itemId: "g1", em: "2026-10-01T12:00:00Z" },
    { itemId: "g1", em: "2026-10-10T12:00:00Z" },
    { itemId: "p1", em: "2026-11-02T12:00:00Z" },
    { itemId: "velho", em: "2026-01-02T12:00:00Z" },
  ];
  const propostasEnviadasEm = ["2026-10-20T12:00:00Z", "2026-11-03T12:00:00Z", "2026-02-03T12:00:00Z"];
  const base = { agora: AGORA, itens, movimentos, propostasEnviadasEm };

  it("agrega contagens, valores e taxa de vitória de 3 meses", () => {
    const r = calcularResultados({ ...base, periodo: TRES_MESES });
    expect(r.analisadas).toBe(2);
    expect(r.propostasEnviadas).toBe(2);
    expect(r.ganhas).toBe(3);
    expect(r.perdidas).toBe(3);
    expect(r.taxaVitoria).toBeCloseTo(0.5);
    // g1 120.000 (estimado) + g2 38.000 (homologado) + g4 20.000
    expect(r.valorGanho).toBe(178000);
    expect(r.ticketMedio).toBeCloseTo(178000 / 3);
    expect(r.receitaMensal).toBe(10000);
    expect(r.porMes.map((m) => [m.mes, m.ganhas, m.valorGanho, m.lucro])).toEqual([
      ["2026-09", 0, 0, 0],
      ["2026-10", 1, 120000, 30000],
      ["2026-11", 2, 58000, 8000],
    ]);
  });

  it("lucro e margem só contam ganhas com custo; as outras entram no aviso", () => {
    const r = calcularResultados({ ...base, periodo: TRES_MESES });
    expect(r.custoTotal).toBe(120000);
    expect(r.lucroTotal).toBe(38000);
    expect(r.ganhasSemCusto).toBe(1);
    // ponderada: 38.000 / (120.000 + 38.000); simples: média de 25% e 21,05%
    expect(r.margemMedia).toBeCloseTo(38000 / 158000);
    expect(r.margemMediaSimples).toBeCloseTo((0.25 + 8000 / 38000) / 2);
    expect(r.margemMedia).not.toBeCloseTo(r.margemMediaSimples ?? 0, 4);
  });

  it("separa por região e por frente, da maior para a menor", () => {
    const r = calcularResultados({ ...base, periodo: TRES_MESES });
    expect(r.porRegiao.map((q) => [q.chave, q.ganhas, q.perdidas, q.valorGanho, q.lucro])).toEqual([
      ["capital", 1, 1, 120000, 30000],
      ["nova-iguacu", 1, 2, 38000, 8000],
      ["baixada", 1, 0, 20000, 0],
    ]);
    expect(r.porFrente.map((q) => [q.rotulo, q.ganhas, q.perdidas, q.valorGanho])).toEqual([
      ["Produtos", 1, 0, 120000],
      ["Serviços", 1, 3, 38000],
      ["Sem frente", 1, 0, 20000],
    ]);
  });

  it("conta os motivos de perda do período, com os sem motivo à parte", () => {
    const r = calcularResultados({ ...base, periodo: TRES_MESES });
    expect(r.motivosPerda).toEqual([
      { motivo: "preco", rotulo: "Preço", quantidade: 2 },
      { motivo: "nao-informado", rotulo: "Sem motivo informado", quantidade: 1 },
    ]);
  });

  it("capital comprometido conta só ganhas em andamento, de qualquer época", () => {
    const r = calcularResultados({ ...base, periodo: NOVEMBRO, itens: itens.filter((i) => i.id !== "g4") });
    // g1 (mensal, 12 meses) = 80% de 10.000; g2 (homologado 38.000, recebe em 40 dias) = 80% de 38.000; g3 (janeiro) já recebeu.
    expect(r.ganhasEmAndamento).toBe(2);
    expect(r.capitalComprometido).toBeCloseTo(8000 + 30400);
    expect(r.ganhas).toBe(1);
    expect(r.porMes).toHaveLength(1);
  });

  it("filtros de região, frente e responsável recortam tudo e escondem o funil", () => {
    const capital = calcularResultados({ ...base, periodo: TRES_MESES, filtros: { ...FILTROS_PADRAO, regiao: "capital" } });
    expect(capital.ganhas).toBe(1);
    expect(capital.perdidas).toBe(1);
    expect(capital.valorGanho).toBe(120000);
    expect(capital.analisadas).toBeNull();
    expect(capital.propostasEnviadas).toBeNull();
    const ana = calcularResultados({ ...base, periodo: TRES_MESES, filtros: { ...FILTROS_PADRAO, responsavel: ANA } });
    expect(ana.ganhas).toBe(1);
    const sem = calcularResultados({ ...base, periodo: TRES_MESES, filtros: { ...FILTROS_PADRAO, responsavel: "sem" } });
    expect(sem.ganhas).toBe(2);
    const frente = calcularResultados({ ...base, periodo: TRES_MESES, filtros: { ...FILTROS_PADRAO, frente: "produtos" } });
    expect(frente.ganhas).toBe(1);
  });

  it("sem custo informado em nenhuma ganha, margem e lucro ficam vazios", () => {
    const r = calcularResultados({ ...base, periodo: NOVEMBRO, itens: [item("a", "ganha", "2026-11-02T12:00:00Z", 1000)] });
    expect(r.valorGanho).toBe(1000);
    expect(r.lucroTotal).toBe(0);
    expect(r.custoTotal).toBe(0);
    expect(r.margemMedia).toBeNull();
    expect(r.margemMediaSimples).toBeNull();
    expect(r.ganhasSemCusto).toBe(1);
  });

  it("sem disputas decididas a taxa é nula", () => {
    const r = calcularResultados({ agora: AGORA, periodo: NOVEMBRO, itens: [], movimentos: [], propostasEnviadasEm: [] });
    expect(r.taxaVitoria).toBeNull();
    expect(r.valorGanho).toBe(0);
    expect(r.ticketMedio).toBeNull();
    expect(r.motivosPerda).toEqual([]);
  });
});

describe("listarLinhas", () => {
  const itens: ItemResultado[] = [
    item("g1", "ganha", "2026-11-03T12:00:00Z", 10000, { valorHomologado: 9000, custoReal: 6000, responsavelId: ANA, responsavelNome: "Ana" }),
    item("g2", "ganha", "2026-11-10T12:00:00Z", 50000, { custoReal: 20000, regiao: "capital" }),
    item("g3", "ganha", "2026-11-05T12:00:00Z", 70000),
    item("g4", "ganha", "2026-09-05T12:00:00Z", 1000),
    item("p1", "perdida", "2026-11-04T12:00:00Z", 5000, { motivoPerda: "prazo" }),
    item("d1", "disputa", "2026-08-01T12:00:00Z", 8000),
    item("r1", "radar", "2026-11-01T12:00:00Z", 8000),
  ];
  const ids = (l: { id: string }[]) => l.map((x) => x.id);

  it("traz ganhas e perdidas do período, as em disputa sempre, e deixa o radar de fora", () => {
    expect(ids(listarLinhas(itens, NOVEMBRO, FILTROS_PADRAO, AGORA))).toEqual(["g2", "g3", "p1", "g1", "d1"]);
  });

  it("calcula valor, lucro e margem de cada ganha", () => {
    const g1 = listarLinhas(itens, NOVEMBRO, FILTROS_PADRAO, AGORA).find((l) => l.id === "g1");
    expect(g1?.valor).toBe(9000);
    expect(g1?.lucro).toBe(3000);
    expect(g1?.margem).toBeCloseTo(1 / 3);
    const g3 = listarLinhas(itens, NOVEMBRO, FILTROS_PADRAO, AGORA).find((l) => l.id === "g3");
    expect(g3?.lucro).toBeNull();
    expect(g3?.margem).toBeNull();
  });

  it("filtra por etapa, região e responsável", () => {
    expect(ids(listarLinhas(itens, NOVEMBRO, { ...FILTROS_PADRAO, etapa: "perdida" }, AGORA))).toEqual(["p1"]);
    expect(ids(listarLinhas(itens, NOVEMBRO, { ...FILTROS_PADRAO, etapa: "disputa" }, AGORA))).toEqual(["d1"]);
    expect(ids(listarLinhas(itens, NOVEMBRO, { ...FILTROS_PADRAO, regiao: "capital" }, AGORA))).toEqual(["g2"]);
    expect(ids(listarLinhas(itens, NOVEMBRO, { ...FILTROS_PADRAO, responsavel: ANA }, AGORA))).toEqual(["g1"]);
    expect(ids(listarLinhas(itens, TRES_MESES, { ...FILTROS_PADRAO, etapa: "ganha" }, AGORA))).toEqual(["g2", "g3", "g1", "g4"]);
  });

  it("ordena por valor e por lucro, com os sem lucro sempre no fim", () => {
    const ganhas = { ...FILTROS_PADRAO, etapa: "ganha" } as const;
    expect(ids(listarLinhas(itens, NOVEMBRO, { ...ganhas, ordem: "valor" }, AGORA))).toEqual(["g3", "g2", "g1"]);
    expect(ids(listarLinhas(itens, NOVEMBRO, { ...ganhas, ordem: "valor", direcao: "asc" }, AGORA))).toEqual(["g1", "g2", "g3"]);
    expect(ids(listarLinhas(itens, NOVEMBRO, { ...ganhas, ordem: "lucro" }, AGORA))).toEqual(["g2", "g1", "g3"]);
    expect(ids(listarLinhas(itens, NOVEMBRO, { ...ganhas, ordem: "lucro", direcao: "asc" }, AGORA))).toEqual(["g1", "g2", "g3"]);
    expect(ids(listarLinhas(itens, NOVEMBRO, { ...ganhas, direcao: "asc" }, AGORA))).toEqual(["g1", "g3", "g2"]);
  });
});

describe("linhasParaCsv", () => {
  it("usa ponto e vírgula, decimal com vírgula e protege texto de fórmula", () => {
    const [ganha, perdida] = listarLinhas(
      [
        item("g1", "ganha", "2026-11-03T15:00:00Z", 10000, {
          valorHomologado: 9000.5,
          custoReal: 6000,
          orgao: "Prefeitura; Secretaria",
          objeto: '=SOMA(1;2) "teste"\nlinha',
          responsavelNome: "Ana",
        }),
        item("p1", "perdida", "2026-11-04T12:00:00Z", 5000, { motivoPerda: "documentacao", regiao: "fora-rj", frente: null }),
      ],
      NOVEMBRO,
      { ...FILTROS_PADRAO, ordem: "data", direcao: "asc" },
      AGORA,
    );
    expect(ganha?.id).toBe("g1");
    expect(perdida?.id).toBe("p1");
    const linhas = linhasParaCsv([ganha, perdida].flatMap((l) => (l ? [l] : []))).split("\r\n");
    expect(linhas[0]).toBe(
      "Data;Situação;Órgão;Objeto;Região;Frente;Responsável;Valor estimado;Valor da proposta;Valor homologado;Custo real;Lucro;Margem (%);Motivo da perda",
    );
    expect(linhas[1]).toBe(
      '03/11/2026;Ganha;"Prefeitura; Secretaria";"\'=SOMA(1;2) ""teste"" linha";Nova Iguaçu;Serviços;Ana;10000,00;;9000,50;6000,00;3000,50;33,3;',
    );
    expect(linhas[2]).toBe("04/11/2026;Perdida;Prefeitura;Objeto p1;Fora do RJ;Sem frente;;5000,00;;;;;;Documentação");
    expect(linhas[3]).toBe("");
  });
});
