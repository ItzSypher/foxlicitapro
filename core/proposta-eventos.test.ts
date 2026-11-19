import { describe, expect, it } from "vitest";
import {
  TAMANHO_MAXIMO_DATA_URL,
  lerComprovante,
  lerValorEmCentavos,
  linhaDoTempo,
  numeroControleDoTexto,
  validarEnvio,
  validarExterna,
  type EventoProposta,
} from "./proposta-eventos";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const PDF = "data:application/pdf;base64,JVBERi0xLjQK";

describe("lerComprovante", () => {
  it("aceita imagem e PDF", () => {
    expect(lerComprovante(PNG)).toMatchObject({ ok: true, mime: "image/png", tipo: "imagem" });
    expect(lerComprovante(PDF)).toMatchObject({ ok: true, mime: "application/pdf", tipo: "pdf", base64: "JVBERi0xLjQK" });
  });

  it("recusa outros formatos e arquivo grande", () => {
    expect(lerComprovante("data:text/html;base64,PGgxPg==").ok).toBe(false);
    expect(lerComprovante("data:image/svg+xml;base64,PHN2Zz4=").ok).toBe(false);
    expect(lerComprovante("data:image/png;base64,abc<script>").ok).toBe(false);
    expect(lerComprovante(`data:application/pdf;base64,${"A".repeat(TAMANHO_MAXIMO_DATA_URL)}`).ok).toBe(false);
  });
});

describe("validarEnvio", () => {
  it("exige protocolo ou comprovante", () => {
    expect(validarEnvio({ protocolo: "  ", comprovante: null }).ok).toBe(false);
    expect(validarEnvio({ protocolo: "PNCP-123" })).toEqual({ ok: true, valor: { protocolo: "PNCP-123", comprovante: null, nota: null } });
    expect(validarEnvio({ comprovante: PDF, nota: " enviado   às 10h " })).toEqual({
      ok: true,
      valor: { protocolo: null, comprovante: PDF, nota: "enviado às 10h" },
    });
  });

  it("recusa comprovante inválido e textos longos", () => {
    expect(validarEnvio({ comprovante: "data:text/plain;base64,YQ==" }).ok).toBe(false);
    expect(validarEnvio({ protocolo: "x".repeat(121) }).ok).toBe(false);
    expect(validarEnvio({ protocolo: "1", nota: "x".repeat(1001) }).ok).toBe(false);
  });
});

describe("lerValorEmCentavos", () => {
  it("entende os formatos comuns", () => {
    expect(lerValorEmCentavos("62.000,00")).toBe(6_200_000);
    expect(lerValorEmCentavos("R$ 1.234,5")).toBe(123_450);
    expect(lerValorEmCentavos("62000.50")).toBe(6_200_050);
    expect(lerValorEmCentavos("62.000")).toBe(6_200_000);
    expect(lerValorEmCentavos("62000")).toBe(6_200_000);
  });

  it("recusa o que não é valor", () => {
    expect(lerValorEmCentavos("")).toBeNull();
    expect(lerValorEmCentavos("abc")).toBeNull();
    expect(lerValorEmCentavos("1,2,3")).toBeNull();
    expect(lerValorEmCentavos("-5")).toBeNull();
  });
});

describe("numeroControleDoTexto", () => {
  it("lê o número de controle e o link do PNCP", () => {
    expect(numeroControleDoTexto("00394502000144-1-015323/2026")).toBe("00394502000144-1-015323/2026");
    expect(numeroControleDoTexto("ver 00394502000144-1-15323/2026 no portal")).toBe("00394502000144-1-015323/2026");
    expect(numeroControleDoTexto("https://pncp.gov.br/app/editais/00394502000144/2026/15323")).toBe("00394502000144-1-015323/2026");
  });

  it("número comum não é do PNCP", () => {
    expect(numeroControleDoTexto("Pregão 90012/2026")).toBeNull();
  });
});

describe("validarExterna", () => {
  const base = { orgao: "Prefeitura de Nova Iguaçu", numero: "Pregão 12/2026", portal: "BLL", valor: "62.000,00", protocolo: "ABC-1" };

  it("valida e liga ao PNCP quando o número é de lá", () => {
    const r = validarExterna({ ...base, numero: "00394502000144-1-015323/2026", enviadaEm: "2026-11-10" }, "2026-11-18");
    expect(r.ok && r.valor).toMatchObject({ valorCentavos: 6_200_000, enviadaEm: "2026-11-10", compraId: "00394502000144-1-015323/2026" });
    const comum = validarExterna(base, "2026-11-18");
    expect(comum.ok && comum.valor.compraId).toBeNull();
  });

  it("exige órgão, número, portal, valor e prova", () => {
    expect(validarExterna({ ...base, orgao: " " }, "2026-11-18").ok).toBe(false);
    expect(validarExterna({ ...base, numero: "" }, "2026-11-18").ok).toBe(false);
    expect(validarExterna({ ...base, portal: "" }, "2026-11-18").ok).toBe(false);
    expect(validarExterna({ ...base, valor: "0" }, "2026-11-18").ok).toBe(false);
    expect(validarExterna({ ...base, protocolo: "" }, "2026-11-18").ok).toBe(false);
  });

  it("recusa data no futuro ou inválida", () => {
    expect(validarExterna({ ...base, enviadaEm: "2026-11-19" }, "2026-11-18").ok).toBe(false);
    expect(validarExterna({ ...base, enviadaEm: "18/11/2026" }, "2026-11-18").ok).toBe(false);
  });
});

describe("linhaDoTempo", () => {
  const evento = (id: string, tipo: EventoProposta["tipo"], em: string): EventoProposta => ({
    id,
    tipo,
    porNome: "Paulo",
    em,
    nota: null,
    protocolo: null,
    temComprovante: false,
    resultado: null,
  });

  it("acrescenta a criação das propostas antigas e ordena por data", () => {
    const lista = linhaDoTempo([evento("b", "enviada", "2026-11-12T10:00:00Z"), evento("a", "aprovada", "2026-11-11T10:00:00Z")], {
      criadoEm: "2026-11-10T10:00:00Z",
      criadoPorNome: "Ana",
      autor: "usuario",
    });
    expect(lista.map((e) => e.tipo)).toEqual(["criada", "aprovada", "enviada"]);
    expect(lista[0]?.porNome).toBe("Ana");
  });

  it("não duplica quando já existe o evento de criação", () => {
    const lista = linhaDoTempo([evento("c", "criada", "2026-11-10T10:00:00Z")], {
      criadoEm: "2026-11-10T10:00:00Z",
      criadoPorNome: "Ana",
      autor: "assistente",
    });
    expect(lista).toHaveLength(1);
  });
});
