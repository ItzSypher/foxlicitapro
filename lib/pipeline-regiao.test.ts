import { describe, expect, it } from "vitest";
import {
  contarPorUf,
  filtrarPorUf,
  lerFiltroUf,
  montarResumo,
  ROTULO_REGIAO,
  ufsDoFiltro,
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

describe("filtro por UF no pipeline", () => {
  const SP = item("e", "fora-rj", 50);

  it("todas não filtra", () => {
    expect(filtrarPorUf(ITENS, "todas")).toHaveLength(4);
  });

  it("filtra só a UF pedida", () => {
    expect(filtrarPorUf(ITENS, "RJ").map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(filtrarPorUf(ITENS, "SP").map((i) => i.id)).toEqual(["d"]);
    expect(filtrarPorUf(ITENS, "MG")).toEqual([]);
  });

  it("conta por UF, com o total em todas", () => {
    expect(contarPorUf([...ITENS, SP])).toEqual({ todas: 5, RJ: 3, SP: 2 });
  });

  it("valida o filtro vindo da URL", () => {
    expect(lerFiltroUf("rj")).toBe("RJ");
    expect(lerFiltroUf("SP")).toBe("SP");
    expect(lerFiltroUf("todas")).toBe("todas");
    expect(lerFiltroUf("marte")).toBe("todas");
    expect(lerFiltroUf("capital")).toBe("todas");
    expect(lerFiltroUf(undefined)).toBe("todas");
  });

  it("junta as UFs das áreas com as dos itens, sem repetir e em ordem", () => {
    expect(ufsDoFiltro(["RJ", "MG"], ITENS)).toEqual(["MG", "RJ", "SP"]);
    expect(ufsDoFiltro([], [])).toEqual([]);
  });

  it("o resumo do filtro soma só os itens da UF", () => {
    const filtrados = filtrarPorUf(ITENS, "RJ");
    const resumo = montarResumo(filtrados.map((i) => ({ etapa: i.etapa, quantidade: 1, valor: i.item.valorEstimado })));
    expect(resumo.ativas).toBe(2);
    expect(resumo.valorAtivo).toBe(300);
    expect(resumo.porEtapa.radar.quantidade).toBe(2);
    expect(resumo.ganhas).toBe(1);
  });

  it("tem rótulo para cada região", () => {
    expect(ROTULO_REGIAO.rj).toBe("Interior RJ");
    expect(ROTULO_REGIAO["fora-rj"]).toBe("Fora do RJ");
  });
});
