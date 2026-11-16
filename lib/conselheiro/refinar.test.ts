import { describe, expect, it } from "vitest";
import type { SaidaConselheiro } from "./esquema";
import { refinarSaida } from "./refinar";
import { AVISO_VALORES_ESTRANHOS, valoresEstranhos } from "./valores";

const SAIDA: SaidaConselheiro = {
  veredito: "vale",
  resumo: "Vale a pena participar.",
  porQue: ["Casa com os CNAEs."],
  comoConseguir: [{ canal: "Revenda parceira", passos: ["Cotar"], prazoTipico: "Poucos dias", cuidados: [] }],
  precoComentario: "O alvo de R$ 95.000,50 cabe no teto de R$ 114.000,00.",
  riscos: [],
  proximosPassos: ["Cotar"],
  modalidade: { ehPregao: false, foraDoFoco: false, observacao: "Dispensa." },
};

const PERMITIDOS = [95000.5, 114000, 120000];

describe("valoresEstranhos", () => {
  it("aceita só valores do sistema, com tolerância de arredondamento", () => {
    expect(valoresEstranhos(["Alvo de R$ 95.000,50 e teto R$ 114.000"], PERMITIDOS)).toEqual([]);
    expect(valoresEstranhos(["Cerca de R$ 120 mil"], PERMITIDOS)).toEqual([]);
  });

  it("aponta valor que o sistema não entregou", () => {
    expect(valoresEstranhos(["Em revendas sai por R$ 3.500,00 a licença"], PERMITIDOS)).toEqual(["R$ 3.500,00"]);
    expect(valoresEstranhos(["Sai por R$ 2 milhões"], PERMITIDOS)).toEqual(["R$ 2 milhões"]);
  });
});

describe("refinarSaida", () => {
  const livre = { pregao: { ehPregao: false, excecao: null, foraDoFoco: false }, valoresPermitidos: PERMITIDOS };
  const fora = { ...livre, pregao: { ehPregao: true, excecao: null, foraDoFoco: true } };

  it("não mexe em saída que respeita as regras", () => {
    expect(refinarSaida(SAIDA, livre)).toEqual(SAIDA);
  });

  it("a regra do sistema manda na modalidade, não o modelo", () => {
    const r = refinarSaida(SAIDA, { ...livre, pregao: { ehPregao: true, excecao: "suporte gerenciado", foraDoFoco: false } });
    expect(r.modalidade).toMatchObject({ ehPregao: true, foraDoFoco: false });
  });

  it("pregão fora do foco não passa de talvez", () => {
    const r = refinarSaida(SAIDA, fora);
    expect(r.veredito).toBe("talvez");
    expect(r.modalidade.foraDoFoco).toBe(true);
    expect(refinarSaida({ ...SAIDA, veredito: "nao-vale" }, fora).veredito).toBe("nao-vale");
  });

  it("pregão com exceção mantém o veredito", () => {
    const r = refinarSaida(SAIDA, { ...livre, pregao: { ehPregao: true, excecao: "suporte gerenciado", foraDoFoco: false } });
    expect(r.veredito).toBe("vale");
  });

  it("valor estranho ganha aviso nos riscos, sem passar de 8", () => {
    const cheio = { ...SAIDA, precoComentario: "Compre por R$ 10,00 na revenda.", riscos: Array.from({ length: 8 }, (_, i) => `Risco ${i}`) };
    const r = refinarSaida(cheio, livre);
    expect(r.riscos).toHaveLength(8);
    expect(r.riscos.at(-1)).toBe(AVISO_VALORES_ESTRANHOS);
  });
});
