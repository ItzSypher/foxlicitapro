import { describe, expect, it, vi } from "vitest";
import { MAX_REQUISICOES, buscarHomologadas, extrairHomologadas, planejarRequisicoes } from "./concorrentes";

const AGORA = new Date("2026-11-13T15:00:00-03:00");

function compra(seq: number, homologado: number | null, estimado = 100_000) {
  return {
    numeroControlePNCP: `11111111000191-1-${String(seq).padStart(6, "0")}/2026`,
    objetoCompra: "Aquisição de computadores",
    valorTotalEstimado: estimado,
    valorTotalHomologado: homologado,
    orgaoEntidade: { cnpj: "11111111000191", razaoSocial: "Prefeitura" },
    unidadeOrgao: { ufSigla: "RJ" },
    modalidadeId: 6,
    anoCompra: 2026,
    sequencialCompra: seq,
    dataPublicacaoPncp: "2026-05-10T10:00:00",
  };
}

function resposta(corpo: unknown, status = 200, cabecalhos: Record<string, string> = {}): Response {
  return new Response(status === 204 ? null : JSON.stringify(corpo), { status, headers: cabecalhos });
}

describe("planejarRequisicoes", () => {
  it("no máximo 6, na UF, a modalidade da licitação primeiro", () => {
    const plano = planejarRequisicoes(AGORA, "rj", 8);
    expect(plano).toHaveLength(MAX_REQUISICOES);
    expect(plano.slice(0, 3).every((r) => r.modalidadeId === 8)).toBe(true);
    expect(plano.slice(3).every((r) => r.modalidadeId === 6)).toBe(true);
    expect(plano.every((r) => r.uf === "RJ")).toBe(true);
    expect(plano[0].dataFinal).toBe("20261113");
  });
});

describe("extrairHomologadas", () => {
  it("fica só com as de valor homologado maior que zero e monta o link", () => {
    const r = extrairHomologadas({ data: [compra(1, 90_000), compra(2, null), compra(3, 0), { lixo: true }] });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ valorHomologado: 90_000, valorEstimado: 100_000, uf: "RJ" });
    expect(r[0].link).toBe("https://pncp.gov.br/app/editais/11111111000191/2026/1");
  });
});

describe("buscarHomologadas", () => {
  it("faz no máximo 6 requisições, em série, e junta sem repetir", async () => {
    const fetchImpl = vi.fn(async () => resposta({ data: [compra(1, 90_000), compra(2, 80_000)] }));
    const r = await buscarHomologadas("RJ", 6, { fetchImpl, agora: AGORA });
    expect(fetchImpl).toHaveBeenCalledTimes(6);
    expect(r.requisicoes).toBe(6);
    expect(r.amostras).toHaveLength(2);
    expect(r.falhas).toBe(0);
  });

  it("429: espera o Retry-After e tenta de novo", async () => {
    const esperar = vi.fn(async () => undefined);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(resposta({}, 429, { "retry-after": "3" }))
      .mockImplementation(async () => resposta({ data: [compra(1, 90_000)] }));
    const r = await buscarHomologadas("RJ", 6, { fetchImpl, esperar, agora: AGORA });
    expect(esperar).toHaveBeenCalledWith(3000);
    expect(r.limitado).toBe(false);
    expect(r.amostras).toHaveLength(1);
    expect(r.falhas).toBe(0);
  });

  it("429 persistente: para a busca e avisa que foi limitada", async () => {
    const esperar = vi.fn(async () => undefined);
    const fetchImpl = vi.fn(async () => resposta({}, 429));
    const r = await buscarHomologadas("RJ", 6, { fetchImpl, esperar, agora: AGORA });
    expect(r.limitado).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(3); // 1 + 2 novas tentativas, sem seguir para as outras janelas
    expect(esperar).toHaveBeenCalledTimes(2);
    expect(r.amostras).toEqual([]);
  });

  it("falha de rede numa janela conta como falha e segue", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("rede"))
      .mockImplementation(async () => resposta({ data: [compra(1, 90_000)] }));
    const r = await buscarHomologadas("RJ", 6, { fetchImpl, agora: AGORA });
    expect(r.falhas).toBe(1);
    expect(r.requisicoes).toBe(6);
    expect(r.amostras).toHaveLength(1);
  });
});
