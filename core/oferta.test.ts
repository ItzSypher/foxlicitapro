import { describe, expect, it } from "vitest";
import { agruparOferta } from "./oferta";

describe("agruparOferta", () => {
  it("agrupa os termos do foco em ordem fixa", () => {
    const selos = agruparOferta([
      "material de escritório",
      "equipamentos de informática",
      "desenvolvimento de sistema",
      "redesign",
      "site institucional",
      "carimbos",
    ]);
    expect(selos).toEqual([
      { grupo: "Sites", termos: ["redesign", "site institucional"] },
      { grupo: "Sistemas", termos: ["desenvolvimento de sistema"] },
      { grupo: "Informática", termos: ["equipamentos de informática"] },
      { grupo: "Escritório", termos: ["material de escritório"] },
      { grupo: "Outros", termos: ["carimbos"] },
    ]);
  });

  it("devolve lista vazia sem foco", () => {
    expect(agruparOferta([])).toEqual([]);
  });
});
