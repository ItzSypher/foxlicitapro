import { beforeEach, describe, expect, it } from "vitest";
import type { ArquivoCompra, DadosProposta } from "@/core/types-detalhe";
import {
  aplicarSugestoes,
  escolherArquivoPrincipal,
  parecePdf,
  validarSaidaAnalise,
  type SugestaoItem,
} from "./analise";
import { JANELA_MS, MAX_MENSAGENS_POR_HORA, limparLimites, registrarMensagem } from "./limite";
import { interpretarRota, sugestoesRapidas } from "./rota";

const valida = {
  modeloId: "dispensa-produtos",
  resumo: "Compra de cabos.",
  pegadinhas: ["Amostra em 3 dias"],
  documentosExigidos: ["Cartão CNPJ"],
  sugestoesPorItem: [{ numero: 1, marcaModelo: "", precoSugerido: 10, observacao: "Cotar." }],
};

describe("validarSaidaAnalise", () => {
  it("aceita a saída válida", () => {
    expect(validarSaidaAnalise(valida, [1, 2]).ok).toBe(true);
  });

  it("recusa modelo fora dos 4 e campos faltando", () => {
    expect(validarSaidaAnalise({ ...valida, modeloId: "outro" }, [1]).ok).toBe(false);
    expect(validarSaidaAnalise({ resumo: "x" }, [1]).ok).toBe(false);
    expect(validarSaidaAnalise("texto", [1]).ok).toBe(false);
  });

  it("recusa sugestão para item que não existe", () => {
    const r = validarSaidaAnalise({ ...valida, sugestoesPorItem: [{ ...valida.sugestoesPorItem[0], numero: 9 }] }, [1, 2]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.join(" ")).toContain("item 9");
  });
});

const dados: DadosProposta = {
  orgao: "Órgão",
  unidade: "",
  objeto: "Objeto",
  numeroCompra: "1/2026",
  processo: "",
  itens: [
    { numero: 1, descricao: "A", unidade: "UN", quantidade: 2, marcaModelo: "", valorUnitario: 0 },
    { numero: 2, descricao: "B", unidade: "UN", quantidade: 1, marcaModelo: "", valorUnitario: 0 },
    { numero: 3, descricao: "C", unidade: "UN", quantidade: 1, marcaModelo: "", valorUnitario: 0 },
  ],
  validadeDias: 30,
  prazoEntrega: "10 dias",
  localEntrega: "",
  pagamento: "",
  garantia: "",
  observacoes: "",
  data: "2026-11-12",
};

describe("aplicarSugestoes", () => {
  const sugestoes: SugestaoItem[] = [
    { numero: 1, marcaModelo: " Marca X ", precoSugerido: 150, observacao: "" },
    { numero: 2, marcaModelo: "", precoSugerido: 40.456, observacao: "Cotar." },
    { numero: 3, marcaModelo: "", precoSugerido: 99, observacao: "" },
  ];

  it("nunca deixa o preço acima do estimado e zera sem estimativa", () => {
    const r = aplicarSugestoes(dados, sugestoes, { 1: 100, 2: 50 });
    expect(r.dados.itens.map((i) => i.valorUnitario)).toEqual([100, 40.46, 0]);
    expect(r.dados.itens[0].marcaModelo).toBe("Marca X");
    expect(r.sugestoes[0].observacao).toContain("limitado");
    expect(r.sugestoes[2].precoSugerido).toBeNull();
  });

  it("item sem sugestão fica como estava", () => {
    const r = aplicarSugestoes(dados, [], {});
    expect(r.dados.itens).toEqual(dados.itens);
  });
});

function arq(sequencial: number, titulo: string, tipo: string | null): ArquivoCompra {
  return { sequencial, titulo, tipo, url: `https://pncp.gov.br/${sequencial}`, publicadoEm: null };
}

describe("escolherArquivoPrincipal", () => {
  it("prefere edital, depois termo de referência, depois aviso", () => {
    expect(escolherArquivoPrincipal([arq(1, "Aviso", "Aviso de Contratação Direta"), arq(2, "TR", "Termo de Referência")])?.sequencial).toBe(2);
    expect(escolherArquivoPrincipal([arq(1, "TR", "Termo de Referência"), arq(2, "Edital", "Edital")])?.sequencial).toBe(2);
  });

  it("deixa retificação e anexos para depois", () => {
    expect(escolherArquivoPrincipal([arq(1, "Retificação do Edital", "Edital"), arq(2, "Edital", "Edital")])?.sequencial).toBe(2);
    expect(escolherArquivoPrincipal([arq(1, "Planilha", "Anexo")])).toBeNull();
    expect(escolherArquivoPrincipal([])).toBeNull();
  });

  it("reconhece PDF pelo cabeçalho", () => {
    expect(parecePdf(new TextEncoder().encode("%PDF-1.7 ..."))).toBe(true);
    expect(parecePdf(new TextEncoder().encode("PK\u0003\u0004"))).toBe(false);
  });
});

describe("limite de mensagens", () => {
  beforeEach(() => limparLimites());

  it("permite 30 por hora por usuário e libera depois da janela", () => {
    for (let i = 0; i < MAX_MENSAGENS_POR_HORA; i += 1) expect(registrarMensagem("a", 1000 + i).permitido).toBe(true);
    const bloqueada = registrarMensagem("a", 5000);
    expect(bloqueada.permitido).toBe(false);
    expect(registrarMensagem("b", 5000).permitido).toBe(true);
    expect(registrarMensagem("a", 1000 + JANELA_MS + 1).permitido).toBe(true);
  });
});

describe("rota do chat", () => {
  it("reconhece páginas e ignora o resto", () => {
    expect(interpretarRota("/licitacao/12345678000199/2026/45?x=1")).toEqual({
      tipo: "licitacao",
      chave: { cnpj: "12345678000199", ano: 2026, sequencial: 45 },
    });
    expect(interpretarRota("/radar/").tipo).toBe("radar");
    expect(interpretarRota("/propostas/3f2b8c1e-1111-4222-8333-444455556666").tipo).toBe("proposta");
    expect(interpretarRota("/propostas/nova").tipo).toBe("outra");
    expect(interpretarRota("/licitacao/abc/2026/1").tipo).toBe("outra");
    expect(sugestoesRapidas({ tipo: "radar" })).toHaveLength(2);
  });
});
