import { describe, expect, it } from "vitest";
import {
  ehEncerrado,
  frasePrazoEncerrado,
  maisRecentesPrimeiro,
  separarEncerrados,
  textoEncerrou,
} from "@/core/encerradas";

const AGORA = Date.parse("2026-11-16T12:00:00Z");
const PASSADO = "2026-11-10T12:00:00Z";
const FUTURO = "2026-11-20T12:00:00Z";

describe("ehEncerrado", () => {
  it.each(["radar", "analisando", "cotando", "revisao_juridica", "proposta"])(
    "prazo vencido em %s encerra",
    (etapa) => {
      expect(ehEncerrado(etapa, PASSADO, AGORA)).toBe(true);
    },
  );

  it.each(["disputa", "ganha", "perdida"])("prazo vencido em %s nunca encerra", (etapa) => {
    expect(ehEncerrado(etapa, PASSADO, AGORA)).toBe(false);
  });

  it("prazo no futuro não encerra", () => {
    expect(ehEncerrado("radar", FUTURO, AGORA)).toBe(false);
  });

  it("no instante exato do prazo ainda não encerrou", () => {
    expect(ehEncerrado("radar", "2026-11-16T12:00:00Z", AGORA)).toBe(false);
    expect(ehEncerrado("radar", "2026-11-16T11:59:59Z", AGORA)).toBe(true);
  });

  it("sem data ou data inválida não encerra", () => {
    expect(ehEncerrado("radar", null, AGORA)).toBe(false);
    expect(ehEncerrado("radar", undefined, AGORA)).toBe(false);
    expect(ehEncerrado("radar", "", AGORA)).toBe(false);
    expect(ehEncerrado("radar", "não é data", AGORA)).toBe(false);
  });

  it("aceita Date como instante atual", () => {
    expect(ehEncerrado("proposta", PASSADO, new Date(AGORA))).toBe(true);
  });
});

describe("separarEncerrados", () => {
  it("divide mantendo a ordem", () => {
    const itens = [
      { id: "a", etapa: "radar", fim: PASSADO },
      { id: "b", etapa: "disputa", fim: PASSADO },
      { id: "c", etapa: "cotando", fim: FUTURO },
      { id: "d", etapa: "proposta", fim: PASSADO },
    ];
    const { abertos, encerrados } = separarEncerrados(
      itens,
      (i) => ({ etapa: i.etapa, dataEncerramento: i.fim }),
      AGORA,
    );
    expect(abertos.map((i) => i.id)).toEqual(["b", "c"]);
    expect(encerrados.map((i) => i.id)).toEqual(["a", "d"]);
  });
});

describe("maisRecentesPrimeiro", () => {
  it("ordena pelo encerramento mais próximo de agora e não muda a entrada", () => {
    const itens = [
      { id: "velho", fim: "2026-10-01T00:00:00Z" },
      { id: "novo", fim: "2026-11-15T00:00:00Z" },
      { id: "meio", fim: "2026-11-01T00:00:00Z" },
    ];
    expect(maisRecentesPrimeiro(itens, (i) => i.fim).map((i) => i.id)).toEqual(["novo", "meio", "velho"]);
    expect(itens[0]?.id).toBe("velho");
  });
});

describe("textoEncerrou", () => {
  it("usa dias, horas e pouco tempo", () => {
    expect(textoEncerrou("2026-11-13T12:00:00Z", AGORA)).toBe("encerrou há 3 dias");
    expect(textoEncerrou("2026-11-15T12:00:00Z", AGORA)).toBe("encerrou há 1 dia");
    expect(textoEncerrou("2026-11-16T07:00:00Z", AGORA)).toBe("encerrou há 5 h");
    expect(textoEncerrou("2026-11-16T11:30:00Z", AGORA)).toBe("encerrou há pouco");
  });
});

describe("frasePrazoEncerrado", () => {
  it("concorda no singular e no plural", () => {
    expect(frasePrazoEncerrado(1)).toBe("1 licitação encerrou o prazo.");
    expect(frasePrazoEncerrado(4)).toBe("4 licitações encerraram o prazo.");
  });
});
