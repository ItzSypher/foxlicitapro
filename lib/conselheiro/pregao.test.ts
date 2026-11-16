import { describe, expect, it } from "vitest";
import { avaliarPregao, ehModalidadePregao, excecaoCasada } from "./pregao";

describe("ehModalidadePregao", () => {
  it("reconhece o pregão pelo código ou pelo nome", () => {
    expect(ehModalidadePregao(6, "Pregão - Eletrônico")).toBe(true);
    expect(ehModalidadePregao(1, "Pregão Presencial")).toBe(true);
    expect(ehModalidadePregao(8, "Dispensa")).toBe(false);
  });
});

describe("excecaoCasada", () => {
  it("casa sem acento, sem maiúsculas e com plural", () => {
    expect(excecaoCasada("Contratação de SUPORTE Gerenciado de TI", ["suporte gerenciado"])).toBe("suporte gerenciado");
    expect(excecaoCasada("Aquisição de licenças", ["licenca"])).toBe("licenca");
  });

  it("exige início de palavra e ignora termo vazio", () => {
    expect(excecaoCasada("Contrassuporte gerenciado", ["suporte gerenciado"])).toBeNull();
    expect(excecaoCasada("Compra de mesas", ["", "  "])).toBeNull();
  });
});

describe("avaliarPregao", () => {
  const base = { modalidadeId: 6, modalidadeNome: "Pregão - Eletrônico", excecoes: ["suporte gerenciado"] };

  it("pregão sem exceção fica fora do foco", () => {
    expect(avaliarPregao({ ...base, objeto: "Aquisição de licenças Zoom Workplace Pro por 24 meses" })).toEqual({
      ehPregao: true,
      excecao: null,
      foraDoFoco: true,
    });
  });

  it("pregão com exceção não fica fora do foco", () => {
    expect(avaliarPregao({ ...base, objeto: "Serviço de suporte gerenciado de infraestrutura" })).toEqual({
      ehPregao: true,
      excecao: "suporte gerenciado",
      foraDoFoco: false,
    });
  });

  it("lista de exceções vazia deixa todo pregão fora do foco", () => {
    expect(avaliarPregao({ ...base, excecoes: [], objeto: "Suporte gerenciado" }).foraDoFoco).toBe(true);
  });

  it("outra modalidade nunca fica fora do foco", () => {
    expect(avaliarPregao({ ...base, modalidadeId: 8, modalidadeNome: "Dispensa", objeto: "Licenças" })).toEqual({
      ehPregao: false,
      excecao: null,
      foraDoFoco: false,
    });
  });
});
