import { describe, expect, it } from "vitest";
import { formatarDataHoraBrasilia, montarLinhaDoTempo, textoFaltam, type DatasDoDetalhe } from "./datas-edital";

const AGORA = Date.parse("2026-11-13T12:00:00-03:00");

const datas: DatasDoDetalhe = {
  dataInclusao: "2026-11-05T09:20:03-03:00",
  dataPublicacao: "2026-11-05T09:20:03-03:00",
  dataAbertura: "2026-11-06T08:00:00-03:00",
  dataEncerramento: "2026-11-16T08:00:00-03:00",
  dataAtualizacao: "2026-11-10T10:15:00-03:00",
};

describe("formatarDataHoraBrasilia", () => {
  it("usa o horário de Brasília", () => {
    expect(formatarDataHoraBrasilia("2026-11-16T11:00:00Z")).toBe("16/11/2026 08:00");
    expect(formatarDataHoraBrasilia("2026-11-16T02:30:00Z")).toBe("15/11/2026 23:30");
  });

  it("data ausente ou inválida vira null", () => {
    expect(formatarDataHoraBrasilia(null)).toBeNull();
    expect(formatarDataHoraBrasilia("ontem")).toBeNull();
  });
});

describe("montarLinhaDoTempo", () => {
  it("ordena no tempo, marca o que já passou e a disputa", () => {
    const eventos = montarLinhaDoTempo(datas, AGORA);
    expect(eventos.map((e) => e.id)).toEqual(["publicacao", "inicio-propostas", "atualizacao", "fim-propostas"]);
    expect(eventos.map((e) => e.passou)).toEqual([true, true, true, false]);
    expect(eventos[3]).toMatchObject({ disputa: true, texto: "16/11/2026 08:00", rotulo: "Fim das propostas e disputa" });
  });

  it("omite a inclusão quando coincide com a divulgação e mostra quando difere", () => {
    expect(montarLinhaDoTempo(datas, AGORA).some((e) => e.id === "inclusao")).toBe(false);
    const diferente = montarLinhaDoTempo({ ...datas, dataInclusao: "2026-11-04T15:00:00-03:00" }, AGORA);
    expect(diferente[0]).toMatchObject({ id: "inclusao", texto: "04/11/2026 15:00" });
  });

  it("sem dado não mostra a linha", () => {
    const eventos = montarLinhaDoTempo(
      { dataInclusao: null, dataPublicacao: null, dataAbertura: "lixo", dataEncerramento: datas.dataEncerramento, dataAtualizacao: null },
      AGORA,
    );
    expect(eventos.map((e) => e.id)).toEqual(["fim-propostas"]);
    const vazio = { dataInclusao: null, dataPublicacao: null, dataAbertura: null, dataEncerramento: null, dataAtualizacao: null };
    expect(montarLinhaDoTempo(vazio, AGORA)).toEqual([]);
  });

  it("o relógio injetado muda o que já passou", () => {
    const depois = montarLinhaDoTempo(datas, Date.parse("2026-11-17T00:00:00-03:00"));
    expect(depois.every((e) => e.passou)).toBe(true);
  });
});

describe("textoFaltam", () => {
  const alvo = "2026-11-16T08:00:00-03:00";

  it("dias e horas", () => {
    expect(textoFaltam(alvo, Date.parse("2026-11-13T04:00:00-03:00"))).toBe("faltam 3 dias e 4 h");
    expect(textoFaltam(alvo, Date.parse("2026-11-13T08:00:00-03:00"))).toBe("faltam 3 dias");
    expect(textoFaltam(alvo, Date.parse("2026-11-15T07:00:00-03:00"))).toBe("falta 1 dia e 1 h");
  });

  it("horas e minutos abaixo de 24 horas", () => {
    expect(textoFaltam(alvo, Date.parse("2026-11-16T02:48:00-03:00"))).toBe("faltam 5 h e 12 min");
    expect(textoFaltam(alvo, Date.parse("2026-11-16T07:00:00-03:00"))).toBe("falta 1 h");
    expect(textoFaltam(alvo, Date.parse("2026-11-16T07:20:00-03:00"))).toBe("faltam 40 min");
    expect(textoFaltam(alvo, Date.parse("2026-11-16T07:59:30-03:00"))).toBe("falta 1 min");
  });

  it("encerrado depois do prazo e nulo para data inválida", () => {
    expect(textoFaltam(alvo, Date.parse("2026-11-16T08:00:00-03:00"))).toBe("encerrado");
    expect(textoFaltam(alvo, Date.parse("2026-11-20T08:00:00-03:00"))).toBe("encerrado");
    expect(textoFaltam("x", AGORA)).toBeNull();
  });
});
