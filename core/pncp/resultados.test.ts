import { describe, expect, it, vi } from "vitest";
import { buscarResultadosItem, normalizarResultados } from "./resultados";

/** Amostra real do PNCP (compra 00394502000144-1-015323/2026, item 1), conferida em 18/11/2026. */
const RESULTADO_REAL = {
  sequencialResultado: 1,
  indicadorSubcontratacao: false,
  niFornecedor: "90180605000102",
  dataCancelamento: null,
  dataAtualizacao: "2026-11-17T13:43:01",
  tipoPessoa: "PJ",
  nomeRazaoSocialFornecedor: "GENTE SEGURADORA SA",
  dataInclusao: "2026-11-17T13:43:01",
  numeroItem: 1,
  valorTotalHomologado: 587.97,
  quantidadeHomologada: 1.0,
  valorUnitarioHomologado: 587.97,
  percentualDesconto: 0.0,
  dataResultado: "2026-11-17",
  motivoCancelamento: null,
  numeroControlePNCPCompra: "00394502000144-1-015323/2026",
  situacaoCompraItemResultadoId: 1,
  situacaoCompraItemResultadoNome: "Informado",
  porteFornecedorNome: "Demais",
};

const CHAVE = { cnpj: "00394502000144", ano: 2026, sequencial: 15323 };

describe("normalizarResultados", () => {
  it("lê o registro real", () => {
    expect(normalizarResultados([RESULTADO_REAL])).toEqual([
      {
        numeroItem: 1,
        documentoFornecedor: "90180605000102",
        nomeFornecedor: "GENTE SEGURADORA SA",
        valorTotal: 587.97,
        valorUnitario: 587.97,
        data: "2026-11-17",
        cancelado: false,
      },
    ]);
  });

  it("marca cancelado e descarta registro fora do formato", () => {
    const lidos = normalizarResultados([
      { ...RESULTADO_REAL, dataCancelamento: "2026-11-18T10:00:00" },
      { ...RESULTADO_REAL, situacaoCompraItemResultadoNome: "Cancelado" },
      { numeroItem: "1" },
      null,
    ]);
    expect(lidos).toHaveLength(2);
    expect(lidos.every((r) => r.cancelado)).toBe(true);
  });

  it("limpa o documento e ignora valor negativo", () => {
    const [r] = normalizarResultados([{ ...RESULTADO_REAL, niFornecedor: "90.180.605/0001-02", valorTotalHomologado: -1 }]);
    expect(r?.documentoFornecedor).toBe("90180605000102");
    expect(r?.valorTotal).toBeNull();
  });
});

describe("buscarResultadosItem", () => {
  it("monta a URL do item e devolve os resultados", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify([RESULTADO_REAL]), { status: 200 }));
    const r = await buscarResultadosItem(CHAVE, 1, { fetchImpl, esperaRetryMs: 0 });
    expect(r).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://pncp.gov.br/api/pncp/v1/orgaos/00394502000144/compras/2026/15323/itens/1/resultados",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("204 e 404 são item sem resultado", async () => {
    for (const status of [204, 404]) {
      const fetchImpl = vi.fn(async () => new Response(null, { status }));
      expect(await buscarResultadosItem(CHAVE, 2, { fetchImpl, esperaRetryMs: 0 })).toEqual([]);
    }
  });

  it("tenta de novo uma vez em 503 e depois lança", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 503 }));
    await expect(buscarResultadosItem(CHAVE, 1, { fetchImpl, esperaRetryMs: 0 })).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("corpo que não é lista lança", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ erro: "x" }), { status: 200 }));
    await expect(buscarResultadosItem(CHAVE, 1, { fetchImpl, esperaRetryMs: 0 })).rejects.toThrow();
  });
});
