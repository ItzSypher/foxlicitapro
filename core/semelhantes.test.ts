import { describe, expect, it } from "vitest";
import { acharSemelhantes, similaridade, termosDoObjeto } from "./semelhantes";
import type { Oportunidade } from "./types";

function op(id: string, objeto: string, orgaoCnpj: string, encerramento = "2026-12-01T10:00:00-03:00"): Oportunidade {
  return {
    id,
    objeto,
    valorEstimado: 1000,
    orgao: `Órgão ${orgaoCnpj}`,
    orgaoCnpj,
    unidade: "",
    municipio: "Nova Iguaçu",
    codigoIbge: "3303500",
    uf: "RJ",
    regiao: "rj",
    modalidadeId: 8,
    modalidadeNome: "Dispensa",
    dataAbertura: null,
    dataEncerramento: encerramento,
    anoCompra: 2026,
    sequencialCompra: 1,
    linkPncp: "https://pncp.gov.br",
    linkOrigem: null,
  };
}

describe("termosDoObjeto", () => {
  it("tira acento, caixa, números soltos e palavras de ligação", () => {
    const t = termosDoObjeto("Aquisição de Cadeiras ergonômicas para as escolas, 120 unidades");
    expect(t.has("cadeira")).toBe(true);
    expect(t.has("ergonomica")).toBe(true);
    expect(t.has("escola")).toBe(true);
    expect(t.has("de")).toBe(false);
    expect(t.has("aquisicao")).toBe(false);
    expect(t.has("120")).toBe(false);
  });

  it("trata singular e plural como o mesmo termo", () => {
    expect([...termosDoObjeto("cadeira")]).toEqual([...termosDoObjeto("cadeiras")]);
  });
});

describe("similaridade", () => {
  it("é 0 sem termos em comum suficientes", () => {
    expect(similaridade(new Set(["cadeira", "escritorio"]), new Set(["cadeira", "pneu"]))).toBe(0);
  });

  it("é maior para objetos iguais do que para parecidos", () => {
    const a = termosDoObjeto("Manutenção de ar condicionado split");
    const igual = similaridade(a, termosDoObjeto("manutencao de ar-condicionado split"));
    const parecido = similaridade(a, termosDoObjeto("Manutenção de ar condicionado split e instalação de elétrica predial"));
    expect(igual).toBeGreaterThan(parecido);
    expect(parecido).toBeGreaterThan(0);
  });

  it("é 0 com conjunto vazio", () => {
    expect(similaridade(new Set(), new Set(["a"]))).toBe(0);
  });
});

describe("acharSemelhantes", () => {
  const alvo = op("A", "Contratação de empresa para manutenção preventiva de ar condicionado", "111");

  it("traz só objetos parecidos de outros órgãos, sem a própria compra", () => {
    const lista = [
      alvo,
      op("B", "Manutenção preventiva e corretiva de aparelhos de ar-condicionado", "222"),
      op("C", "Aquisição de gêneros alimentícios para merenda escolar", "333"),
      op("D", "Manutenção preventiva de ar condicionado do prédio", "111"),
    ];
    const r = acharSemelhantes(alvo, lista);
    expect(r.map((s) => s.oportunidade.id)).toEqual(["B"]);
  });

  it("limita a 5 e ordena pela semelhança", () => {
    const lista: Oportunidade[] = [];
    for (let i = 0; i < 8; i += 1) {
      lista.push(op(`X${i}`, "Manutenção preventiva de ar condicionado", `9${i}`, `2026-12-0${i + 1}T10:00:00-03:00`));
    }
    lista.push(op("Y", "Manutenção preventiva de ar condicionado split com troca de peças de reposição", "999"));
    const r = acharSemelhantes(alvo, lista);
    expect(r).toHaveLength(5);
    expect(r.every((s) => s.oportunidade.id !== "Y")).toBe(true);
    for (let i = 1; i < r.length; i += 1) expect(r[i - 1].similaridade).toBeGreaterThanOrEqual(r[i].similaridade);
  });

  it("não repete a mesma oportunidade e respeita o máximo pedido", () => {
    const b = op("B", "Manutenção preventiva de ar condicionado", "222");
    expect(acharSemelhantes(alvo, [b, b], 5)).toHaveLength(1);
    expect(acharSemelhantes(alvo, [b, op("C", "Manutenção preventiva de ar condicionado", "333")], 1)).toHaveLength(1);
  });

  it("devolve vazio quando o objeto do alvo não tem termos úteis", () => {
    expect(acharSemelhantes(op("Z", "Contratação de empresa para o serviço", "1"), [op("B", "serviço", "2")])).toEqual([]);
  });

  it("órgão sem CNPJ não exclui os demais", () => {
    const semCnpj = op("S", "Manutenção preventiva de ar condicionado", "");
    expect(acharSemelhantes(semCnpj, [op("B", "Manutenção preventiva de ar condicionado", "")])).toHaveLength(1);
  });
});
