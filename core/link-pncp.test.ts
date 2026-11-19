import { describe, expect, it } from "vitest";
import { caminhoInterno, lerLinkPncp, lerLinksPncp } from "./link-pncp";

const CNPJ = "12345678000199";
const CHAVE = { cnpj: CNPJ, ano: 2025, sequencial: 123 };

describe("lerLinkPncp", () => {
  it("lê o link do edital no PNCP", () => {
    expect(lerLinkPncp(`https://pncp.gov.br/app/editais/${CNPJ}/2025/123`)).toEqual(CHAVE);
  });

  it("ignora barra final, parâmetros e texto em volta", () => {
    expect(lerLinkPncp(`veja: https://pncp.gov.br/app/editais/${CNPJ}/2025/123/?x=1 obrigado`)).toEqual(CHAVE);
  });

  it("lê o formato com o número de controle no caminho", () => {
    expect(lerLinkPncp(`https://pncp.gov.br/app/editais/${CNPJ}-1-000123/2025`)).toEqual(CHAVE);
  });

  it("lê o número de controle solto", () => {
    expect(lerLinkPncp(`${CNPJ}-1-000123/2025`)).toEqual(CHAVE);
    expect(lerLinkPncp(`Número: ${CNPJ}-1-000123/2025.`)).toEqual(CHAVE);
  });

  it("lê o número de controle com a barra codificada", () => {
    expect(lerLinkPncp(`https://pncp.gov.br/app/editais/${CNPJ}-1-000123%2F2025`)).toEqual(CHAVE);
  });

  it("lê o link interno do sistema, absoluto ou relativo", () => {
    expect(lerLinkPncp(`/licitacao/${CNPJ}/2025/123`)).toEqual(CHAVE);
    expect(lerLinkPncp(`https://licitapro.exemplo.com.br/licitacao/${CNPJ}/2025/123`)).toEqual(CHAVE);
  });

  it("lê o endereço da API do PNCP", () => {
    expect(lerLinkPncp(`https://pncp.gov.br/api/pncp/v1/orgaos/${CNPJ}/compras/2025/123`)).toEqual(CHAVE);
  });

  it("devolve null para o que não é link do PNCP", () => {
    expect(lerLinkPncp("")).toBeNull();
    expect(lerLinkPncp("analisar isso aí")).toBeNull();
    expect(lerLinkPncp("https://exemplo.com.br/editais/123/2025/5")).toBeNull();
    expect(lerLinkPncp(`/licitacao/${CNPJ}/1850/123`)).toBeNull();
    expect(lerLinkPncp(`/licitacao/${CNPJ}/2025/0`)).toBeNull();
    expect(lerLinkPncp(`/licitacao/1234567800019/2025/123`)).toBeNull();
  });
});

describe("lerLinksPncp", () => {
  it("lê vários links na ordem e sem repetir", () => {
    const texto = [
      `https://pncp.gov.br/app/editais/${CNPJ}/2025/123`,
      `outro: ${CNPJ}-1-000007/2024`,
      `https://pncp.gov.br/app/editais/${CNPJ}/2025/123`,
      `/licitacao/98765432000110/2025/9`,
    ].join("\n");
    expect(lerLinksPncp(texto)).toEqual([
      CHAVE,
      { cnpj: CNPJ, ano: 2024, sequencial: 7 },
      { cnpj: "98765432000110", ano: 2025, sequencial: 9 },
    ]);
  });

  it("o mesmo edital em dois formatos conta uma vez", () => {
    expect(lerLinksPncp(`${CNPJ}-1-000123/2025 e /licitacao/${CNPJ}/2025/123`)).toEqual([CHAVE]);
  });
});

describe("caminhoInterno", () => {
  it("monta a página interna", () => {
    expect(caminhoInterno(CHAVE)).toBe(`/licitacao/${CNPJ}/2025/123`);
  });
});
