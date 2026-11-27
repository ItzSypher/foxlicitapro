import { describe, expect, it } from "vitest";
import { ATIVIDADE_DA_EMPRESA, avaliarPregao, ehModalidadePregao, excecaoCasada } from "./pregao";

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
      casouFoco: null,
      foraDoFoco: true,
    });
  });

  it("pregão com termo do foco casado não fica fora do foco", () => {
    expect(avaliarPregao({ ...base, objeto: "Desenvolvimento de site institucional", focoCasado: "site" })).toEqual({
      ehPregao: true,
      excecao: null,
      casouFoco: "site",
      foraDoFoco: false,
    });
  });

  it("pregão que casa só com o CNAE da empresa não fica fora do foco", () => {
    const r = avaliarPregao({ ...base, objeto: "Manutenção de redes", cnaesCasados: ["61.90-6-99"] });
    expect(r).toMatchObject({ ehPregao: true, excecao: null, casouFoco: ATIVIDADE_DA_EMPRESA, foraDoFoco: false });
    expect(avaliarPregao({ ...base, objeto: "Manutenção de redes", cnaesCasados: [], focoCasado: null }).foraDoFoco).toBe(true);
  });

  it("pregão com exceção não fica fora do foco", () => {
    expect(avaliarPregao({ ...base, objeto: "Serviço de suporte gerenciado de infraestrutura" })).toEqual({
      ehPregao: true,
      excecao: "suporte gerenciado",
      casouFoco: null,
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
      casouFoco: null,
      foraDoFoco: false,
    });
  });
});
