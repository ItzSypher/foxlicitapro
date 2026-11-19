import { describe, expect, it } from "vitest";
import {
  REGIOES_METROPOLITANAS,
  areasDasRegioes,
  dentroDasAreas,
  municipiosDoAtalho,
  normalizarAreas,
  pontuacaoLocal,
  regioesDasAreas,
  ufsDeColeta,
  uniaoDeUfs,
  type Areas,
} from "./areas";

const NOVA_IGUACU = "3303500";
const DUQUE_DE_CAXIAS = "3301702";
const RIO = "3304557";
const PETROPOLIS = "3303906";
const BH = "3106200";
const SAO_PAULO = "3550308";

const AREAS: Areas = {
  ufs: ["RJ", "MG"],
  municipiosIbge: [],
  base: { uf: "RJ", municipioIbge: NOVA_IGUACU },
};

function local(codigoIbge: string, uf: string) {
  return { codigoIbge, uf };
}

describe("dentroDasAreas", () => {
  it("vale para o estado marcado inteiro e para município avulso", () => {
    expect(dentroDasAreas(local(PETROPOLIS, "RJ"), AREAS)).toBe(true);
    expect(dentroDasAreas(local(SAO_PAULO, "SP"), AREAS)).toBe(false);
    const avulso: Areas = { ufs: [], municipiosIbge: [SAO_PAULO], base: { uf: "SP", municipioIbge: SAO_PAULO } };
    expect(dentroDasAreas(local(SAO_PAULO, "SP"), avulso)).toBe(true);
    expect(dentroDasAreas(local("3509502", "SP"), avulso)).toBe(false);
  });
});

describe("pontuacaoLocal", () => {
  it("quanto mais perto da base, mais nota", () => {
    const nota = (codigo: string, uf: string) => pontuacaoLocal(local(codigo, uf), { ...AREAS, ufs: ["RJ", "MG", "SP"] }).pontos;
    const mesmoMunicipio = nota(NOVA_IGUACU, "RJ");
    const mesmaRm = nota(DUQUE_DE_CAXIAS, "RJ");
    const mesmoEstado = nota(PETROPOLIS, "RJ");
    const outroEstado = nota(SAO_PAULO, "SP");
    expect(mesmoMunicipio).toBe(20);
    expect([mesmaRm, mesmoEstado, outroEstado]).toEqual([16, 6, 3]);
    expect(mesmoMunicipio).toBeGreaterThan(mesmaRm);
    expect(mesmaRm).toBeGreaterThan(mesmoEstado);
    expect(mesmoEstado).toBeGreaterThan(outroEstado);
  });

  it("capital ou região metropolitana do estado-base fica acima do interior, quando a base é no interior", () => {
    const base: Areas = { ufs: ["RJ"], municipiosIbge: [], base: { uf: "RJ", municipioIbge: PETROPOLIS } };
    expect(pontuacaoLocal(local(RIO, "RJ"), base)).toMatchObject({ nivel: "capital-ou-rm", pontos: 12 });
    expect(pontuacaoLocal(local("3300704", "RJ"), base)).toMatchObject({ nivel: "mesma-uf", pontos: 6 });
  });

  it("fora das áreas não pontua", () => {
    expect(pontuacaoLocal(local(SAO_PAULO, "SP"), AREAS)).toEqual({ nivel: "fora", pontos: 0, dentro: false });
  });

  it("base em Belo Horizonte: Betim é da mesma região metropolitana", () => {
    const bh: Areas = { ufs: ["MG"], municipiosIbge: [], base: { uf: "MG", municipioIbge: BH } };
    expect(pontuacaoLocal(local("3106705", "MG"), bh).nivel).toBe("mesma-rm");
    expect(pontuacaoLocal(local(RIO, "RJ"), { ...bh, ufs: ["MG", "RJ"] }).nivel).toBe("outra-uf");
  });

  it("sem município-base vale o estado-base", () => {
    const semMunicipio: Areas = { ufs: ["RJ"], municipiosIbge: [], base: { uf: "RJ", municipioIbge: null } };
    expect(pontuacaoLocal(local(DUQUE_DE_CAXIAS, "RJ"), semMunicipio).nivel).toBe("capital-ou-rm");
    expect(pontuacaoLocal(local(PETROPOLIS, "RJ"), semMunicipio).nivel).toBe("mesma-uf");
  });
});

describe("regiões metropolitanas", () => {
  it("o atalho traz a capital e a região metropolitana de RJ, MG e ES", () => {
    expect(REGIOES_METROPOLITANAS.map((r) => r.uf)).toEqual(["RJ", "MG", "ES"]);
    expect(municipiosDoAtalho("RJ")).toHaveLength(20);
    expect(municipiosDoAtalho("MG")).toHaveLength(34);
    expect(municipiosDoAtalho("es")).toHaveLength(7);
    expect(municipiosDoAtalho("SP")).toEqual([]);
    for (const rm of REGIOES_METROPOLITANAS) {
      expect(Object.keys(rm.municipios)).toContain(rm.capitalIbge);
      for (const codigo of Object.keys(rm.municipios)) expect(codigo).toMatch(/^[0-9]{7}$/);
    }
  });
});

describe("normalizarAreas e UFs de coleta", () => {
  it("descarta UF e código inválidos, tira repetidos e alinha a UF da base", () => {
    const a = normalizarAreas({
      ufs: ["rj", "RJ", "XX", 3],
      municipiosIbge: [RIO, RIO, "123", "9999999"],
      base: { uf: "SP", municipioIbge: NOVA_IGUACU },
    });
    expect(a).toEqual({ ufs: ["RJ"], municipiosIbge: [RIO], base: { uf: "RJ", municipioIbge: NOVA_IGUACU } });
    expect(normalizarAreas(null).ufs).toEqual([]);
  });

  it("a coleta cobre as UFs marcadas e as dos municípios avulsos, sem repetir", () => {
    const a: Areas = { ufs: ["RJ"], municipiosIbge: [BH, RIO, SAO_PAULO], base: { uf: "RJ", municipioIbge: null } };
    expect(ufsDeColeta(a)).toEqual(["MG", "RJ", "SP"]);
    expect(uniaoDeUfs([a, AREAS])).toEqual(["MG", "RJ", "SP"]);
  });
});

describe("compatibilidade com as regiões antigas", () => {
  it("'rj' vira o estado inteiro; sem ele, os municípios de cada região", () => {
    expect(areasDasRegioes(["nova-iguacu", "baixada", "capital", "rj"], "RJ", "Nova Iguaçu")).toEqual({
      ufs: ["RJ"],
      municipiosIbge: [],
      base: { uf: "RJ", municipioIbge: NOVA_IGUACU },
    });
    const parcial = areasDasRegioes(["nova-iguacu", "capital"], "RJ", "NOVA IGUAÇU");
    expect(parcial.ufs).toEqual([]);
    expect(parcial.municipiosIbge).toEqual([NOVA_IGUACU, RIO].sort());
  });

  it("empresa de outro estado com fora-rj atende o próprio estado", () => {
    const a = areasDasRegioes(["fora-rj"], "sp", "Campinas");
    expect(a.ufs).toEqual(["SP"]);
    expect(a.base).toEqual({ uf: "SP", municipioIbge: null });
  });

  it("regioesDasAreas devolve as regiões equivalentes", () => {
    expect(regioesDasAreas(AREAS)).toEqual(["nova-iguacu", "baixada", "capital", "rj", "fora-rj"]);
    expect(regioesDasAreas({ ufs: [], municipiosIbge: [RIO], base: { uf: "RJ", municipioIbge: RIO } })).toEqual(["capital"]);
  });
});
