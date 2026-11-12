import { describe, expect, it } from "vitest";
import { AMOSTRA_DISPENSA, AMOSTRA_PREGAO } from "./amostra-real";
import { normalizarContratacao, normalizarLista, paraIsoBrasilia } from "./normalize";
import { contratacaoSchema, paginaSchema } from "./schema";

const AGORA = new Date("2026-11-10T12:00:00-03:00");

function ler(amostra: unknown) {
  return contratacaoSchema.parse(amostra);
}

describe("schema do PNCP", () => {
  it("aceita as amostras reais", () => {
    expect(contratacaoSchema.safeParse(AMOSTRA_DISPENSA).success).toBe(true);
    expect(contratacaoSchema.safeParse(AMOSTRA_PREGAO).success).toBe(true);
  });

  it("aceita campos opcionais nulos", () => {
    const enxuta = {
      numeroControlePNCP: "1-1-1/2026",
      objetoCompra: null,
      valorTotalEstimado: null,
      orgaoEntidade: { cnpj: "123", razaoSocial: null },
      unidadeOrgao: { ufSigla: "RJ", codigoIbge: null },
      modalidadeId: 8,
      anoCompra: 2026,
      sequencialCompra: 1,
      dataEncerramentoProposta: null,
      linkSistemaOrigem: null,
    };
    expect(contratacaoSchema.safeParse(enxuta).success).toBe(true);
  });

  it("valida o envelope da página", () => {
    const pagina = paginaSchema.parse({ data: [AMOSTRA_DISPENSA], totalPaginas: 8, numeroPagina: 1, empty: false });
    expect(pagina.data).toHaveLength(1);
    expect(pagina.totalPaginas).toBe(8);
  });
});

describe("paraIsoBrasilia", () => {
  it("acrescenta -03:00 quando a data vem sem fuso", () => {
    expect(paraIsoBrasilia("2026-11-11T08:00:00")).toBe("2026-11-11T08:00:00-03:00");
  });

  it("mantém o fuso quando já existe", () => {
    expect(paraIsoBrasilia("2026-11-11T08:00:00Z")).toBe("2026-11-11T08:00:00Z");
    expect(paraIsoBrasilia("2026-11-11T08:00:00-03:00")).toBe("2026-11-11T08:00:00-03:00");
  });

  it("devolve null para vazio ou inválido", () => {
    expect(paraIsoBrasilia(null)).toBeNull();
    expect(paraIsoBrasilia("")).toBeNull();
    expect(paraIsoBrasilia("não é data")).toBeNull();
  });
});

describe("normalizarContratacao", () => {
  it("normaliza a dispensa real", () => {
    const o = normalizarContratacao(ler(AMOSTRA_DISPENSA), AGORA);
    expect(o).not.toBeNull();
    expect(o).toMatchObject({
      id: "00394502000144-1-015323/2026",
      objeto: "Serviço de Seguro para viaturas",
      valorEstimado: 7434.24,
      orgao: "COMANDO DA MARINHA",
      orgaoCnpj: "00394502000144",
      unidade: "CENTRO DE OBTENÇÃO DA MARINHA DO RJ",
      municipio: "Rio de Janeiro",
      codigoIbge: "3304557",
      uf: "RJ",
      regiao: "capital",
      modalidadeId: 8,
      modalidadeNome: "Dispensa",
      dataAbertura: "2026-11-06T08:00:00-03:00",
      dataEncerramento: "2026-11-11T08:00:00-03:00",
      anoCompra: 2026,
      sequencialCompra: 15323,
      linkPncp: "https://pncp.gov.br/app/editais/00394502000144/2026/15323",
    });
    expect(o?.linkOrigem).toContain("comprasnet-web");
  });

  it("trata valor zero como sigiloso (null) no pregão real", () => {
    const o = normalizarContratacao(ler(AMOSTRA_PREGAO), AGORA);
    expect(o?.valorEstimado).toBeNull();
    expect(o?.modalidadeId).toBe(6);
    expect(o?.regiao).toBe("rj");
    expect(o?.linkPncp).toBe("https://pncp.gov.br/app/editais/01623783000122/2026/49");
  });

  it("descarta item com encerramento no passado", () => {
    const depois = new Date("2026-11-11T09:00:00-03:00");
    expect(normalizarContratacao(ler(AMOSTRA_DISPENSA), depois)).toBeNull();
  });

  it("usa o fuso de Brasília na comparação do encerramento", () => {
    // 08:00 em Brasília = 11:00 UTC. Às 10:00 UTC ainda está aberto; às 12:00 UTC já encerrou.
    expect(normalizarContratacao(ler(AMOSTRA_DISPENSA), new Date("2026-11-11T10:00:00Z"))).not.toBeNull();
    expect(normalizarContratacao(ler(AMOSTRA_DISPENSA), new Date("2026-11-11T12:00:00Z"))).toBeNull();
  });

  it("descarta item sem data de encerramento ou com modalidade fora de 6 e 8", () => {
    expect(normalizarContratacao(ler({ ...AMOSTRA_DISPENSA, dataEncerramentoProposta: null }), AGORA)).toBeNull();
    expect(normalizarContratacao(ler({ ...AMOSTRA_DISPENSA, modalidadeId: 4 }), AGORA)).toBeNull();
  });

  it("remove repetidos na lista", () => {
    const lista = normalizarLista([ler(AMOSTRA_DISPENSA), ler(AMOSTRA_DISPENSA), ler(AMOSTRA_PREGAO)], AGORA);
    expect(lista).toHaveLength(2);
  });
});
