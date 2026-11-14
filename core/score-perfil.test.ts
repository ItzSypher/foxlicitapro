import { describe, expect, it } from "vitest";
import { PERFIL_ORIGEM } from "./empresa";
import type { PerfilEmpresa } from "./perfil";
import { calcularScore } from "./score";
import type { Oportunidade } from "./types";

const AGORA = new Date("2026-11-10T12:00:00-03:00");

function oportunidade(parcial: Partial<Oportunidade> = {}): Oportunidade {
  return {
    id: "00000000000000-1-000001/2026",
    objeto: "Manutenção de computadores e impressoras",
    valorEstimado: 117118.11,
    orgao: "PREFEITURA DE NOVA IGUAÇU",
    orgaoCnpj: "00000000000000",
    unidade: "Secretaria",
    municipio: "Nova Iguaçu",
    codigoIbge: "3303500",
    uf: "RJ",
    regiao: "nova-iguacu",
    modalidadeId: 8,
    modalidadeNome: "Dispensa",
    dataAbertura: "2026-11-09T08:00:00-03:00",
    dataEncerramento: "2026-11-20T08:00:00-03:00",
    anoCompra: 2026,
    sequencialCompra: 1,
    linkPncp: "https://pncp.gov.br/app/editais/00000000000000/2026/1",
    linkOrigem: null,
    ...parcial,
  };
}

const EMPRESA_ME: PerfilEmpresa = { ...PERFIL_ORIGEM, id: "outra", porte: "me", dataAbertura: null };

describe("score com o perfil da empresa", () => {
  it("MEI mantém o teto anual e uma ME não tem teto", () => {
    const mei = calcularScore(oportunidade(), "servicos", AGORA, undefined, PERFIL_ORIGEM);
    const me = calcularScore(oportunidade(), "servicos", AGORA, undefined, EMPRESA_ME);
    const valorMei = mei.criterios.find((c) => c.id === "valor");
    const valorMe = me.criterios.find((c) => c.id === "valor");
    expect(valorMei).toBeDefined();
    expect(valorMe).toBeDefined();
    expect(valorMe?.pontos).toBeGreaterThanOrEqual(valorMei?.pontos ?? 0);
    expect(me.total).toBeGreaterThanOrEqual(mei.total);
  });

  it("sem perfil usa o da empresa de origem", () => {
    const o = oportunidade({ valorEstimado: 5000 });
    expect(calcularScore(o, "servicos", AGORA)).toEqual(calcularScore(o, "servicos", AGORA, undefined, PERFIL_ORIGEM));
  });

  it("serviço fora das regiões da empresa perde os pontos de local", () => {
    const soCapital: PerfilEmpresa = { ...EMPRESA_ME, regioes: ["capital"] };
    const o = oportunidade({ valorEstimado: 5000 });
    const local = calcularScore(o, "servicos", AGORA, undefined, soCapital).criterios.find((c) => c.id === "local");
    const origem = calcularScore(o, "servicos", AGORA, undefined, PERFIL_ORIGEM).criterios.find((c) => c.id === "local");
    expect(local?.pontos).toBe(0);
    expect(origem?.pontos).toBeGreaterThan(0);
  });

  it("empresa sem o CNAE da frente não casa o objeto", () => {
    const semCnae: PerfilEmpresa = { ...EMPRESA_ME, cnaes: [] };
    const s = calcularScore(oportunidade({ valorEstimado: 5000 }), "servicos", AGORA, undefined, semCnae);
    expect(s.frenteCasada).toBeNull();
    expect(s.cnaesCasados).toEqual([]);
  });
});
