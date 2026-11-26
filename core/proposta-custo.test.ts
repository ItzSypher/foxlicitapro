import { describe, expect, it } from "vitest";
import {
  aplicarCustosDeReferencia,
  custosDeReferencia,
  resultadoDaProposta,
  textoConfirmacaoEnvio,
} from "./proposta-custo";
import { DadosPropostaSchema, semCustos } from "./proposta";
import type { ResumoCotacoes } from "./cotacoes-resumo";
import type { PrecoFornecedor } from "./fornecedores";
import type { DadosProposta, ItemProposta } from "./types-detalhe";

function item(parte: Partial<ItemProposta>): ItemProposta {
  return { numero: 1, descricao: "HD externo 8 TB", unidade: "UN", quantidade: 2, marcaModelo: "", valorUnitario: 2_000, ...parte };
}

function dados(itens: ItemProposta[]): DadosProposta {
  return {
    orgao: "Marinha",
    unidade: "",
    objeto: "HD",
    numeroCompra: "1/2026",
    processo: "",
    itens,
    validadeDias: 60,
    prazoEntrega: "10 dias",
    localEntrega: "",
    pagamento: "",
    garantia: "",
    observacoes: "",
    data: "2026-11-26",
  };
}

describe("resultadoDaProposta", () => {
  it("HD da Marinha: vendido a 4.000 com custo de 2.700 cada dá prejuízo, com e sem comissão", () => {
    const d = dados([item({ custoUnitario: 2_700 })]);
    const gestor = resultadoDaProposta(d, null);
    expect(gestor.receita).toBe(4_000);
    expect(gestor.custo).toBe(5_400);
    expect(gestor.margemBruta).toBe(-1_400);
    expect(gestor.comissao).toBeNull();
    expect(gestor.resultado).toBeNull();
    expect(gestor.situacao).toBe("prejuizo");
    expect(gestor.prejuizo).toBe(1_400);

    const dono = resultadoDaProposta(d, 12);
    expect(dono.comissao).toBe(480);
    expect(dono.resultado).toBe(-1_880);
    expect(dono.prejuizo).toBe(1_880);
    expect(dono.itens[0]).toMatchObject({ custo: 5_400, prejuizo: true });
    expect(dono.itens[0]?.precoMinimoUnitario).toBeCloseTo(3_068.18, 2);
  });

  it("conta lucro e preço mínimo por item", () => {
    const d = dados([item({ custoUnitario: 1_000 }), item({ numero: 2, quantidade: 1, valorUnitario: 500, custoUnitario: 400 })]);
    const r = resultadoDaProposta(d, 10);
    expect(r.receita).toBe(4_500);
    expect(r.custo).toBe(2_400);
    expect(r.comissao).toBe(450);
    expect(r.resultado).toBe(1_650);
    expect(r.situacao).toBe("lucro");
    expect(r.prejuizo).toBe(0);
    expect(r.itens.every((i) => !i.prejuizo)).toBe(true);
    expect(r.margemBrutaPercentual).toBeCloseTo(46.7, 1);
  });

  it("conta itens sem custo e não os trata como custo zero de prejuízo", () => {
    const r = resultadoDaProposta(dados([item({}), item({ numero: 2, custoUnitario: 0 })]), 12);
    expect(r.itensSemCusto).toBe(2);
    expect(r.custo).toBe(0);
    expect(r.itens[0]).toEqual({ numero: 1, custo: null, precoMinimoUnitario: null, prejuizo: false });
    expect(r.situacao).toBe("lucro");
  });

  it("sem receita não há situação para avaliar", () => {
    const r = resultadoDaProposta(dados([item({ valorUnitario: 0, custoUnitario: 10 })]), 12);
    expect(r.receita).toBe(0);
    expect(r.situacao).toBe("sem-receita");
    expect(r.prejuizo).toBe(0);
  });

  it("proposta antiga sem o campo de custo continua válida", () => {
    const lida = DadosPropostaSchema.safeParse(dados([item({})]));
    expect(lida.success).toBe(true);
    const nova = DadosPropostaSchema.safeParse(dados([item({ custoUnitario: 12.5, fonteCusto: "Cotação salva" })]));
    expect(nova.success && nova.data.itens[0]?.custoUnitario).toBe(12.5);
  });

  it("semCustos tira custo e fonte de todos os itens", () => {
    const limpo = semCustos(dados([item({ custoUnitario: 10, fonteCusto: "x" })]));
    expect(JSON.stringify(limpo)).not.toContain("custoUnitario");
    expect(JSON.stringify(limpo)).not.toContain("fonteCusto");
    expect(limpo.itens[0]?.valorUnitario).toBe(2_000);
  });
});

describe("textoConfirmacaoEnvio", () => {
  it("avisa o prejuízo, o custo que falta ou os dois; sem nada, devolve null", () => {
    expect(textoConfirmacaoEnvio({ prejuizo: 1_880, itensSemCusto: 0 })?.replace(/ /g, " ")).toBe(
      "Esta proposta dá prejuízo de R$ 1.880,00. Enviar mesmo assim?",
    );
    expect(textoConfirmacaoEnvio({ prejuizo: 0, itensSemCusto: 1 })).toContain("Falta o custo de 1 item,");
    expect(textoConfirmacaoEnvio({ prejuizo: 10, itensSemCusto: 3 })).toContain("e falta o custo de 3 itens");
    expect(textoConfirmacaoEnvio({ prejuizo: 0, itensSemCusto: 0 })).toBeNull();
  });
});

const preco = (parte: Partial<PrecoFornecedor>): PrecoFornecedor => ({
  id: "p1",
  fornecedorId: "f1",
  fornecedorNome: "Loja Alfa",
  descricao: "HD externo 8 TB",
  unidade: "UN",
  preco: 2_650,
  prazoDias: null,
  data: "2026-11-10",
  origem: "manual",
  ...parte,
});

const cotacao = (media: number): ResumoCotacoes => ({
  quantidade: 1,
  ultima: { precoVenda: 0, margem: 0.2, criadoEm: "2026-11-01T00:00:00.000Z" },
  frentes: [
    {
      frente: "produtos",
      quantidade: 1,
      venda: { media: 0, menor: 0, maior: 0 },
      custo: { media, menor: media, maior: media },
      custoTotal: { media, menor: media, maior: media },
      listas: [
        {
          chave: "hd externo 8 tb",
          descricao: "HD externo 8 TB",
          quantidade: 1,
          venda: { media: 0, menor: 0, maior: 0 },
          custo: { media, menor: media, maior: media },
          custoTotal: { media, menor: media, maior: media },
        },
      ],
    },
  ],
});

describe("custosDeReferencia", () => {
  it("usa a cotação salva (custo do lote dividido pela quantidade) antes do fornecedor", () => {
    const ref = custosDeReferencia([item({})], cotacao(5_400), [preco({})]);
    expect(ref.get(1)?.custoUnitario).toBe(2_700);
    expect(ref.get(1)?.fonte).toContain("Cotação salva");
  });

  it("sem cotação, usa o menor preço de fornecedor parecido e diz de quem", () => {
    const ref = custosDeReferencia([item({})], null, [preco({}), preco({ id: "p2", fornecedorNome: "Loja Beta", preco: 2_600, data: "2026-10-02" })]);
    expect(ref.get(1)?.custoUnitario).toBe(2_600);
    expect(ref.get(1)?.fonte).toBe("Preço de Loja Beta em 02/10/2026");
  });

  it("sem referência, não inventa custo e deixa o item vazio", () => {
    const ref = custosDeReferencia([item({ descricao: "Serviço de consultoria sob medida" })], null, [preco({})]);
    expect(ref.size).toBe(0);
    const aplicado = aplicarCustosDeReferencia(dados([item({})]), ref);
    expect(aplicado.itens[0]?.custoUnitario).toBeUndefined();
  });

  it("aplica a referência sem sobrescrever o custo que a pessoa já digitou", () => {
    const ref = custosDeReferencia([item({}), item({ numero: 2 })], null, [preco({})]);
    const aplicado = aplicarCustosDeReferencia(dados([item({ custoUnitario: 1_000 }), item({ numero: 2 })]), ref);
    expect(aplicado.itens[0]?.custoUnitario).toBe(1_000);
    expect(aplicado.itens[1]).toMatchObject({ custoUnitario: 2_650, fonteCusto: "Preço de Loja Alfa em 10/11/2026" });
  });
});
