import { describe, expect, it, vi } from "vitest";
import { AMOSTRA_DISPENSA } from "./amostra-real";
import { buscarModalidade, dataFinalPara } from "./client";

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
}

function pagina(numero: number, totalPaginas: number) {
  return { data: [AMOSTRA_DISPENSA], totalRegistros: totalPaginas, totalPaginas, numeroPagina: numero, empty: false };
}

describe("dataFinalPara", () => {
  it("soma 60 dias e formata yyyyMMdd", () => {
    expect(dataFinalPara(new Date("2026-11-10T12:00:00-03:00"))).toBe("20270109");
  });
});

describe("buscarModalidade", () => {
  it("trata HTTP 204 como lista vazia", async () => {
    const fetchImpl = vi.fn(async (_entrada: string | URL | Request) => new Response(null, { status: 204 }));
    const r = await buscarModalidade(8, { fetchImpl, esperasRetryMs: [] });
    expect(r).toEqual({ modalidadeId: 8, contratacoes: [], falhou: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("monta a URL com os parâmetros esperados", async () => {
    const fetchImpl = vi.fn(async (_entrada: string | URL | Request) => new Response(null, { status: 204 }));
    await buscarModalidade(6, { fetchImpl, esperasRetryMs: [], agora: new Date("2026-11-10T12:00:00-03:00") });
    const url = new URL(String(fetchImpl.mock.calls[0]?.[0]));
    expect(url.origin + url.pathname).toBe("https://pncp.gov.br/api/consulta/v1/contratacoes/proposta");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      dataFinal: "20270109",
      codigoModalidadeContratacao: "6",
      uf: "RJ",
      pagina: "1",
      tamanhoPagina: "50",
    });
  });

  it("limita a 10 páginas", async () => {
    const fetchImpl = vi.fn(async (entrada: string | URL | Request) => {
      const n = Number(new URL(String(entrada)).searchParams.get("pagina"));
      return respostaJson(pagina(n, 15));
    });
    const r = await buscarModalidade(8, { fetchImpl, esperasRetryMs: [] });
    expect(fetchImpl).toHaveBeenCalledTimes(10);
    expect(r.contratacoes).toHaveLength(10);
    expect(r.falhou).toBe(false);
  });

  it("marca falha quando a primeira página dá erro", async () => {
    const fetchImpl = vi.fn(async () => new Response("erro", { status: 500 }));
    const r = await buscarModalidade(8, { fetchImpl, esperasRetryMs: [] });
    expect(r).toEqual({ modalidadeId: 8, contratacoes: [], falhou: true });
  });

  it("mantém o que veio quando uma página seguinte falha", async () => {
    const fetchImpl = vi.fn(async (entrada: string | URL | Request) => {
      const n = Number(new URL(String(entrada)).searchParams.get("pagina"));
      return n === 2 ? new Response("erro", { status: 503 }) : respostaJson(pagina(n, 3));
    });
    const r = await buscarModalidade(6, { fetchImpl, esperasRetryMs: [] });
    expect(r.falhou).toBe(true);
    expect(r.contratacoes).toHaveLength(2);
  });

  it("tenta de novo quando o PNCP responde 429", async () => {
    let chamadas = 0;
    const fetchImpl = vi.fn(async (_entrada: string | URL | Request) => {
      chamadas += 1;
      return chamadas === 1 ? new Response("limite", { status: 429 }) : respostaJson(pagina(1, 1));
    });
    const r = await buscarModalidade(8, { fetchImpl, esperasRetryMs: [1] });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(r.falhou).toBe(false);
    expect(r.contratacoes).toHaveLength(1);
  });

  it("descarta item fora do padrão sem derrubar a página", async () => {
    const fetchImpl = vi.fn(async () =>
      respostaJson({ data: [AMOSTRA_DISPENSA, { lixo: true }], totalPaginas: 1, numeroPagina: 1 }),
    );
    const r = await buscarModalidade(8, { fetchImpl, esperasRetryMs: [] });
    expect(r.contratacoes).toHaveLength(1);
    expect(r.falhou).toBe(false);
  });
});
