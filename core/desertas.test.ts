import { describe, expect, it } from "vitest";
import type { CnaePerfil } from "./perfil";
import {
  casaComRamo,
  deduplicarDesertas,
  desertasDoRamo,
  desertasParaMostrar,
  diasParaVarrer,
  diaPncp,
  montarDeserta,
  semReabertura,
  somarDias,
  tipoSemVencedor,
  type Deserta,
  type ItemSituacao,
} from "./desertas";
import type { ContratacaoPncp } from "./pncp/schema";

const AGORA = new Date("2026-11-18T12:00:00-03:00");

const COMPRA: ContratacaoPncp = {
  numeroControlePNCP: "11111111000111-1-000010/2026",
  objetoCompra: "Montagem e desmontagem de baias para feira",
  valorTotalEstimado: 60000,
  orgaoEntidade: { cnpj: "11111111000111", razaoSocial: "Prefeitura de Teste" },
  unidadeOrgao: { ufSigla: "rj", municipioNome: "Nova Iguaçu", codigoIbge: 3303500, nomeUnidade: "Secretaria" },
  modalidadeId: 8,
  modalidadeNome: "Dispensa",
  dataAberturaProposta: "2026-09-15T08:00:00",
  dataPublicacaoPncp: "2026-09-15T08:00:00",
  dataEncerramentoProposta: "2026-09-18T18:00:00",
  anoCompra: 2026,
  sequencialCompra: 10,
};

function item(numero: number, situacaoId: number, extra: Partial<ItemSituacao> = {}): ItemSituacao {
  return {
    numero,
    descricao: `Item ${numero}`,
    situacaoId,
    situacaoNome: null,
    valorTotal: 1000,
    atualizadoEm: "2026-09-15T09:05:46",
    ...extra,
  };
}

describe("tipoSemVencedor", () => {
  it("lê o código do PNCP", () => {
    expect(tipoSemVencedor({ situacaoId: 4, situacaoNome: "Deserto" })).toBe("deserto");
    expect(tipoSemVencedor({ situacaoId: 5, situacaoNome: "Fracassado" })).toBe("fracassado");
    expect(tipoSemVencedor({ situacaoId: 2, situacaoNome: "Homologado" })).toBeNull();
    expect(tipoSemVencedor({ situacaoId: 3, situacaoNome: "Anulado/Revogado/Cancelado" })).toBeNull();
    expect(tipoSemVencedor({ situacaoId: 1, situacaoNome: "Em andamento" })).toBeNull();
  });

  it("cai no nome quando o código não veio", () => {
    expect(tipoSemVencedor({ situacaoId: null, situacaoNome: "Deserto" })).toBe("deserto");
    expect(tipoSemVencedor({ situacaoId: null, situacaoNome: "fracassado" })).toBe("fracassado");
    expect(tipoSemVencedor({ situacaoId: null, situacaoNome: null })).toBeNull();
  });
});

describe("montarDeserta", () => {
  it("soma os itens sem vencedor e guarda a descrição deles", () => {
    const d = montarDeserta(COMPRA, [item(1, 4, { valorTotal: 54696 }), item(2, 2), item(3, 5, { valorTotal: 304 })], AGORA);
    expect(d).not.toBeNull();
    expect(d?.itensSemVencedor).toBe(2);
    expect(d?.totalItens).toBe(3);
    expect(d?.situacao).toBe("mista");
    expect(d?.valorEstimado).toBe(55000);
    expect(d?.objeto).toContain("itens sem vencedor");
    expect(d?.uf).toBe("RJ");
    expect(d?.linkPncp).toBe("https://pncp.gov.br/app/editais/11111111000111/2026/10");
  });

  it("fica sem valor quando algum item sem vencedor não tem valor", () => {
    const d = montarDeserta(COMPRA, [item(1, 4, { valorTotal: null })], AGORA);
    expect(d?.valorEstimado).toBeNull();
    expect(d?.situacao).toBe("deserta");
  });

  it("a data é a mais tarde entre encerramento e atualização do item, nunca no futuro", () => {
    const antes = montarDeserta(COMPRA, [item(1, 4, { atualizadoEm: "2026-09-15T09:05:46" })], AGORA);
    expect(antes?.desertaEm).toBe("2026-09-18T18:00:00-03:00");
    const depois = montarDeserta(COMPRA, [item(1, 5, { atualizadoEm: "2026-09-25T10:00:00" })], AGORA);
    expect(depois?.desertaEm).toBe("2026-09-25T10:00:00-03:00");
    const futuro = montarDeserta(COMPRA, [item(1, 5, { atualizadoEm: "2027-01-01T10:00:00" })], AGORA);
    expect(futuro?.desertaEm).toBe(AGORA.toISOString());
  });

  it("não vale sem item sem vencedor ou com a compra ainda aberta", () => {
    expect(montarDeserta(COMPRA, [item(1, 2), item(2, 1)], AGORA)).toBeNull();
    expect(montarDeserta({ ...COMPRA, dataEncerramentoProposta: "2026-11-30T18:00:00" }, [item(1, 4)], AGORA)).toBeNull();
    expect(montarDeserta({ ...COMPRA, dataEncerramentoProposta: null }, [item(1, 4)], AGORA)).toBeNull();
  });
});

const CNAES: CnaePerfil[] = [{ codigo: "43.21-5-00", descricao: "Instalação e manutenção elétrica", frente: "servicos", principal: true }];

describe("ramo", () => {
  it("casa o texto com os CNAEs da empresa", () => {
    expect(casaComRamo("Manutenção de instalação elétrica predial", CNAES)).toBe(true);
    expect(casaComRamo("Aquisição de pneus para ambulância", CNAES)).toBe(false);
    expect(casaComRamo("Manutenção de instalação elétrica predial", [])).toBe(false);
  });

  it("desertasDoRamo tira as velhas e as fora do ramo e ordena pela mais recente", () => {
    const base = montarDeserta(COMPRA, [item(1, 4)], AGORA) as Deserta;
    const nova: Deserta = { ...base, id: "N", objeto: "Manutenção de instalação elétrica predial", desertaEm: "2026-11-10T10:00:00-03:00" };
    const mais: Deserta = { ...nova, id: "M", desertaEm: "2026-11-15T10:00:00-03:00" };
    const velha: Deserta = { ...nova, id: "V", desertaEm: "2026-08-01T10:00:00-03:00" };
    const fora: Deserta = { ...nova, id: "F", objeto: "Aquisição de pneus", desertaEm: "2026-11-12T10:00:00-03:00" };
    expect(desertasDoRamo([nova, velha, fora, mais], CNAES, AGORA).map((d) => d.id)).toEqual(["M", "N"]);
  });
});

describe("repetidas e reabertas", () => {
  const base = montarDeserta(COMPRA, [item(1, 4)], AGORA) as Deserta;
  const objeto = "Contratação de empresa para desenvolvimento de site institucional";
  const antiga: Deserta = { ...base, id: "A", objeto, desertaEm: "2026-10-01T10:00:00-03:00" };
  const nova: Deserta = { ...base, id: "B", objeto: objeto.toUpperCase(), desertaEm: "2026-11-05T10:00:00-03:00" };
  const outroOrgao: Deserta = { ...nova, id: "C", orgaoCnpj: "22222222000122" };
  const outroObjeto: Deserta = { ...nova, id: "D", objeto: "Aquisição de notebooks" };

  it("mesmo órgão e mesmo objeto viram um cartão, o da mais recente", () => {
    expect(deduplicarDesertas([antiga, nova]).map((d) => d.id)).toEqual(["B"]);
    expect(deduplicarDesertas([nova, antiga]).map((d) => d.id)).toEqual(["B"]);
  });

  it("órgão ou objeto diferente continua separado e a ordem é mantida", () => {
    expect(deduplicarDesertas([nova, outroOrgao, outroObjeto, antiga]).map((d) => d.id)).toEqual(["B", "C", "D"]);
  });

  it("some a deserta cujo órgão já abriu a compra de novo", () => {
    const aberta = { orgaoCnpj: base.orgaoCnpj, objeto: "Contratação de empresa para o desenvolvimento de site institucional" };
    expect(semReabertura([nova, outroObjeto], [aberta]).map((d) => d.id)).toEqual(["D"]);
  });

  it("licitação aberta de outro órgão ou de outro assunto não esconde a deserta", () => {
    const deOutroOrgao = { orgaoCnpj: "22222222000122", objeto };
    const deOutroAssunto = { orgaoCnpj: base.orgaoCnpj, objeto: "Aquisição de merenda escolar" };
    expect(semReabertura([nova], [deOutroOrgao, deOutroAssunto])).toEqual([nova]);
  });

  it("a descrição dos itens não atrapalha o casamento com a reabertura", () => {
    const comItens: Deserta = { ...nova, objeto: `${objeto} — itens sem vencedor: Item 1; Item 2` };
    expect(semReabertura([comItens], [{ orgaoCnpj: base.orgaoCnpj, objeto }])).toEqual([]);
  });

  it("desertasParaMostrar junta as duas regras", () => {
    const aberta = { orgaoCnpj: base.orgaoCnpj, objeto: "Aquisição de notebooks" };
    expect(desertasParaMostrar([antiga, nova, outroOrgao, outroObjeto], [aberta]).map((d) => d.id)).toEqual(["B", "C"]);
  });
});

describe("dias", () => {
  it("soma dias atravessando mês e ano", () => {
    expect(somarDias("20261230", 3)).toBe("20270102");
    expect(somarDias("20260301", -1)).toBe("20260228");
  });

  it("diaPncp usa o dia de Brasília", () => {
    expect(diaPncp(new Date("2026-11-18T02:00:00Z"), 0)).toBe("20261117");
    expect(diaPncp(AGORA, -3)).toBe("20261115");
  });

  it("varre do dia seguinte ao último olhado até o limite, no máximo N dias", () => {
    expect(diasParaVarrer("20261110", "20261115", "20261101", 3)).toEqual(["20261111", "20261112", "20261113"]);
    expect(diasParaVarrer("20261114", "20261115", "20261101", 5)).toEqual(["20261115"]);
    expect(diasParaVarrer("20261115", "20261115", "20261101", 5)).toEqual([]);
    expect(diasParaVarrer(null, "20261103", "20261101", 5)).toEqual(["20261101", "20261102", "20261103"]);
  });
});
