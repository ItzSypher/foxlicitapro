import { describe, expect, it, vi } from "vitest";
import { AMOSTRA_DISPENSA } from "@/core/pncp/amostra-real";
import type { ResultadoModalidadeDetalhado } from "@/core/pncp/client";
import { normalizarLista } from "@/core/pncp/normalize";
import { contratacaoSchema, type ContratacaoPncp } from "@/core/pncp/schema";
import { LIMITES_FORA_RJ, type BuscaForaRj } from "./fora-rj-busca";
import { buscarForaRj, montarResultadoForaRj, opcoesPncpForaRj, pontuarForaRj } from "./radar-fora-rj";

const AGORA = new Date("2026-11-10T12:00:00-03:00");

function contratacao(seq: number, objeto: string, uf: string, ibge: string, municipio: string): ContratacaoPncp {
  return contratacaoSchema.parse({
    ...AMOSTRA_DISPENSA,
    numeroControlePNCP: `11111111000111-1-${String(seq).padStart(6, "0")}/2026`,
    sequencialCompra: seq,
    objetoCompra: objeto,
    unidadeOrgao: { ...AMOSTRA_DISPENSA.unidadeOrgao, ufSigla: uf, codigoIbge: ibge, municipioNome: municipio },
  });
}

function modalidade(
  contratacoes: ContratacaoPncp[],
  extra: Partial<ResultadoModalidadeDetalhado> = {},
): ResultadoModalidadeDetalhado {
  return { modalidadeId: 8, contratacoes, falhou: false, paginasConsultadas: 1, totalPaginas: 1, ...extra };
}

const SOFTWARE = "Contratação de empresa para licenciamento de software de gestão pública e suporte técnico";
const MERENDA = "Aquisição de gêneros alimentícios para merenda escolar";
const busca: BuscaForaRj = { uf: "SP", codigoMunicipioIbge: null, palavra: "", incluirProdutos: false };

describe("opcoesPncpForaRj", () => {
  it("aplica os limites e a UF escolhida", () => {
    const o = opcoesPncpForaRj({ ...busca, codigoMunicipioIbge: "3550308" }, AGORA);
    expect(o).toMatchObject({
      uf: "SP",
      codigoMunicipioIbge: "3550308",
      maxPaginas: LIMITES_FORA_RJ.maxPaginas,
      diasAFrente: LIMITES_FORA_RJ.diasAFrente,
      timeoutMs: LIMITES_FORA_RJ.timeoutMs,
    });
  });

  it("Brasil todo consulta sem UF e sem município", () => {
    const o = opcoesPncpForaRj({ ...busca, uf: "BR", palavra: "software" }, AGORA);
    expect(o.uf).toBeNull();
    expect(o.codigoMunicipioIbge).toBeUndefined();
  });
});

describe("pontuarForaRj", () => {
  it("por padrão mantém só o que casa com a frente de serviços", () => {
    const lista = normalizarLista(
      [contratacao(1, SOFTWARE, "SP", "3550308", "São Paulo"), contratacao(2, MERENDA, "SP", "3550308", "São Paulo")],
      AGORA,
    );
    const itens = pontuarForaRj(lista, false, AGORA);
    expect(itens.map((o) => o.sequencialCompra)).toEqual([1]);
    expect(itens[0]?.regiao).toBe("fora-rj");
    expect(itens[0]?.score.frenteCasada).toBe("servicos");
  });
});

describe("montarResultadoForaRj", () => {
  it("tira o RJ, filtra pela palavra e conta as páginas", () => {
    const resultado = montarResultadoForaRj(
      [
        modalidade(
          [
            contratacao(1, SOFTWARE, "SP", "3550308", "São Paulo"),
            contratacao(2, SOFTWARE, "RJ", "3304557", "Rio de Janeiro"),
            contratacao(3, "Serviço de suporte técnico em informática", "MG", "3106200", "Belo Horizonte"),
          ],
          { paginasConsultadas: 5, totalPaginas: 9 },
        ),
        modalidade([], { modalidadeId: 6, paginasConsultadas: 1, totalPaginas: 1, falhou: true }),
      ],
      { ...busca, uf: "BR", palavra: "software" },
      AGORA,
    );
    expect(resultado.itens.map((o) => o.sequencialCompra)).toEqual([1]);
    expect(resultado.lidas).toBe(3);
    expect(resultado.paginasConsultadas).toBe(6);
    expect(resultado.paginasNoPncp).toBe(10);
    expect(resultado.cortouPaginas).toBe(true);
    expect(resultado.falhas).toEqual([6]);
    expect(resultado.diasJanela).toBe(LIMITES_FORA_RJ.diasAFrente);
  });

  it("limita os itens ao máximo, mantendo a contagem total", () => {
    const muitas = Array.from({ length: LIMITES_FORA_RJ.maxResultados + 5 }, (_, i) =>
      contratacao(100 + i, SOFTWARE, "SP", "3550308", "São Paulo"),
    );
    const resultado = montarResultadoForaRj([modalidade(muitas)], busca, AGORA);
    expect(resultado.itens).toHaveLength(LIMITES_FORA_RJ.maxResultados);
    expect(resultado.totalFiltrado).toBe(LIMITES_FORA_RJ.maxResultados + 5);
    expect(resultado.cortouPaginas).toBe(false);
  });
});

describe("buscarForaRj", () => {
  it("consulta o PNCP com UF, município e limites", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    const resultado = await buscarForaRj({ ...busca, codigoMunicipioIbge: "3550308" }, { agora: AGORA, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const url = new URL(String(fetchImpl.mock.calls[0]?.[0]));
    expect(url.searchParams.get("uf")).toBe("SP");
    expect(url.searchParams.get("codigoMunicipioIbge")).toBe("3550308");
    expect(url.searchParams.get("dataFinal")).toBe("20261125");
    expect(resultado.itens).toEqual([]);
    expect(resultado.falhas).toEqual([]);
  });
});
