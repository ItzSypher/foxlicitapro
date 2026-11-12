import { describe, expect, it } from "vitest";
import { MUNICIPIOS_BAIXADA, regiaoDe } from "./regioes";

describe("regiaoDe", () => {
  it("reconhece Nova Iguaçu", () => {
    expect(regiaoDe("3303500", "RJ")).toBe("nova-iguacu");
    expect(regiaoDe(3303500, "rj")).toBe("nova-iguacu");
  });

  it("reconhece a capital", () => {
    expect(regiaoDe("3304557", "RJ")).toBe("capital");
  });

  it("reconhece os 12 municípios da Baixada", () => {
    expect(Object.keys(MUNICIPIOS_BAIXADA)).toHaveLength(12);
    for (const codigo of Object.keys(MUNICIPIOS_BAIXADA)) {
      expect(regiaoDe(codigo, "RJ")).toBe("baixada");
    }
    expect(regiaoDe("3301702", "RJ")).toBe("baixada"); // Duque de Caxias
    expect(regiaoDe("3303609", "RJ")).toBe("baixada"); // Paracambi
  });

  it("classifica outros municípios do estado como rj", () => {
    expect(regiaoDe("3304755", "RJ")).toBe("rj"); // São Francisco de Itabapoana
  });

  it("classifica qualquer município de outro estado como fora-rj", () => {
    expect(regiaoDe("3550308", "SP")).toBe("fora-rj");
    expect(regiaoDe("3303500", "SP")).toBe("fora-rj");
  });
});
