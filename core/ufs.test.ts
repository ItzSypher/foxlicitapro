import { describe, expect, it } from "vitest";
import { UFS, ordenarUfsParaFiltro } from "./ufs";

describe("ordenarUfsParaFiltro", () => {
  it("sem UFs atendidas: Sudeste primeiro e o resto em ordem alfabética", () => {
    const r = ordenarUfsParaFiltro([]);
    expect(r).toHaveLength(27);
    expect(r.slice(0, 4)).toEqual(["RJ", "SP", "MG", "ES"]);
    expect(r.slice(4, 8)).toEqual(["AC", "AL", "AM", "AP"]);
  });

  it("as atendidas vêm primeiro, depois o Sudeste que sobrou, depois o resto", () => {
    const r = ordenarUfsParaFiltro(["BA", "RJ"]);
    expect(r.slice(0, 2)).toEqual(["BA", "RJ"]);
    expect(r.slice(2, 5)).toEqual(["SP", "MG", "ES"]);
    expect(r[5]).toBe("AC");
    expect(r).not.toContain(undefined);
  });

  it("não repete UF e ignora sigla inválida ou em minúsculas", () => {
    const r = ordenarUfsParaFiltro(["sp", "SP", "XX", ""]);
    expect(r).toHaveLength(27);
    expect(new Set(r).size).toBe(27);
    expect(r.slice(0, 4)).toEqual(["SP", "RJ", "MG", "ES"]);
  });

  it("sempre devolve exatamente as 27 UFs", () => {
    expect([...ordenarUfsParaFiltro(["PR", "SC"])].sort()).toEqual(UFS.map((u) => u.sigla).sort());
  });
});
