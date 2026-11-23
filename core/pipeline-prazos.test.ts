import { describe, expect, it } from "vitest";
import {
  agruparPorPrazo,
  grupoDoPrazo,
  horaDoPrazo,
  ordenarPorPrazo,
  pendentesDeProposta,
} from "@/core/pipeline-prazos";

// 16/11/2026 12:00 em São Paulo (UTC-3)
const AGORA = new Date("2026-11-16T15:00:00Z");

function item(id: string, fim: string, etapa = "radar", valorProposto: number | null = null) {
  return { id, etapa, valorProposto, item: { dataEncerramento: fim } };
}

describe("grupoDoPrazo", () => {
  it("separa pelo dia civil de São Paulo", () => {
    expect(grupoDoPrazo("2026-11-16T14:00:00Z", AGORA)).toBe("encerrada");
    expect(grupoDoPrazo("2026-11-16T15:00:00Z", AGORA)).toBe("hoje");
    expect(grupoDoPrazo("2026-11-17T02:59:00Z", AGORA)).toBe("hoje"); // 23h59 de hoje em SP
    expect(grupoDoPrazo("2026-11-17T03:00:00Z", AGORA)).toBe("amanha"); // 0h de amanhã em SP
    expect(grupoDoPrazo("2026-11-18T02:59:00Z", AGORA)).toBe("amanha");
    expect(grupoDoPrazo("2026-11-18T03:00:00Z", AGORA)).toBe("semana");
    expect(grupoDoPrazo("2026-11-23T20:00:00Z", AGORA)).toBe("semana"); // 7 dias à frente
    expect(grupoDoPrazo("2026-11-24T03:00:00Z", AGORA)).toBe("depois"); // 8 dias
  });

  it("usa o dia de São Paulo mesmo quando o UTC já virou", () => {
    const noite = new Date("2026-11-16T23:30:00Z"); // 20h30 em SP
    expect(grupoDoPrazo("2026-11-17T01:00:00Z", noite)).toBe("hoje"); // 22h em SP, ainda dia 16
    expect(grupoDoPrazo("2026-11-17T12:00:00Z", noite)).toBe("amanha");
  });

  it("aceita agora em milissegundos e trata data inválida como depois", () => {
    expect(grupoDoPrazo("2026-11-16T20:00:00Z", AGORA.getTime())).toBe("hoje");
    expect(grupoDoPrazo("sem data", AGORA)).toBe("depois");
  });
});

describe("horaDoPrazo", () => {
  it("mostra a hora de São Paulo", () => {
    expect(horaDoPrazo("2026-11-16T17:30:00Z")).toBe("14:30");
    expect(horaDoPrazo("nada")).toBe("");
  });
});

describe("ordenarPorPrazo", () => {
  it("põe o mais próximo primeiro e as encerradas no fim, sem alterar o original", () => {
    const lista = [
      item("depois", "2026-12-01T15:00:00Z"),
      item("velha", "2026-11-10T15:00:00Z"),
      item("hoje", "2026-11-16T20:00:00Z"),
      item("recente", "2026-11-16T10:00:00Z"),
      item("amanha", "2026-11-17T15:00:00Z"),
    ];
    const copia = [...lista];
    expect(ordenarPorPrazo(lista, AGORA).map((i) => i.id)).toEqual(["hoje", "amanha", "depois", "recente", "velha"]);
    expect(lista).toEqual(copia);
  });
});

describe("pendentesDeProposta", () => {
  it("lista só o que fecha hoje ou amanhã, sem proposta, em etapa anterior à disputa", () => {
    const lista = [
      item("a", "2026-11-17T15:00:00Z", "cotando"),
      item("b", "2026-11-16T20:00:00Z", "radar"),
      item("c", "2026-11-16T20:00:00Z", "proposta", 1000),
      item("d", "2026-11-16T20:00:00Z", "disputa"),
      item("e", "2026-11-19T20:00:00Z", "radar"),
      item("f", "2026-11-16T13:00:00Z", "radar"),
      item("g", "2026-11-16T22:00:00Z", "revisao_juridica"),
    ];
    expect(pendentesDeProposta(lista, AGORA).map((i) => i.id)).toEqual(["b", "g", "a"]);
  });

  it("devolve vazio quando não há pendência", () => {
    expect(pendentesDeProposta([], AGORA)).toEqual([]);
  });
});

describe("agruparPorPrazo", () => {
  it("agrupa na ordem hoje, amanhã, semana, depois, encerradas e omite os vazios", () => {
    const lista = [
      item("e", "2026-11-10T15:00:00Z"),
      item("d", "2026-12-20T15:00:00Z"),
      item("h", "2026-11-16T20:00:00Z"),
    ];
    const grupos = agruparPorPrazo(lista, AGORA);
    expect(grupos.map((g) => g.grupo)).toEqual(["hoje", "depois", "encerrada"]);
    expect(grupos[0].itens.map((i) => i.id)).toEqual(["h"]);
  });
});
