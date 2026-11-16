import { describe, expect, it } from "vitest";
import {
  contarPorRegiao,
  ehFiltroRegiao,
  filtrarPorRegiao,
  montarResumo,
  ROTULO_REGIAO,
  type ItemPipeline,
} from "@/components/pipeline/tipos";
import type { Regiao } from "@/core/types";

function item(id: string, regiao: Regiao, valor: number | null, etapa: ItemPipeline["etapa"] = "radar"): ItemPipeline {
  return {
    id,
    etapa,
    ordem: 1,
    notas: "",
    criadoEm: "2026-01-01T00:00:00Z",
    atualizadoEm: "2026-01-01T00:00:00Z",
    criadoPorId: null,
    criadoPorNome: null,
    responsavelId: null,
    responsavelNome: null,
    comentarios: 0,
    revisao: [],
    cotacoes: null,
    preco: null,
    valorProposto: null,
    item: {
      id,
      objeto: "Objeto",
      valorEstimado: valor,
      orgao: "Órgão",
      orgaoCnpj: "00000000000100",
      unidade: "Unidade",
      municipio: "Município",
      codigoIbge: "0",
      uf: regiao === "fora-rj" ? "SP" : "RJ",
      regiao,
      modalidadeId: 6,
      modalidadeNome: "Pregão",
      dataAbertura: null,
      dataEncerramento: "2026-12-01T10:00:00-03:00",
      anoCompra: 2026,
      sequencialCompra: 1,
      linkPncp: "",
      linkOrigem: null,
      score: { total: 50, faixa: "atencao", criterios: [], cnaesCasados: [], frenteCasada: null },
    },
  };
}

const ITENS = [
  item("a", "nova-iguacu", 100),
  item("b", "baixada", 200),
  item("c", "baixada", null, "ganha"),
  item("d", "fora-rj", 400),
];

describe("região no pipeline", () => {
  it("todas não filtra", () => {
    expect(filtrarPorRegiao(ITENS, "todas")).toHaveLength(4);
  });

  it("filtra só a região pedida", () => {
    expect(filtrarPorRegiao(ITENS, "baixada").map((i) => i.id)).toEqual(["b", "c"]);
    expect(filtrarPorRegiao(ITENS, "capital")).toEqual([]);
  });

  it("conta por região", () => {
    expect(contarPorRegiao(ITENS)).toEqual({
      todas: 4,
      "nova-iguacu": 1,
      baixada: 2,
      capital: 0,
      rj: 0,
      "fora-rj": 1,
    });
  });

  it("valida o filtro vindo da URL", () => {
    expect(ehFiltroRegiao("capital")).toBe(true);
    expect(ehFiltroRegiao("todas")).toBe(true);
    expect(ehFiltroRegiao("marte")).toBe(false);
    expect(ehFiltroRegiao(undefined)).toBe(false);
  });

  it("o resumo do filtro soma só os itens da região", () => {
    const filtrados = filtrarPorRegiao(ITENS, "baixada");
    const resumo = montarResumo(filtrados.map((i) => ({ etapa: i.etapa, quantidade: 1, valor: i.item.valorEstimado })));
    expect(resumo.ativas).toBe(1);
    expect(resumo.valorAtivo).toBe(200);
    expect(resumo.porEtapa.radar.quantidade).toBe(1);
    expect(resumo.ganhas).toBe(1);
  });

  it("tem rótulo para cada região", () => {
    expect(ROTULO_REGIAO.rj).toBe("Interior RJ");
    expect(ROTULO_REGIAO["fora-rj"]).toBe("Fora do RJ");
  });
});
