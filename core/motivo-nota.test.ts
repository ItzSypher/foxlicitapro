import { describe, expect, it } from "vitest";
import { motivoPrincipal } from "./motivo-nota";
import { normalizarFoco } from "./perfil";
import type { Criterio, Score } from "./types";

function criterio(id: Criterio["id"], rotulo: string, pontos: number, maximo: number): Criterio {
  return { id, rotulo, pontos, maximo, motivo: `motivo ${id}`, aConfirmar: false };
}

const BASE: Score = { total: 50, faixa: "atencao", criterios: [], cnaesCasados: [], frenteCasada: null };

describe("motivoPrincipal", () => {
  it("o foco vem primeiro", () => {
    expect(motivoPrincipal({ ...BASE, foco: "site institucional" })).toBe("Bate com o seu foco: site institucional");
  });
  it("sem foco, o critério com mais pontos perdidos", () => {
    const criterios = [criterio("cnae", "Atividade (CNAE)", 30, 30), criterio("modalidade", "Modalidade", 10, 25), criterio("local", "Local", 16, 20)];
    expect(motivoPrincipal({ ...BASE, criterios })).toBe("Modalidade: motivo modalidade");
  });
  it("nota cheia não tem motivo", () => {
    expect(motivoPrincipal({ ...BASE, criterios: [criterio("cnae", "Atividade (CNAE)", 30, 30)] })).toBeNull();
  });
});

describe("normalizarFoco", () => {
  it("limpa espaços, vazios e repetidos", () => {
    expect(normalizarFoco(["  site   institucional ", "Site Institucional", "", "redesign"])).toEqual(["site institucional", "redesign"]);
  });
  it("respeita 20 termos de 60 caracteres", () => {
    const muitos = Array.from({ length: 30 }, (_, i) => `termo ${i}`);
    expect(normalizarFoco(muitos)).toHaveLength(20);
    expect(normalizarFoco(["a".repeat(100)])[0]).toHaveLength(60);
  });
});
