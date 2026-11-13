import { describe, expect, it } from "vitest";
import {
  FUSO_PADRAO,
  calcularCota,
  intervaloDoDia,
  mensagemLimiteAtingido,
  podeMontar,
  textoRestantes,
} from "./limite-diario";

describe("intervalo do dia no fuso", () => {
  it("de madrugada em UTC ainda é o dia anterior em São Paulo", () => {
    const { inicio, fim } = intervaloDoDia(new Date("2026-11-13T02:30:00Z"), FUSO_PADRAO);
    expect(inicio.toISOString()).toBe("2026-11-12T03:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-11-13T03:00:00.000Z");
  });

  it("meia-noite local abre o dia novo", () => {
    const { inicio, fim } = intervaloDoDia(new Date("2026-11-13T03:00:00Z"), FUSO_PADRAO);
    expect(inicio.toISOString()).toBe("2026-11-13T03:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-11-14T03:00:00.000Z");
  });

  it("um minuto antes da meia-noite local ainda é o mesmo dia", () => {
    const { inicio, fim } = intervaloDoDia(new Date("2026-11-14T02:59:00Z"), FUSO_PADRAO);
    expect(inicio.toISOString()).toBe("2026-11-13T03:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-11-14T03:00:00.000Z");
  });

  it("respeita outro fuso injetado", () => {
    const { inicio, fim } = intervaloDoDia(new Date("2026-11-13T20:00:00Z"), "Asia/Tokyo");
    expect(inicio.toISOString()).toBe("2026-11-13T15:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-11-14T15:00:00.000Z");
  });

  it("vira o mês e o ano", () => {
    const { inicio, fim } = intervaloDoDia(new Date("2026-12-31T15:00:00Z"), FUSO_PADRAO);
    expect(inicio.toISOString()).toBe("2026-12-31T03:00:00.000Z");
    expect(fim.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });
});

describe("cota diária do assistente", () => {
  it("dono não tem limite", () => {
    const cota = calcularCota({ ehDono: true, limite: 3, usadas: 99 });
    expect(cota).toEqual({ ilimitada: true });
    expect(podeMontar(cota)).toBe(true);
    expect(textoRestantes(cota)).toBe("");
  });

  it("conta o que resta e bloqueia ao estourar", () => {
    const duas = calcularCota({ ehDono: false, limite: 3, usadas: 2 });
    expect(duas).toEqual({ ilimitada: false, limite: 3, usadas: 2, restantes: 1 });
    expect(podeMontar(duas)).toBe(true);
    expect(textoRestantes(duas)).toBe("Resta 1 hoje");

    const tres = calcularCota({ ehDono: false, limite: 3, usadas: 3 });
    expect(tres).toMatchObject({ restantes: 0 });
    expect(podeMontar(tres)).toBe(false);
    expect(calcularCota({ ehDono: false, limite: 3, usadas: 7 })).toMatchObject({ restantes: 0 });
    expect(textoRestantes(calcularCota({ ehDono: false, limite: 5, usadas: 1 }))).toBe("Restam 4 hoje");
  });

  it("limite zero impede qualquer proposta", () => {
    expect(podeMontar(calcularCota({ ehDono: false, limite: 0, usadas: 0 }))).toBe(false);
  });

  it("mensagem clara de limite", () => {
    expect(mensagemLimiteAtingido(3)).toBe("Você já criou 3 propostas com o assistente hoje. Tente amanhã.");
    expect(mensagemLimiteAtingido(1)).toBe("Você já criou 1 proposta com o assistente hoje. Tente amanhã.");
  });
});
