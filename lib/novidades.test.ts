import { describe, expect, it } from "vitest";
import {
  NOVIDADES,
  VERSAO_NOVIDADES,
  chaveNovidadesVistas,
  chaveProgressoTour,
  jaViuNovidades,
  passoSalvo,
  passosDoTour,
  podeFazerTour,
} from "@/lib/novidades";

describe("jaViuNovidades", () => {
  it("é falso sem nada guardado", () => {
    expect(jaViuNovidades(null)).toBe(false);
  });
  it("é verdadeiro só para a versão atual", () => {
    expect(jaViuNovidades(VERSAO_NOVIDADES)).toBe(true);
    expect(jaViuNovidades("2026-01-01")).toBe(false);
    expect(jaViuNovidades("2026-02-02", "2026-02-02")).toBe(true);
  });
});

describe("chaves por usuário", () => {
  it("separa pessoas diferentes", () => {
    expect(chaveNovidadesVistas("a")).not.toBe(chaveNovidadesVistas("b"));
    expect(chaveProgressoTour("a")).not.toBe(chaveNovidadesVistas("a"));
  });
});

describe("podeFazerTour", () => {
  it("libera dono e gestor", () => {
    expect(podeFazerTour("dono")).toBe(true);
    expect(podeFazerTour("gestor")).toBe(true);
    expect(podeFazerTour("juridico")).toBe(false);
  });
});

describe("passoSalvo", () => {
  it("volta ao início com valor ausente ou inválido", () => {
    expect(passoSalvo(null, 11)).toBe(0);
    expect(passoSalvo("abc", 11)).toBe(0);
    expect(passoSalvo("-2", 11)).toBe(0);
  });
  it("mantém um passo do meio e volta ao início no passo final", () => {
    expect(passoSalvo("4", 11)).toBe(4);
    expect(passoSalvo("10", 11)).toBe(0);
    expect(passoSalvo("99", 11)).toBe(0);
  });
});

describe("passosDoTour", () => {
  it("tem boas-vindas, uma novidade por passo e o fim", () => {
    const passos = passosDoTour("dono");
    expect(passos).toHaveLength(NOVIDADES.length + 2);
    expect(passos[0].tipo).toBe("inicio");
    expect(passos[passos.length - 1].tipo).toBe("fim");
  });
  it("gestor vai direto às Preferências no passo de equipe", () => {
    const passo = passosDoTour("gestor").find((p) => p.id === "equipe-preferencias");
    expect(passo?.href).toBe("/preferencias");
    expect(passo?.extra).toBeUndefined();
  });
});
