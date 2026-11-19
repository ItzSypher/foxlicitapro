import { describe, expect, it, vi } from "vitest";
import { ErroPncp } from "./client";
import { buscarPublicacoesDoDia, buscarSituacaoDosItens, montarUrlPublicacao } from "./desertas";

function resposta(corpo: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(corpo), { status });
}

const COMPRA = {
  numeroControlePNCP: "11111111000111-1-000010/2026",
  objetoCompra: "Objeto",
  orgaoEntidade: { cnpj: "11111111000111", razaoSocial: "Órgão" },
  unidadeOrgao: { ufSigla: "RJ", municipioNome: "Nova Iguaçu", codigoIbge: "3303500" },
  modalidadeId: 8,
  anoCompra: 2026,
  sequencialCompra: 10,
  dataEncerramentoProposta: "2026-09-18T18:00:00",
};

describe("montarUrlPublicacao", () => {
  it("pede um dia só, a modalidade e a UF", () => {
    const u = new URL(montarUrlPublicacao("RJ", 8, "20260915", 2));
    expect(u.pathname).toBe("/api/consulta/v1/contratacoes/publicacao");
    expect(u.searchParams.get("dataInicial")).toBe("20260915");
    expect(u.searchParams.get("dataFinal")).toBe("20260915");
    expect(u.searchParams.get("codigoModalidadeContratacao")).toBe("8");
    expect(u.searchParams.get("uf")).toBe("RJ");
    expect(u.searchParams.get("pagina")).toBe("2");
  });
});

describe("buscarPublicacoesDoDia", () => {
  it("descarta compra fora do formato e devolve o total de páginas", async () => {
    const fetchImpl = vi.fn(async () => resposta({ data: [COMPRA, { lixo: true }], totalPaginas: 3 }));
    const r = await buscarPublicacoesDoDia("RJ", 8, "20260915", 1, { fetchImpl, esperaRetryMs: 0 });
    expect(r.compras).toHaveLength(1);
    expect(r.totalPaginas).toBe(3);
  });

  it("204 vira lista vazia e 500 lança depois de uma nova tentativa", async () => {
    const vazio = vi.fn(async () => resposta(null, 204));
    expect((await buscarPublicacoesDoDia("RJ", 8, "20260915", 1, { fetchImpl: vazio, esperaRetryMs: 0 })).compras).toEqual([]);
    const falha = vi.fn(async () => resposta({}, 500));
    await expect(buscarPublicacoesDoDia("RJ", 8, "20260915", 1, { fetchImpl: falha, esperaRetryMs: 0 })).rejects.toBeInstanceOf(ErroPncp);
    expect(falha).toHaveBeenCalledTimes(2);
  });
});

describe("buscarSituacaoDosItens", () => {
  it("lê a situação e o valor dos itens", async () => {
    const itens = [
      { numeroItem: 1, descricao: "Baias", situacaoCompraItem: 4, situacaoCompraItemNome: "Deserto", valorTotal: 54696, dataAtualizacao: "2026-09-15T09:05:46" },
      { numeroItem: 2, descricao: "Outro", situacaoCompraItem: 2, situacaoCompraItemNome: "Homologado" },
      { semNumero: true },
    ];
    const fetchImpl = vi.fn(async () => resposta(itens));
    const r = await buscarSituacaoDosItens("11111111000111", 2026, 10, { fetchImpl, esperaRetryMs: 0 });
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ numero: 1, situacaoId: 4, situacaoNome: "Deserto", valorTotal: 54696 });
    expect(r[1].valorTotal).toBeNull();
  });
});
