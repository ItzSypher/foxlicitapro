import { describe, expect, it } from "vitest";
import { casarCnaes, casarCnaesComForca, normalizarTexto, PALAVRAS_CHAVE, TERMOS_FORTES } from "./cnae-keywords";
import { TODOS_CNAES } from "./empresa";

describe("tabela de palavras-chave", () => {
  it("tem de 12 a 20 termos por CNAE, normalizados", () => {
    for (const cnae of TODOS_CNAES) {
      const termos = PALAVRAS_CHAVE[cnae.codigo as keyof typeof PALAVRAS_CHAVE];
      expect(termos.length, cnae.codigo).toBeGreaterThanOrEqual(12);
      expect(termos.length, cnae.codigo).toBeLessThanOrEqual(20);
      for (const termo of termos) {
        expect(normalizarTexto(termo), `${cnae.codigo}: ${termo}`).toBe(termo);
      }
    }
  });
});

describe("normalizarTexto", () => {
  it("remove acento, caixa e espaços repetidos", () => {
    expect(normalizarTexto("  Manutenção   de COMPUTADORES, ")).toBe("manutencao de computadores");
  });
});

describe("casarCnaes: acertos", () => {
  it("casa manutenção de computadores, com plural e acento", () => {
    const r = casarCnaes("Contratação de empresa para MANUTENÇÃO de computadores e impressoras");
    expect(r.servicos).toContain("95.11-8-00");
  });

  it("casa toner e nobreak na frente de produtos", () => {
    const r = casarCnaes("Aquisição de toners e nobreaks para a secretaria");
    expect(r.produtos).toContain("47.51-2-01");
    expect(r.servicos).toEqual([]);
  });

  it("casa cabeamento estruturado e CFTV em CNAEs diferentes", () => {
    const r = casarCnaes("Execução de cabeamento estruturado e instalação de CFTV no prédio");
    expect(r.servicos).toEqual(expect.arrayContaining(["61.90-6-99", "43.21-5-00"]));
  });
});

describe("casarCnaes: falsos positivos evitados", () => {
  it("não confunde rede de esgoto com redes de computadores", () => {
    const r = casarCnaes("Obra de ampliação da rede de esgoto e rede de abastecimento");
    expect(r.servicos).not.toContain("61.90-6-99");
  });

  it("não confunde tomada de preços com material elétrico", () => {
    const r = casarCnaes("Tomada de preços para reforma de escola");
    expect(r.produtos).not.toContain("47.42-3-00");
  });

  it("não classifica papel higiênico como equipamento de escritório", () => {
    const r = casarCnaes("Aquisição de papel higiênico e papel toalha");
    expect(r.produtos).not.toContain("47.89-0-07");
    expect(r.produtos).toContain("47.89-0-05");
  });

  it("não confunde tinta de impressora com tinta de parede", () => {
    const r = casarCnaes("Aquisição de cartucho de tinta para impressora");
    expect(r.produtos).not.toContain("47.41-5-00");
    expect(r.produtos).toContain("47.51-2-01");
  });

  it("não confunde circuito fechado de televisão com televisores", () => {
    const r = casarCnaes("Circuito fechado de televisão com 16 câmeras de segurança");
    expect(r.produtos).not.toContain("47.53-9-00");
  });

  it("não casa palavra dentro de outra (limite de palavra)", () => {
    expect(casarCnaes("Fornecimento de antonerismo e pensoneres").produtos).toEqual([]);
  });

  it("não casa objetos sem relação", () => {
    const r = casarCnaes("Manutenção preventiva e corretiva de veículos da frota");
    expect(r.servicos).toEqual([]);
    expect(r.produtos).toEqual([]);
  });
});

describe("termos fortes", () => {
  it("todo termo forte existe na tabela do mesmo CNAE e cada CNAE tem ao menos um", () => {
    for (const cnae of TODOS_CNAES) {
      const codigo = cnae.codigo as keyof typeof PALAVRAS_CHAVE;
      expect(TERMOS_FORTES[codigo].length, codigo).toBeGreaterThan(0);
      for (const termo of TERMOS_FORTES[codigo]) {
        expect(PALAVRAS_CHAVE[codigo], `${codigo}: ${termo}`).toContain(termo);
      }
    }
  });
});

describe("casarCnaesComForca", () => {
  it("marca forte e conta termos distintos", () => {
    const r = casarCnaesComForca("Manutenção de computadores e manutenção de impressoras");
    expect(r.servicos).toEqual([
      { codigo: "95.11-8-00", termos: ["manutencao de computador", "manutencao de impressora"], forte: true },
    ]);
  });

  it("termo fraco isolado não é forte", () => {
    const r = casarCnaesComForca("Aquisição de caneca");
    expect(r.produtos).toEqual([{ codigo: "47.89-0-99", termos: ["caneca"], forte: false }]);
  });

  it("termos negativos anulam o casamento", () => {
    expect(casarCnaes("Manutenção de instalação elétrica da subestação de média tensão").servicos).toEqual([]);
    expect(casarCnaes("Reforma das subestações com rede elétrica").servicos).toEqual([]);
    expect(casarCnaes("Manutenção elétrica de ambulância e veículos").servicos).toEqual([]);
    expect(casarCnaes("Obra predial com instalação elétrica").servicos).toEqual([]);
    expect(casarCnaes("Manutenção elétrica do prédio").servicos).toContain("43.21-5-00");
  });
});
