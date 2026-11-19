import { describe, expect, it } from "vitest";
import {
  dataHoraCurta,
  dataHoraRelativa,
  rotuloStatusAviso,
  rotuloTipoAviso,
  situacaoDaConversa,
  textoUltimoResumo,
} from "@/core/whatsapp-situacao";

// 19/11/2026 10:00 em São Paulo (UTC-3)
const AGORA = new Date("2026-11-19T13:00:00Z");
const HORA = 3_600_000;
const MIN = 60_000;

describe("dataHoraCurta", () => {
  it("usa o horário de São Paulo", () => {
    expect(dataHoraCurta(new Date("2026-11-19T12:02:00Z"))).toBe("19/11 09:02");
  });
});

describe("textoUltimoResumo", () => {
  it("hoje", () => {
    expect(textoUltimoResumo("2026-11-19T10:00:30Z", AGORA)).toBe("Último resumo: hoje 07:00");
  });
  it("ontem", () => {
    expect(textoUltimoResumo("2026-11-18T10:00:30Z", AGORA)).toBe("Último resumo: ontem 07:00");
  });
  it("data mais antiga", () => {
    expect(textoUltimoResumo("2026-11-15T10:00:30Z", AGORA)).toBe("Último resumo: 15/11 07:00");
  });
  it("nunca, sem registro ou com data inválida", () => {
    expect(textoUltimoResumo(null, AGORA)).toBe("Último resumo: nunca");
    expect(textoUltimoResumo("lixo", AGORA)).toBe("Último resumo: nunca");
  });
  it("virada de dia pelo fuso: 02h UTC ainda é o dia anterior em São Paulo", () => {
    expect(dataHoraRelativa(new Date("2026-11-19T02:30:00Z"), AGORA)).toBe("ontem 23:30");
  });
});

describe("situacaoDaConversa", () => {
  it("aberta até 23h30 depois da última mensagem", () => {
    const entrada = new Date(AGORA.getTime() - 2 * HORA); // 08:00
    expect(situacaoDaConversa(entrada, AGORA)).toEqual({ aberta: true, texto: "Aberta até 20/11 07:30" });
  });
  it("fechada desde o instante em que a janela acabou", () => {
    const entrada = new Date(AGORA.getTime() - (25 * HORA + 2 * MIN)); // 18/11 08:58
    expect(situacaoDaConversa(entrada, AGORA)).toEqual({ aberta: false, texto: "Fechada desde 19/11 08:28" });
  });
  it("sem mensagem nenhuma, fechada", () => {
    expect(situacaoDaConversa(null, AGORA)).toEqual({ aberta: false, texto: "Fechada: ainda não mandou mensagem" });
  });
});

describe("rótulos", () => {
  it("tipo legível, com padrão para tipo desconhecido", () => {
    expect(rotuloTipoAviso("prazo2")).toBe("Prazo em 2 h");
    expect(rotuloTipoAviso("prazo24")).toBe("Prazo em 24 h");
    expect(rotuloTipoAviso("aviso")).toBe("Aviso");
    expect(rotuloTipoAviso("xyz")).toBe("Aviso");
  });
  it("status legível", () => {
    expect(rotuloStatusAviso("enviado")).toBe("Enviado");
    expect(rotuloStatusAviso("descartado")).toBe("Descartado");
    expect(rotuloStatusAviso("pendente")).toBe("Na fila");
  });
});
