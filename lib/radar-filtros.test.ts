import { describe, expect, it } from "vitest";
import type { OportunidadeComScore } from "@/core/types";
import {
  FILTROS_PADRAO,
  contarFiltrosAtivos,
  filtrar,
  filtrarPorTexto,
  lerBusca,
  lerFiltros,
  lerPalavras,
  normalizarBusca,
  temFiltroTexto,
} from "./radar-filtros";

function item(id: string, objeto: string, orgao: string, municipio: string): OportunidadeComScore {
  return { id, objeto, orgao, unidade: "", municipio } as OportunidadeComScore;
}

const lista = [
  item("1", "Aquisição de licenças de software de gestão", "Prefeitura de Nova Iguaçu", "Nova Iguaçu"),
  item("2", "Serviços de manutenção de computadores", "Câmara Municipal de Duque de Caxias", "Duque de Caxias"),
  item("3", "Compra de merenda escolar", "Secretaria de Educação", "Rio de Janeiro"),
];

const ids = (l: OportunidadeComScore[]) => l.map((i) => i.id);

describe("filtro de texto e palavras-chave do Radar", () => {
  it("normaliza sem acento e sem caixa", () => {
    expect(normalizarBusca("  AQUISIÇÃO,  Gestão ")).toBe("aquisicao gestao");
  });

  it("sem nada marcado devolve tudo", () => {
    expect(ids(filtrarPorTexto(lista, { busca: "", palavras: [] }))).toEqual(["1", "2", "3"]);
    expect(temFiltroTexto({ busca: " ", palavras: [] })).toBe(false);
  });

  it("busca ignora acento e caixa e olha objeto, órgão e município", () => {
    expect(ids(filtrarPorTexto(lista, { busca: "IGUACU", palavras: [] }))).toEqual(["1"]);
    expect(ids(filtrarPorTexto(lista, { busca: "camara", palavras: [] }))).toEqual(["2"]);
    expect(ids(filtrarPorTexto(lista, { busca: "licencas", palavras: [] }))).toEqual(["1"]);
  });

  it("todas as palavras digitadas precisam aparecer", () => {
    expect(ids(filtrarPorTexto(lista, { busca: "software nova", palavras: [] }))).toEqual(["1"]);
    expect(ids(filtrarPorTexto(lista, { busca: "software merenda", palavras: [] }))).toEqual([]);
  });

  it("várias palavras-chave valem como OU", () => {
    expect(ids(filtrarPorTexto(lista, { busca: "", palavras: ["software", "merenda"] }))).toEqual(["1", "3"]);
  });

  it("busca e palavras-chave se combinam (E)", () => {
    expect(ids(filtrarPorTexto(lista, { busca: "duque", palavras: ["software", "computadores"] }))).toEqual(["2"]);
    expect(ids(filtrarPorTexto(lista, { busca: "duque", palavras: ["software"] }))).toEqual([]);
  });

  it("lê busca e palavras da URL", () => {
    const params = new URLSearchParams("q=  Nova Iguaçu &pc=Software,gestão,software,,");
    expect(lerBusca(params)).toBe("Nova Iguaçu");
    expect(lerPalavras(params)).toEqual(["software", "gestao"]);
    expect(lerPalavras(new URLSearchParams(""))).toEqual([]);
  });
});

describe("lerFiltros: UF, valor, fonte e ramo", () => {
  const params = (texto: string) => new URLSearchParams(texto);

  it("lê UFs válidas, faixa de valor, fontes e o ramo", () => {
    const f = lerFiltros(params("uf=rj,MG,XX&vmin=1000&vmax=50000&fonte=BNC,Inexistente&ramo=1"));
    expect(f.ufs).toEqual(["RJ", "MG"]);
    expect([f.valorMin, f.valorMax]).toEqual([1000, 50000]);
    expect(f.fontes).toEqual(["BNC"]);
    expect(f.tudoDoRamo).toBe(true);
    expect(lerFiltros(params("ramo=0")).tudoDoRamo).toBe(false);
    expect(lerFiltros(params("")).tudoDoRamo).toBeNull();
  });

  it("troca mínimo e máximo invertidos e ignora valor inválido", () => {
    const f = lerFiltros(params("vmin=9000&vmax=100"));
    expect([f.valorMin, f.valorMax]).toEqual([100, 9000]);
    const g = lerFiltros(params("vmin=abc&vmax=-5"));
    expect([g.valorMin, g.valorMax]).toEqual([null, null]);
  });

  it("conta os filtros fora do padrão", () => {
    expect(contarFiltrosAtivos(FILTROS_PADRAO)).toBe(0);
    expect(contarFiltrosAtivos({ ...FILTROS_PADRAO, ufs: ["MG"], valorMin: 1, fontes: ["BLL"], tudoDoRamo: false })).toBe(4);
  });
});

describe("filtro Pouco caixa", () => {
  const com = (id: string, objeto: string, valorEstimado: number) =>
    ({ ...item(id, objeto, "", ""), uf: "RJ", modalidadeId: 8, valorEstimado, linkOrigem: null }) as OportunidadeComScore;
  const base = [
    com("site", "Criação de site institucional", 20_000),
    com("cadeiras", "Aquisição de cadeiras", 40_000),
    com("servico", "Prestação de serviço de pintura", 10_000),
  ];

  it("lê ?caixa=1 e conta como filtro ativo", () => {
    expect(lerFiltros(new URLSearchParams("caixa=1")).poucoCaixa).toBe(true);
    expect(lerFiltros(new URLSearchParams("")).poucoCaixa).toBe(false);
    expect(contarFiltrosAtivos({ ...FILTROS_PADRAO, poucoCaixa: true })).toBe(1);
  });

  it("mostra só o nível baixo", () => {
    expect(ids(filtrar(base, { ...FILTROS_PADRAO, poucoCaixa: true }))).toEqual(["site", "servico"]);
    expect(ids(filtrar(base, FILTROS_PADRAO))).toEqual(["site", "cadeiras", "servico"]);
  });
});

describe("filtro Caixa até", () => {
  const com = (id: string, objeto: string, valorEstimado: number | null) =>
    ({ ...item(id, objeto, "", ""), uf: "RJ", modalidadeId: 8, valorEstimado, linkOrigem: null }) as OportunidadeComScore;
  const base = [
    com("site", "Criação de site institucional", 20_000),
    com("cadeiras", "Aquisição de cadeiras", 40_000),
    com("servico", "Prestação de serviço de pintura", 10_000),
    com("sigiloso", "Aquisição de cadeiras", null),
  ];

  it("lê ?caixaMax= e ignora valor inválido", () => {
    expect(lerFiltros(new URLSearchParams("caixaMax=5000")).caixaMax).toBe(5000);
    expect(lerFiltros(new URLSearchParams("caixaMax=abc")).caixaMax).toBeNull();
    expect(lerFiltros(new URLSearchParams("")).caixaMax).toBeNull();
  });

  it("conta como filtro ativo", () => {
    expect(contarFiltrosAtivos({ ...FILTROS_PADRAO, caixaMax: 5000 })).toBe(1);
  });

  it("passa quando o caixa estimado é no máximo o limite", () => {
    // site: caixa 0; serviço presencial de 10 mil: 10% = 1.000; cadeiras: 80% de 40 mil.
    expect(ids(filtrar(base, { ...FILTROS_PADRAO, caixaMax: 1_000 }))).toEqual(["site", "servico"]);
    expect(ids(filtrar(base, { ...FILTROS_PADRAO, caixaMax: 999 }))).toEqual(["site"]);
    expect(ids(filtrar(base, { ...FILTROS_PADRAO, caixaMax: 40_000 }))).toEqual(["site", "cadeiras", "servico"]);
  });

  it("estimativa desconhecida não passa com o filtro ligado", () => {
    expect(ids(filtrar(base, { ...FILTROS_PADRAO, caixaMax: 1_000_000 }))).not.toContain("sigiloso");
    expect(ids(filtrar(base, FILTROS_PADRAO))).toContain("sigiloso");
  });
});
