import { describe, expect, it } from "vitest";
import {
  ERRO_PALAVRA_BRASIL,
  LIMITES_FORA_RJ,
  UFS,
  UFS_FORA_RJ,
  avisoCorteForaRj,
  avisoFalhaForaRj,
  lerBuscaForaRj,
  montarQueryForaRj,
  validarBuscaForaRj,
  type ResultadoForaRj,
} from "./fora-rj-busca";

function parametros(texto: string): { get(nome: string): string | null } {
  return new URLSearchParams(texto);
}

const base: ResultadoForaRj = {
  busca: { uf: "SP", codigoMunicipioIbge: null, palavra: "", incluirProdutos: false },
  itens: [],
  totalFiltrado: 0,
  lidas: 0,
  paginasConsultadas: 0,
  paginasNoPncp: 0,
  cortouPaginas: false,
  falhas: [],
  diasJanela: LIMITES_FORA_RJ.diasAFrente,
  atualizadoEm: "2026-11-10T15:00:00.000Z",
};

describe("lista de UFs", () => {
  it("tem as 27 UFs, sem repetir sigla nem código, e a busca oferece 26 (sem o RJ)", () => {
    expect(UFS).toHaveLength(27);
    expect(new Set(UFS.map((u) => u.sigla)).size).toBe(27);
    expect(new Set(UFS.map((u) => u.codigo)).size).toBe(27);
    expect(UFS_FORA_RJ).toHaveLength(26);
    expect(UFS_FORA_RJ.some((u) => u.sigla === "RJ")).toBe(false);
  });
});

describe("validarBuscaForaRj", () => {
  it("aceita um estado sem município nem palavra", () => {
    expect(validarBuscaForaRj({ uf: "sp" })).toEqual({
      tipo: "ok",
      busca: { uf: "SP", codigoMunicipioIbge: null, palavra: "", incluirProdutos: false },
    });
  });

  it("aceita município do próprio estado e recusa o de outro", () => {
    const ok = validarBuscaForaRj({ uf: "SP", codigoMunicipioIbge: "3550308", palavra: "  software  de gestão " });
    expect(ok).toEqual({
      tipo: "ok",
      busca: { uf: "SP", codigoMunicipioIbge: "3550308", palavra: "software de gestão", incluirProdutos: false },
    });
    expect(validarBuscaForaRj({ uf: "SP", codigoMunicipioIbge: "3304557" }).tipo).toBe("invalida");
    expect(validarBuscaForaRj({ uf: "SP", codigoMunicipioIbge: "35503" }).tipo).toBe("invalida");
  });

  it("exige palavra-chave no Brasil todo e ignora o município", () => {
    expect(validarBuscaForaRj({ uf: "BR" })).toEqual({ tipo: "invalida", erro: ERRO_PALAVRA_BRASIL });
    expect(validarBuscaForaRj({ uf: "BR", palavra: "de a" }).tipo).toBe("invalida");
    expect(validarBuscaForaRj({ uf: "br", palavra: "software", codigoMunicipioIbge: "3550308" })).toEqual({
      tipo: "ok",
      busca: { uf: "BR", codigoMunicipioIbge: null, palavra: "software", incluirProdutos: false },
    });
  });

  it("recusa o RJ e estados que não existem", () => {
    expect(validarBuscaForaRj({ uf: "RJ" }).tipo).toBe("invalida");
    expect(validarBuscaForaRj({ uf: "XX" }).tipo).toBe("invalida");
  });
});

describe("lerBuscaForaRj e montarQueryForaRj", () => {
  it("sem ?uf= não há busca", () => {
    expect(lerBuscaForaRj(parametros(""))).toEqual({ tipo: "vazia" });
    expect(lerBuscaForaRj(parametros("q=software"))).toEqual({ tipo: "vazia" });
  });

  it("vai e volta pela URL", () => {
    const busca = { uf: "MG", codigoMunicipioIbge: "3106200", palavra: "suporte técnico", incluirProdutos: true };
    const texto = montarQueryForaRj(busca);
    expect(texto).toBe("uf=MG&mun=3106200&q=suporte+t%C3%A9cnico&prod=1");
    expect(lerBuscaForaRj(parametros(texto))).toEqual({ tipo: "ok", busca });
  });

  it("omite o que está no padrão", () => {
    expect(montarQueryForaRj({ uf: "BA", codigoMunicipioIbge: null, palavra: "", incluirProdutos: false })).toBe("uf=BA");
  });
});

describe("avisos", () => {
  it("não avisa quando leu tudo", () => {
    expect(avisoCorteForaRj(base)).toBeNull();
    expect(avisoFalhaForaRj(base)).toBeNull();
  });

  it("avisa o corte com as páginas lidas e o limite", () => {
    const texto = avisoCorteForaRj({ ...base, cortouPaginas: true, paginasConsultadas: 10, paginasNoPncp: 23 });
    expect(texto).toContain("10 de 23 páginas");
    expect(texto).toContain(`até ${LIMITES_FORA_RJ.maxPaginas} por modalidade`);
    expect(texto).toContain("município");
  });

  it("no Brasil todo sugere escolher um estado", () => {
    const texto = avisoCorteForaRj({
      ...base,
      busca: { uf: "BR", codigoMunicipioIbge: null, palavra: "software", incluirProdutos: false },
      cortouPaginas: true,
      paginasConsultadas: 10,
      paginasNoPncp: 400,
    });
    expect(texto).toContain("Escolha um estado");
  });

  it("avisa a falha parcial por modalidade", () => {
    expect(avisoFalhaForaRj({ ...base, falhas: [6] })).toContain("pregões");
    expect(avisoFalhaForaRj({ ...base, falhas: [8] })).toContain("dispensas");
    expect(avisoFalhaForaRj({ ...base, falhas: [6, 8] })).toContain("PNCP não entregou");
  });
});
