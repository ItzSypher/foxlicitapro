import { describe, expect, it } from "vitest";
import type { OportunidadeComScore } from "@/core/types";
import { filtrarPorTexto, lerBusca, lerPalavras, normalizarBusca, temFiltroTexto } from "./radar-filtros";

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
