import { describe, expect, it } from "vitest";
import type { DadosProposta, DetalheCompra, ItemCompra } from "./types-detalhe";
import {
  chaveDeNumeroControle,
  dataPorExtenso,
  lerChaveCompra,
  montarDadosIniciais,
  referenciasDoDetalhe,
  totalProposta,
  validarProposta,
  valorPorExtenso,
} from "./proposta";
import { MODELOS, frentePredominante, sugerirModelo } from "./proposta-modelos";

function item(parcial: Partial<ItemCompra>): ItemCompra {
  return {
    numero: 1,
    descricao: "Cabo HDMI 2 m",
    tipo: "Material",
    quantidade: 10,
    unidade: "UN",
    valorUnitarioEstimado: 45,
    valorTotalEstimado: 450,
    beneficio: null,
    exclusivoMeEpp: false,
    criterioJulgamento: null,
    situacao: null,
    sigiloso: false,
    ...parcial,
  };
}

function detalhe(parcial: Partial<DetalheCompra>): DetalheCompra {
  return {
    chave: { cnpj: "11111111000191", ano: 2026, sequencial: 7 },
    numeroControle: "11111111000191-1-000007/2026",
    numeroCompra: "12/2026",
    processo: "23/2026",
    objeto: "Aquisição de cabos",
    informacaoComplementar: null,
    modalidadeId: 8,
    modalidadeNome: "Dispensa",
    modoDisputa: null,
    amparoLegal: null,
    situacao: null,
    srp: false,
    orgao: "Prefeitura de Teste",
    orgaoCnpj: "11111111000191",
    unidade: "Secretaria de Teste",
    municipio: "Nova Iguaçu",
    uf: "RJ",
    codigoIbge: "3303500",
    valorEstimado: null,
    valorHomologado: null,
    dataInclusao: null,
    dataPublicacao: null,
    dataAbertura: null,
    dataEncerramento: null,
    dataAtualizacao: null,
    linkPncp: "",
    linkOrigem: null,
    linkProcesso: null,
    itens: [item({})],
    totalItens: 1,
    arquivos: [],
    falhas: [],
    ...parcial,
  };
}

describe("valorPorExtenso", () => {
  it("escreve os casos do briefing", () => {
    expect(valorPorExtenso(0.01)).toBe("um centavo");
    expect(valorPorExtenso(1)).toBe("um real");
    expect(valorPorExtenso(1234.56)).toBe("mil duzentos e trinta e quatro reais e cinquenta e seis centavos");
    expect(valorPorExtenso(1_000_000)).toBe("um milhão de reais");
    expect(valorPorExtenso(2001.1)).toBe("dois mil e um reais e dez centavos");
  });

  it("cobre zero, cem e centenas", () => {
    expect(valorPorExtenso(0)).toBe("zero reais");
    expect(valorPorExtenso(100)).toBe("cem reais");
    expect(valorPorExtenso(101.5)).toBe("cento e um reais e cinquenta centavos");
    expect(valorPorExtenso(21)).toBe("vinte e um reais");
    expect(valorPorExtenso(12_500_000)).toBe("doze milhões e quinhentos mil reais");
  });
});

describe("totalProposta", () => {
  it("soma em centavos inteiros sem resíduo de ponto flutuante", () => {
    const dados = montarDadosIniciais(detalhe({}), "dispensa-produtos", new Date("2026-11-12T15:00:00Z"));
    dados.itens = [
      { ...dados.itens[0], quantidade: 3, valorUnitario: 0.1 },
      { ...dados.itens[0], numero: 2, quantidade: 1.5, valorUnitario: 19.99 },
    ];
    expect(totalProposta(dados)).toBe(30 + 2999);
  });
});

describe("montarDadosIniciais", () => {
  it("traz os itens com valor unitário zero e os padrões do modelo", () => {
    const d = montarDadosIniciais(
      detalhe({ itens: [item({ numero: 2, unidade: null, quantidade: null }), item({ numero: 1 })] }),
      "pregao-produtos",
      new Date("2026-11-12T15:00:00Z"),
    );
    expect(d.itens.map((i) => i.numero)).toEqual([1, 2]);
    expect(d.itens.every((i) => i.valorUnitario === 0)).toBe(true);
    expect(d.itens[1]).toMatchObject({ unidade: "UN", quantidade: 1 });
    expect(d.validadeDias).toBe(60);
    expect(d.data).toBe("2026-11-12");
    expect(d.orgao).toBe("Prefeitura de Teste");
    expect(d.numeroCompra).toBe("12/2026");
  });

  it("guarda a estimativa do órgão à parte, sem itens sigilosos", () => {
    const refs = referenciasDoDetalhe(
      detalhe({ itens: [item({ numero: 1 }), item({ numero: 2, sigiloso: true }), item({ numero: 3, valorUnitarioEstimado: null })] }),
    );
    expect(refs).toEqual({ 1: 45 });
  });
});

describe("validarProposta", () => {
  function base(): DadosProposta {
    return montarDadosIniciais(
      detalhe({ itens: [item({ numero: 1 }), item({ numero: 2 }), item({ numero: 3 })] }),
      "pregao-produtos",
      new Date("2026-11-12T15:00:00Z"),
    );
  }

  it("aponta valor unitário e marca em produtos", () => {
    const p = validarProposta(base(), "pregao-produtos");
    expect(p).toContain("Item 3 sem valor unitário");
    expect(p).toContain("Informe marca e modelo do item 2");
  });

  it("não cobra marca em serviços e na cotação simples", () => {
    expect(validarProposta(base(), "dispensa-servicos").some((t) => t.includes("marca"))).toBe(false);
    expect(validarProposta(base(), "cotacao-simples").some((t) => t.includes("marca"))).toBe(false);
  });

  it("cobra 60 dias só no pregão", () => {
    const d = { ...base(), validadeDias: 30 };
    expect(validarProposta(d, "pregao-produtos")).toContain("Validade abaixo de 60 dias");
    expect(validarProposta(d, "dispensa-produtos")).not.toContain("Validade abaixo de 60 dias");
  });

  it("fica vazia quando tudo está preenchido", () => {
    const d = base();
    d.itens = d.itens.map((i) => ({ ...i, marcaModelo: "Marca X", valorUnitario: 10 }));
    expect(validarProposta(d, "pregao-produtos")).toEqual([]);
  });
});

describe("chaves e datas", () => {
  it("lê a chave da URL e do numeroControlePNCP", () => {
    expect(lerChaveCompra("11111111000191-2026-7")).toEqual({ cnpj: "11111111000191", ano: 2026, sequencial: 7 });
    expect(lerChaveCompra("abc")).toBeNull();
    expect(chaveDeNumeroControle("11111111000191-1-000007/2026")).toEqual({
      cnpj: "11111111000191",
      ano: 2026,
      sequencial: 7,
    });
    expect(chaveDeNumeroControle("TESTE-1")).toBeNull();
  });

  it("escreve a data por extenso", () => {
    expect(dataPorExtenso("2026-11-12")).toBe("12 de novembro de 2026");
    expect(dataPorExtenso("2026-03-01")).toBe("1 de março de 2026");
  });
});

describe("modelos", () => {
  it("tem os quatro modelos e cada um com declarações", () => {
    expect(MODELOS.map((m) => m.id)).toEqual(["dispensa-produtos", "dispensa-servicos", "pregao-produtos", "cotacao-simples"]);
    expect(MODELOS.every((m) => m.textos.declaracoes.length >= 3)).toBe(true);
  });

  it("sugere pela modalidade e pela frente", () => {
    expect(sugerirModelo(detalhe({ modalidadeId: 8 }), "produtos")).toBe("dispensa-produtos");
    expect(sugerirModelo(detalhe({ modalidadeId: 8 }), "servicos")).toBe("dispensa-servicos");
    expect(sugerirModelo(detalhe({ modalidadeId: 6 }), "produtos")).toBe("pregao-produtos");
    expect(sugerirModelo(detalhe({ modalidadeId: 1 }), "produtos")).toBe("cotacao-simples");
  });

  it("detecta a frente predominante dos itens", () => {
    const d = detalhe({ itens: [item({ tipo: "Serviço" }), item({ numero: 2, tipo: "Serviço" }), item({ numero: 3 })] });
    expect(frentePredominante(d, "produtos")).toBe("servicos");
    expect(frentePredominante(detalhe({ itens: [] }), "produtos")).toBe("produtos");
  });
});
