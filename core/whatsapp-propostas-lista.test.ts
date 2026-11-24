import { describe, expect, it } from "vitest";
import {
  escolherPropostasDaLista,
  lerListaGuardada,
  lerNumeroEscolhido,
  textoDetalheProposta,
  textoListaPropostas,
  type PropostaDaLista,
} from "./whatsapp-propostas-lista";

const AGORA = new Date("2026-11-24T01:30:00Z");

function p(parcial: Partial<PropostaDaLista> & { id: string }): PropostaDaLista {
  return {
    objeto: "Toner",
    total: 1000,
    status: "rascunho",
    atualizadoEm: "2026-11-23T10:00:00Z",
    criadoPorNome: "Paulo Henrique",
    externa: false,
    ...parcial,
  };
}

describe("lista de propostas no WhatsApp", () => {
  it("põe em revisão primeiro e deixa enviadas e externas de fora", () => {
    const lista = escolherPropostasDaLista([
      p({ id: "r", status: "rascunho" }),
      p({ id: "e", status: "enviada" }),
      p({ id: "x", status: "em_revisao", externa: true }),
      p({ id: "v", status: "em_revisao" }),
      p({ id: "a", status: "aprovada" }),
    ]);
    expect(lista.map((x) => x.id)).toEqual(["v", "a", "r"]);
  });

  it("numera a lista e pede o número", () => {
    const texto = textoListaPropostas([p({ id: "v", status: "em_revisao", objeto: "Material de escritório", total: 2500 })]);
    expect(texto).toContain("1. *Material de escritório* · R$ 2.500");
    expect(texto).toContain("Em revisão");
    expect(texto).toContain("Paulo");
    expect(texto).toContain("Responda o *número*");
    expect(textoListaPropostas([])).toContain("Nenhuma proposta");
  });

  it("detalhe traz leitura antes do sistema e pede confirmação só quando pode aprovar", () => {
    const base = { objeto: "Toner", orgao: "Câmara", total: 800, itens: 2, status: "em_revisao" as const, criadoPorNome: "Paulo", link: "L", leitura: "R" };
    const texto = textoDetalheProposta({ ...base, podeAprovar: true });
    expect(texto.indexOf("Ler o documento")).toBeLessThan(texto.indexOf("Abrir no sistema"));
    expect(texto).toContain("*Aprovar*");
    expect(textoDetalheProposta({ ...base, podeAprovar: false })).not.toContain("*Aprovar*");
  });

  it("lê só número sozinho", () => {
    expect(lerNumeroEscolhido("3")).toBe(3);
    expect(lerNumeroEscolhido(" nº 2 ")).toBe(2);
    expect(lerNumeroEscolhido("#1")).toBe(1);
    expect(lerNumeroEscolhido("0")).toBeNull();
    expect(lerNumeroEscolhido("gerar 1")).toBeNull();
    expect(lerNumeroEscolhido("3 propostas")).toBeNull();
  });

  it("lista guardada vale 6 h", () => {
    const valor = JSON.stringify({ ids: ["a", "b"], em: "2026-11-23T22:00:00Z" });
    expect(lerListaGuardada(valor, AGORA)?.ids).toEqual(["a", "b"]);
    expect(lerListaGuardada(valor, new Date("2026-11-24T05:00:00Z"))).toBeNull();
    expect(lerListaGuardada("lixo", AGORA)).toBeNull();
    expect(lerListaGuardada(null, AGORA)).toBeNull();
  });
});
