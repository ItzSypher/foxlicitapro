import { describe, expect, it } from "vitest";
import { FICHA_EXEMPLO } from "@/core/ficha.fixture";
import type { FichaEdital } from "@/core/ficha";
import { contarAtencao, linhasDeExigencias } from "./exigencias";

const vazio = { trecho: null, pagina: null } as const;

function achar(ficha: FichaEdital, id: string) {
  const linha = linhasDeExigencias(ficha).find((l) => l.id === id);
  if (!linha) throw new Error(`linha ${id} não encontrada`);
  return linha;
}

describe("linhas de exigências da ficha", () => {
  it("marca como claro o que está informado e sem peso", () => {
    expect(achar(FICHA_EXEMPLO, "criterio")).toMatchObject({ valor: "Menor preço", atencao: false });
    expect(achar(FICHA_EXEMPLO, "me-epp")).toMatchObject({ valor: "Sim", atencao: false });
    expect(achar(FICHA_EXEMPLO, "documentos")).toMatchObject({ valor: "2 documentos", atencao: false });
  });

  it("pede conferência de garantia e multas", () => {
    expect(achar(FICHA_EXEMPLO, "garantia")).toMatchObject({ valor: "5% do contrato", atencao: true });
    expect(achar(FICHA_EXEMPLO, "multas").atencao).toBe(true);
  });

  it("garantia zero é sem garantia e não pede conferência", () => {
    const ficha: FichaEdital = { ...FICHA_EXEMPLO, garantiaContratualPercentual: { valor: 0, ...vazio } };
    expect(achar(ficha, "garantia")).toMatchObject({ valor: "Sem garantia", atencao: false });
  });

  it("o que o edital não informa vira atenção", () => {
    const ficha: FichaEdital = {
      ...FICHA_EXEMPLO,
      modoDisputa: { valor: "não informado no edital", ...vazio },
      exclusividadeMeEpp: { valor: null, ...vazio },
      documentosHabilitacao: { valor: [], ...vazio },
    };
    expect(achar(ficha, "modo")).toMatchObject({ valor: "Não informado", atencao: true });
    expect(achar(ficha, "me-epp")).toMatchObject({ valor: "Não informado", atencao: true });
    expect(achar(ficha, "documentos")).toMatchObject({ valor: "Não informado", atencao: true });
    expect(contarAtencao(linhasDeExigencias(ficha))).toBe(5);
  });
});
