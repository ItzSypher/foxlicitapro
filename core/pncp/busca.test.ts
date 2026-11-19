import { describe, expect, it } from "vitest";
import { converterBusca, montarUrlBusca } from "./busca";

const agora = new Date("2026-11-19T12:00:00-03:00");

function item(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: "Edital nº 41/2026",
    description: "Contratação de  hospedagem de site",
    orgao_cnpj: "13168687000110",
    orgao_nome: "Prefeitura X",
    ano: "2026",
    numero_sequencial: "154",
    numero_controle_pncp: "13168687000110-1-000154/2026",
    municipio_nome: "Niterói",
    uf: "rj",
    modalidade_licitacao_nome: "Dispensa",
    data_fim_vigencia: "2026-12-10T09:00",
    valor_global: null,
    cancelado: false,
    ...extra,
  };
}

describe("montarUrlBusca", () => {
  it("junta as UFs com barra vertical e só pede editais abertos", () => {
    const url = new URL(montarUrlBusca({ texto: " hospedagem site ", ufs: ["RJ", "MG"] }));
    expect(url.searchParams.get("q")).toBe("hospedagem site");
    expect(url.searchParams.get("ufs")).toBe("RJ|MG");
    expect(url.searchParams.get("status")).toBe("recebendo_proposta");
    expect(url.searchParams.get("tipos_documento")).toBe("edital");
  });

  it("sem UF busca no Brasil todo", () => {
    expect(new URL(montarUrlBusca({ texto: "toner", ufs: [] })).searchParams.has("ufs")).toBe(false);
  });
});

describe("converterBusca", () => {
  it("monta o link interno e o prazo em horário de Brasília", () => {
    const r = converterBusca({ total: 1, items: [item()] }, agora);
    expect(r.total).toBe(1);
    expect(r.itens[0]).toMatchObject({
      href: "/licitacao/13168687000110/2026/154",
      uf: "RJ",
      objeto: "Contratação de hospedagem de site",
      encerramento: "2026-12-10T12:00:00.000Z",
    });
  });

  it("descarta cancelado, vencido e sem chave", () => {
    const r = converterBusca(
      {
        total: 3,
        items: [item({ cancelado: true }), item({ data_fim_vigencia: "2026-11-01T09:00" }), item({ orgao_cnpj: "123" })],
      },
      agora,
    );
    expect(r.itens).toEqual([]);
  });

  it("resposta estranha vira lista vazia", () => {
    expect(converterBusca("erro", agora)).toEqual({ total: 0, itens: [] });
  });
});
