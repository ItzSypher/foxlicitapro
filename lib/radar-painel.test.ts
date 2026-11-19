import { describe, expect, it } from "vitest";
import type { Faixa, OportunidadeComScore } from "@/core/types";
import { filtrarEOrdenar, FILTROS_PADRAO } from "./radar-filtros";
import { calcularPainel, formatarValorCompacto, inicioDoDiaBrasilia } from "./radar-painel";

// Sábado, 14/11/2026, 12:00 em Brasília.
const AGORA = Date.parse("2026-11-14T12:00:00-03:00");
const HORA = 3_600_000;

function oportunidade(
  n: number,
  extra: Partial<OportunidadeComScore> & { faixa?: Faixa; horasParaFechar?: number } = {},
): OportunidadeComScore {
  const { faixa = "atencao", horasParaFechar = 24 * 20, ...resto } = extra;
  return {
    id: `id-${n}`,
    objeto: `Objeto ${n}`,
    valorEstimado: 1000,
    orgao: "Órgão",
    orgaoCnpj: "00000000000000",
    unidade: "",
    municipio: "Rio de Janeiro",
    codigoIbge: "3304557",
    uf: "RJ",
    regiao: "capital",
    modalidadeId: 8,
    modalidadeNome: "Dispensa",
    dataAbertura: null,
    dataEncerramento: new Date(AGORA + horasParaFechar * HORA).toISOString(),
    anoCompra: 2026,
    sequencialCompra: n,
    linkPncp: "",
    linkOrigem: null,
    score: { total: 50, faixa, criterios: [], cnaesCasados: [], frenteCasada: "servicos" },
    ...resto,
  };
}

describe("inicioDoDiaBrasilia", () => {
  it("devolve a meia-noite de Brasília do dia que contém o instante", () => {
    expect(inicioDoDiaBrasilia(AGORA)).toBe(Date.parse("2026-11-14T00:00:00-03:00"));
    expect(inicioDoDiaBrasilia(Date.parse("2026-11-14T23:59:00-03:00"))).toBe(Date.parse("2026-11-14T00:00:00-03:00"));
    expect(inicioDoDiaBrasilia(Date.parse("2026-11-15T00:00:00-03:00"))).toBe(Date.parse("2026-11-15T00:00:00-03:00"));
  });
});

describe("calcularPainel", () => {
  it("conta novas por publicação: 24 h, hoje e ontem", () => {
    const painel = calcularPainel(
      [
        oportunidade(1, { dataPublicacao: "2026-11-14T09:00:00-03:00" }), // hoje
        oportunidade(2, { dataPublicacao: "2026-11-13T15:00:00-03:00" }), // ontem, dentro das 24 h
        oportunidade(3, { dataPublicacao: "2026-11-13T08:00:00-03:00" }), // ontem, fora das 24 h
        oportunidade(4, { dataPublicacao: "2026-11-10T08:00:00-03:00" }), // antiga
        oportunidade(5), // sem data
      ],
      AGORA,
    );
    expect(painel.temPublicacao).toBe(true);
    expect(painel.novasHoje).toBe(1);
    expect(painel.novas24h).toBe(2);
    expect(painel.novasOntem).toBe(2);
    expect(painel.abertas).toBe(5);
  });

  it("sem nenhuma data de publicação, avisa e não conta novas", () => {
    const painel = calcularPainel([oportunidade(1), oportunidade(2)], AGORA);
    expect(painel.temPublicacao).toBe(false);
    expect(painel.novas24h).toBe(0);
  });

  it("separa as que fecham em 48 h e na semana; ignora as já encerradas", () => {
    const painel = calcularPainel(
      [
        oportunidade(1, { horasParaFechar: 5 }),
        oportunidade(2, { horasParaFechar: 47 }),
        oportunidade(3, { horasParaFechar: 49 }),
        oportunidade(4, { horasParaFechar: 24 * 6 }),
        oportunidade(5, { horasParaFechar: 24 * 8 }),
        oportunidade(6, { horasParaFechar: -2 }),
      ],
      AGORA,
    );
    expect(painel.abertas).toBe(5);
    expect(painel.encerram48h).toBe(2);
    expect(painel.encerramSemana).toBe(4);
  });

  it("conta sinal alto e soma só os valores informados", () => {
    const painel = calcularPainel(
      [
        oportunidade(1, { faixa: "go", valorEstimado: 1_500_000 }),
        oportunidade(2, { faixa: "go", valorEstimado: null }),
        oportunidade(3, { faixa: "nogo", valorEstimado: 250_000 }),
      ],
      AGORA,
    );
    expect(painel.sinalAlto).toBe(2);
    expect(painel.valorTotal).toBe(1_750_000);
    expect(painel.semValor).toBe(1);
  });

  it("lista vazia zera tudo", () => {
    const painel = calcularPainel([], AGORA);
    expect(painel).toMatchObject({ abertas: 0, novas24h: 0, encerram48h: 0, sinalAlto: 0, valorTotal: 0, pipeline: null });
  });
});

describe("formatarValorCompacto", () => {
  it("abrevia em mil, milhão e bilhão", () => {
    expect(formatarValorCompacto(950)).toBe("R$ 950");
    expect(formatarValorCompacto(340_400)).toBe("R$ 340 mil");
    expect(formatarValorCompacto(12_440_000)).toBe("R$ 12,4 mi");
    expect(formatarValorCompacto(1_200_000_000)).toBe("R$ 1,2 bi");
  });
});

describe("ordem mais recentes", () => {
  it("põe a publicação mais nova primeiro e as sem data por último", () => {
    const lista = [
      oportunidade(1),
      oportunidade(2, { dataPublicacao: "2026-11-10T08:00:00-03:00" }),
      oportunidade(3, { dataPublicacao: "2026-11-14T08:00:00-03:00" }),
    ];
    const ordenada = filtrarEOrdenar(lista, { ...FILTROS_PADRAO, ordem: "recentes" });
    expect(ordenada.map((o) => o.id)).toEqual(["id-3", "id-2", "id-1"]);
  });
});

describe("filtro de UF", () => {
  it("pega só as UFs marcadas", () => {
    const lista = [oportunidade(1, { uf: "MG" }), oportunidade(2), oportunidade(3, { uf: "ES" })];
    expect(filtrarEOrdenar(lista, { ...FILTROS_PADRAO, ufs: ["MG", "ES"] }).map((o) => o.id).sort()).toEqual(["id-1", "id-3"]);
  });
});
