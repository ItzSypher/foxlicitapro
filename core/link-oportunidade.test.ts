import { describe, expect, it } from "vitest";
import { linkInternoDaOportunidade, temChavePncp } from "./link-oportunidade";

const DO_PNCP = {
  orgaoCnpj: "12345678000190",
  anoCompra: 2026,
  sequencialCompra: 7,
  linkOrigem: "https://portal.exemplo/edital",
  linkAlerta: null,
  linkPncp: "https://pncp.gov.br/app/editais/12345678000190/2026/7",
};

const SO_ALERTA = {
  orgaoCnpj: "",
  anoCompra: 2026,
  sequencialCompra: 0,
  linkOrigem: null,
  linkAlerta: "https://alertalicitacao.com.br/!licitacao/123",
  linkPncp: "https://alertalicitacao.com.br/!licitacao/123",
};

describe("linkInternoDaOportunidade", () => {
  it("com chave do PNCP leva à página interna", () => {
    expect(linkInternoDaOportunidade(DO_PNCP)).toEqual({ href: "/licitacao/12345678000190/2026/7", externo: false });
  });

  it("sem chave usa o portal de origem quando existe", () => {
    expect(linkInternoDaOportunidade({ ...SO_ALERTA, linkOrigem: "https://portal.exemplo/x" })).toEqual({
      href: "https://portal.exemplo/x",
      externo: true,
    });
  });

  it("sem chave nem portal usa a página do Alerta Licitação", () => {
    expect(linkInternoDaOportunidade(SO_ALERTA)).toEqual({ href: "https://alertalicitacao.com.br/!licitacao/123", externo: true });
  });

  it("nunca monta /licitacao com CNPJ vazio", () => {
    expect(linkInternoDaOportunidade(SO_ALERTA)?.href).not.toContain("/licitacao/");
  });

  it("sem chave e sem nenhum endereço web devolve null", () => {
    expect(linkInternoDaOportunidade({ ...SO_ALERTA, linkAlerta: null, linkPncp: "" })).toBeNull();
    expect(linkInternoDaOportunidade({ ...SO_ALERTA, linkOrigem: "javascript:alert(1)", linkAlerta: null, linkPncp: "" })).toBeNull();
  });

  it("exige CNPJ de 14 dígitos, ano e sequencial", () => {
    expect(temChavePncp(DO_PNCP)).toBe(true);
    expect(temChavePncp({ ...DO_PNCP, orgaoCnpj: "123" })).toBe(false);
    expect(temChavePncp({ ...DO_PNCP, sequencialCompra: 0 })).toBe(false);
  });
});
