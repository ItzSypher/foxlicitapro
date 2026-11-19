import { describe, expect, it } from "vitest";
import {
  META_PADRAO,
  inicioDaSemana,
  inicioDoHistorico,
  montarPainelMeta,
  normalizarMeta,
  percentualDaBarra,
  placar,
  posicaoDoMinimo,
  statusDaMeta,
  ultimasSemanas,
  type EntradaEmDisputa,
} from "./meta";

// Terça 12/05/2026, 10h em São Paulo
const AGORA = new Date("2026-05-12T13:00:00Z");

function entrada(itemId: string, iso: string): EntradaEmDisputa {
  return { itemId, em: new Date(iso) };
}

describe("inicioDaSemana", () => {
  it("segunda 0h em São Paulo", () => {
    expect(inicioDaSemana(AGORA).toISOString()).toBe("2026-05-11T03:00:00.000Z");
    // domingo 17/05, 23h em São Paulo, ainda é a semana de 11/05
    expect(inicioDaSemana(new Date("2026-05-18T02:00:00Z")).toISOString()).toBe("2026-05-11T03:00:00.000Z");
    // segunda 18/05, 0h30 em São Paulo
    expect(inicioDaSemana(new Date("2026-05-18T03:30:00Z")).toISOString()).toBe("2026-05-18T03:00:00.000Z");
  });
});

describe("statusDaMeta", () => {
  it("abaixo, no mínimo e no ideal", () => {
    expect(statusDaMeta(0, META_PADRAO)).toBe("abaixo");
    expect(statusDaMeta(4, META_PADRAO)).toBe("abaixo");
    expect(statusDaMeta(5, META_PADRAO)).toBe("minimo");
    expect(statusDaMeta(9, META_PADRAO)).toBe("minimo");
    expect(statusDaMeta(10, META_PADRAO)).toBe("ideal");
    expect(statusDaMeta(14, META_PADRAO)).toBe("ideal");
  });
});

describe("normalizarMeta", () => {
  it("mínimo de 1 e ideal nunca abaixo do mínimo", () => {
    expect(normalizarMeta(0, 0)).toEqual({ minimo: 1, ideal: 1 });
    expect(normalizarMeta(8, 3)).toEqual({ minimo: 8, ideal: 8 });
    expect(normalizarMeta(5.9, 10.2)).toEqual({ minimo: 5, ideal: 10 });
    expect(normalizarMeta(Number.NaN, Number.NaN)).toEqual({ minimo: 1, ideal: 1 });
    expect(normalizarMeta(9999, 9999)).toEqual({ minimo: 500, ideal: 500 });
  });
});

describe("placar", () => {
  it("conta itens distintos que entraram em disputa na semana (segunda a domingo)", () => {
    const entradas = [
      entrada("a", "2026-05-11T03:00:00Z"), // segunda 0h: entra
      entrada("a", "2026-05-12T10:00:00Z"), // o mesmo item: conta uma vez
      entrada("b", "2026-05-18T02:59:00Z"), // domingo 23h59: entra
      entrada("c", "2026-05-18T03:00:00Z"), // próxima semana: fora
      entrada("d", "2026-05-11T02:59:00Z"), // semana anterior: fora
    ];
    const p = placar(entradas, AGORA, META_PADRAO);
    expect(p.disputas).toBe(2);
    expect(p.status).toBe("abaixo");
    expect(p.faltamParaMinimo).toBe(3);
    expect(p.faltamParaIdeal).toBe(8);
    expect(p.inicio).toBe("2026-05-11T03:00:00.000Z");
  });
  it("no mínimo e no ideal", () => {
    const cinco = Array.from({ length: 5 }, (_, i) => entrada(`i${i}`, "2026-05-12T10:00:00Z"));
    expect(placar(cinco, AGORA, META_PADRAO)).toMatchObject({ disputas: 5, status: "minimo", faltamParaMinimo: 0, faltamParaIdeal: 5 });
    const dez = Array.from({ length: 10 }, (_, i) => entrada(`i${i}`, "2026-05-12T10:00:00Z"));
    expect(placar(dez, AGORA, META_PADRAO)).toMatchObject({ disputas: 10, status: "ideal", faltamParaIdeal: 0 });
  });
  it("sem entradas: zero", () => {
    expect(placar([], AGORA, META_PADRAO).disputas).toBe(0);
  });
  it("usa a meta da empresa", () => {
    const tres = Array.from({ length: 3 }, (_, i) => entrada(`i${i}`, "2026-05-12T10:00:00Z"));
    expect(placar(tres, AGORA, { minimo: 2, ideal: 3 }).status).toBe("ideal");
  });
});

describe("ultimasSemanas", () => {
  it("quatro semanas anteriores, da mais antiga para a mais recente, sem a atual", () => {
    const entradas = [
      entrada("a", "2026-05-12T10:00:00Z"), // atual: fora do histórico
      entrada("b", "2026-05-05T10:00:00Z"), // semana de 04/05
      entrada("c", "2026-05-06T10:00:00Z"),
      entrada("d", "2026-04-28T10:00:00Z"), // semana de 27/04
      entrada("e", "2026-04-14T10:00:00Z"), // semana de 13/04
      entrada("f", "2026-04-01T10:00:00Z"), // fora das quatro
    ];
    const semanas = ultimasSemanas(entradas, AGORA, { minimo: 2, ideal: 4 });
    expect(semanas.map((s) => s.inicio)).toEqual([
      "2026-04-13T03:00:00.000Z",
      "2026-04-20T03:00:00.000Z",
      "2026-04-27T03:00:00.000Z",
      "2026-05-04T03:00:00.000Z",
    ]);
    expect(semanas.map((s) => s.disputas)).toEqual([1, 0, 1, 2]);
    expect(semanas.map((s) => s.status)).toEqual(["abaixo", "abaixo", "abaixo", "minimo"]);
  });
  it("o histórico começa na semana mais antiga mostrada", () => {
    expect(inicioDoHistorico(AGORA).toISOString()).toBe("2026-04-13T03:00:00.000Z");
  });
});

describe("montarPainelMeta e barra", () => {
  it("junta placar, histórico e propostas", () => {
    const painel = montarPainelMeta([entrada("a", "2026-05-12T10:00:00Z")], AGORA, META_PADRAO, { enviadas: 2, aguardando: 3, ganhas: 1 });
    expect(painel.placar.disputas).toBe(1);
    expect(painel.historico).toHaveLength(4);
    expect(painel.propostas).toEqual({ enviadas: 2, aguardando: 3, ganhas: 1 });
  });
  it("barra limitada ao ideal e marca do mínimo", () => {
    expect(percentualDaBarra(5, META_PADRAO)).toBe(50);
    expect(percentualDaBarra(20, META_PADRAO)).toBe(100);
    expect(posicaoDoMinimo(META_PADRAO)).toBe(50);
    expect(posicaoDoMinimo({ minimo: 3, ideal: 12 })).toBe(25);
  });
});
