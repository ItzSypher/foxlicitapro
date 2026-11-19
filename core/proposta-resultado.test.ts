import { describe, expect, it } from "vitest";
import type { ResultadoItemPncp } from "./pncp/resultados";
import {
  apurarResultado,
  avisoResultado,
  itensParaConsultar,
  mesmaEmpresa,
  precisaConsultar,
  semResultado,
  textoResultado,
} from "./proposta-resultado";

const NOSSO = "70048886000129";
const FILIAL = "70048886000200";
const OUTRO = "90180605000102";

function res(numeroItem: number, documento: string, valor: number, extra: Partial<ResultadoItemPncp> = {}): ResultadoItemPncp {
  return {
    numeroItem,
    documentoFornecedor: documento,
    nomeFornecedor: documento === OUTRO ? "GENTE SEGURADORA SA" : "NOSSA EMPRESA",
    valorTotal: valor,
    valorUnitario: valor,
    data: "2026-11-17",
    cancelado: false,
    ...extra,
  };
}

describe("mesmaEmpresa", () => {
  it("compara pela raiz do CNPJ (matriz e filial)", () => {
    expect(mesmaEmpresa(FILIAL, NOSSO)).toBe(true);
    expect(mesmaEmpresa("70.048.886/0001-29", NOSSO)).toBe(true);
    expect(mesmaEmpresa(OUTRO, NOSSO)).toBe(false);
    expect(mesmaEmpresa("", NOSSO)).toBe(false);
    expect(mesmaEmpresa("12345678901", NOSSO)).toBe(false);
  });
});

describe("apurarResultado", () => {
  it("sem itens fica aguardando", () => {
    expect(apurarResultado([], NOSSO).situacao).toBe("aguardando");
  });

  it("ganhou: soma o valor dos itens da empresa", () => {
    const r = apurarResultado(
      [
        { numero: 1, situacao: "Homologado", resultados: [res(1, NOSSO, 1000)] },
        { numero: 2, situacao: "Homologado", resultados: [res(2, OUTRO, 500)] },
      ],
      NOSSO,
    );
    expect(r).toEqual({ situacao: "ganhou", vencedor: null, valor: 1000, itensGanhos: 1, itensPerdidos: 1, itensAguardando: 0 });
  });

  it("perdeu: guarda o vencedor e o valor homologado", () => {
    const r = apurarResultado([{ numero: 1, situacao: "Homologado", resultados: [res(1, OUTRO, 587.97)] }], NOSSO);
    expect(r.situacao).toBe("perdeu");
    expect(r.vencedor).toBe("GENTE SEGURADORA SA");
    expect(r.valor).toBe(587.97);
  });

  it("item pendente segura o resultado em aguardando, mas conta o que já ganhou", () => {
    const r = apurarResultado(
      [
        { numero: 1, situacao: "Homologado", resultados: [res(1, FILIAL, 200.1)] },
        { numero: 2, situacao: "Em Andamento", resultados: [] },
      ],
      NOSSO,
    );
    expect(r.situacao).toBe("aguardando");
    expect(r.itensGanhos).toBe(1);
    expect(r.valor).toBe(200.1);
  });

  it("resultado cancelado não vale", () => {
    const r = apurarResultado([{ numero: 1, situacao: null, resultados: [res(1, OUTRO, 10, { cancelado: true })] }], NOSSO);
    expect(r.situacao).toBe("aguardando");
  });

  it("item deserto ou fracassado encerra sem vencedor", () => {
    const r = apurarResultado(
      [
        { numero: 1, situacao: "Deserto", resultados: [] },
        { numero: 2, situacao: "Fracassado", resultados: [] },
      ],
      NOSSO,
    );
    expect(r).toEqual({ situacao: "perdeu", vencedor: null, valor: null, itensGanhos: 0, itensPerdidos: 2, itensAguardando: 0 });
  });

  it("vencedor é quem levou mais itens", () => {
    const outro2 = "11222333000181";
    const r = apurarResultado(
      [
        { numero: 1, situacao: null, resultados: [{ ...res(1, outro2, 1), nomeFornecedor: "B" }] },
        { numero: 2, situacao: null, resultados: [{ ...res(2, OUTRO, 2), nomeFornecedor: "A" }] },
        { numero: 3, situacao: null, resultados: [{ ...res(3, OUTRO, 3), nomeFornecedor: "A" }] },
      ],
      NOSSO,
    );
    expect(r.vencedor).toBe("A");
    expect(r.valor).toBe(6);
  });
});

describe("itensParaConsultar", () => {
  it("usa os itens da proposta que existem na compra", () => {
    expect(itensParaConsultar([3, 1, 1, 9], [1, 2, 3])).toEqual([1, 3]);
  });

  it("sem itens em comum consulta todos da compra, até 30", () => {
    expect(itensParaConsultar([], [2, 1])).toEqual([1, 2]);
    const muitos = Array.from({ length: 50 }, (_, i) => i + 1);
    expect(itensParaConsultar([], muitos)).toHaveLength(30);
  });
});

describe("precisaConsultar", () => {
  const agora = new Date("2026-11-18T10:00:00Z");
  it("consulta quem nunca foi consultado", () => {
    expect(precisaConsultar({ enviadaEm: "2026-11-10T10:00:00Z", consultadoEm: null }, agora)).toBe(true);
  });
  it("espera 20 h entre consultas", () => {
    expect(precisaConsultar({ enviadaEm: "2026-11-10T10:00:00Z", consultadoEm: "2026-11-18T00:00:00Z" }, agora)).toBe(false);
    expect(precisaConsultar({ enviadaEm: "2026-11-10T10:00:00Z", consultadoEm: "2026-11-17T13:00:00Z" }, agora)).toBe(true);
  });
  it("para depois de 180 dias ou sem data de envio", () => {
    expect(precisaConsultar({ enviadaEm: "2026-04-01T10:00:00Z", consultadoEm: null }, agora)).toBe(false);
    expect(precisaConsultar({ enviadaEm: null, consultadoEm: null }, agora)).toBe(false);
  });
});

describe("semResultado", () => {
  it("só enviada sem resultado final", () => {
    expect(semResultado({ status: "enviada", resultado: null })).toBe(true);
    expect(semResultado({ status: "enviada", resultado: "aguardando" })).toBe(true);
    expect(semResultado({ status: "enviada", resultado: "ganhou" })).toBe(false);
    expect(semResultado({ status: "aprovada", resultado: null })).toBe(false);
  });
});

describe("texto e aviso", () => {
  const base = { vencedor: null, valor: null, itensGanhos: 0, itensPerdidos: 0, itensAguardando: 0 };

  it("descreve cada situação", () => {
    expect(textoResultado({ ...base, situacao: "ganhou", valor: 62000, itensGanhos: 1 })).toMatch(/^Ganhou \(R\$\s?62\.000,00\)\.$/);
    expect(textoResultado({ ...base, situacao: "ganhou", valor: 10, itensGanhos: 1, itensPerdidos: 2 })).toMatch(/^Ganhou 1 de 3 itens/);
    expect(textoResultado({ ...base, situacao: "perdeu", vencedor: "X LTDA", valor: 5, itensPerdidos: 1 })).toMatch(/^Perdeu para X LTDA/);
    expect(textoResultado({ ...base, situacao: "perdeu", itensPerdidos: 1 })).toMatch(/sem vencedor/);
    expect(textoResultado({ ...base, situacao: "aguardando", itensAguardando: 1 })).toBe("Aguardando o resultado no PNCP.");
  });

  it("aviso só sai com resultado final, uma chave por situação", () => {
    expect(avisoResultado({ id: "p1", titulo: "T", apurado: { ...base, situacao: "aguardando" } })).toBeNull();
    const aviso = avisoResultado({ id: "p1", titulo: "T", apurado: { ...base, situacao: "ganhou", itensGanhos: 1 } });
    expect(aviso?.tipo).toBe("proposta_resultado");
    expect(aviso?.alvo).toEqual({ tipo: "todos" });
    expect(aviso?.link).toBe("/propostas/p1");
    expect(aviso?.chave).toBe("proposta_resultado:p1:ganhou");
  });
});
