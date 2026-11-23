import { describe, expect, it } from "vitest";
import { FICHA_EXEMPLO } from "@/core/ficha.fixture";
import type { Fornecedor } from "@/core/fornecedores";
import type { PerfilEmpresa } from "@/core/perfil";
import type { PrecoSugerido } from "@/core/preco-sugerido";
import type { OportunidadeComScore } from "@/core/types";
import type { ItemCompra } from "@/core/types-detalhe";
import { fornecedoresDoObjeto, montarContexto, MAX_ITENS_NO_CONTEXTO, type EntradaContexto } from "./contexto";

const ITEM: OportunidadeComScore = {
  id: "10779511000107-1-000235/2026",
  objeto: "Aquisição de licenças Zoom Workplace Pro por 24 meses",
  valorEstimado: 120000,
  orgao: "Prefeitura de Teste",
  orgaoCnpj: "10779511000107",
  unidade: "Secretaria de Educação",
  municipio: "Nova Iguaçu",
  codigoIbge: "3303500",
  uf: "RJ",
  regiao: "nova-iguacu",
  modalidadeId: 6,
  modalidadeNome: "Pregão - Eletrônico",
  dataAbertura: "2026-11-20T09:00:00-03:00",
  dataEncerramento: "2026-11-20T10:00:00-03:00",
  anoCompra: 2026,
  sequencialCompra: 235,
  linkPncp: "https://pncp.gov.br/x",
  linkOrigem: null,
  score: { total: 70, faixa: "go", criterios: [], cnaesCasados: ["61.90-6-99"], frenteCasada: "servicos" },
};

const PERFIL: PerfilEmpresa = {
  id: "e1",
  cnpj: "70048886000129",
  razaoSocial: "Empresa de Teste LTDA",
  nomeFantasia: null,
  porte: "mei",
  uf: "RJ",
  municipio: "Nova Iguaçu",
  dataAbertura: "2020-01-01",
  cnaes: [{ codigo: "61.90-6-99", descricao: "Redes de computadores", frente: "servicos", principal: true }],
  regioes: ["nova-iguacu", "baixada"],
  areas: { ufs: [], municipiosIbge: ["3303500"], base: { uf: "RJ", municipioIbge: "3303500" } },
  radarTudoDoRamo: false,
  foco: [],
  endereco: null,
  cep: null,
  telefone: null,
  email: null,
  responsavel: null,
  representanteCpf: null,
  representanteRg: null,
  dadosBancarios: null,
  assinatura: null,
  teste: false,
};

const PRECO: PrecoSugerido = {
  veredito: "vale",
  piso: 80000,
  alvo: 95000.5,
  teto: 114000,
  sugerido: 95000.5,
  margemAlvoPct: 18,
  margemSugeridaPct: 18,
  lucroNoAlvo: 14000,
  custoTotal: 70000,
  regime: "mei",
  confianca: "media",
  fontes: ["Custo: 1 item cotado em 1 cotação"],
  faltando: ["Cote um segundo fornecedor para comparar o custo"],
};

function fornecedor(nome: string, categorias: string, ativo = true): Fornecedor {
  return { id: nome, nome, cnpj: null, contato: "Fulano", telefone: "21999990000", email: "a@b.com", site: "", categorias, observacao: "", ativo };
}

function entrada(extra: Partial<EntradaContexto> = {}): EntradaContexto {
  return {
    item: ITEM,
    perfil: PERFIL,
    preco: PRECO,
    cotacoes: null,
    ficha: null,
    itensCompra: null,
    totalItensCompra: 0,
    fornecedores: [],
    excecoesPregao: ["suporte gerenciado"],
    ...extra,
  };
}

describe("fornecedoresDoObjeto", () => {
  const lista = [
    fornecedor("Revenda Soft", "software, licenças, nuvem"),
    fornecedor("Papelaria Central", "papel, canetas"),
    fornecedor("Antiga Soft", "software", false),
    fornecedor("Sem categoria", ""),
  ];

  it("casa por palavra da categoria, com plural e sem acento", () => {
    const achados = fornecedoresDoObjeto(lista, "Aquisição de licença Zoom por 24 meses");
    expect(achados.map((f) => f.nome)).toEqual(["Revenda Soft"]);
  });

  it("ignora inativos, categorias vazias e palavras genéricas", () => {
    expect(fornecedoresDoObjeto(lista, "Serviços de software").map((f) => f.nome)).toEqual(["Revenda Soft"]);
    expect(fornecedoresDoObjeto([fornecedor("Geral", "serviços, material")], "Serviços de limpeza")).toEqual([]);
  });
});

describe("montarContexto", () => {
  it("traz item, preço do sistema, perfil e fornecedores que casam", () => {
    const c = montarContexto(entrada({ fornecedores: [fornecedor("Revenda Soft", "licenças"), fornecedor("Papelaria", "papel")] }));
    expect(c.texto).toContain("Aquisição de licenças Zoom Workplace Pro por 24 meses");
    expect(c.texto).toContain("Prefeitura de Teste");
    expect(c.texto).toContain("Nova Iguaçu/RJ");
    expect(c.texto).toContain("Pregão - Eletrônico");
    expect(c.texto).toContain("PREÇO SUGERIDO PELO SISTEMA");
    expect(c.texto).toMatch(/Preço sugerido: R\$\s95\.000,50/);
    expect(c.texto).toContain("Revenda Soft");
    expect(c.texto).not.toContain("Papelaria");
    expect(c.texto).not.toContain("21999990000");
    expect(c.texto).toContain("Empresa de Teste LTDA");
    expect(c.fornecedores.map((f) => f.nome)).toEqual(["Revenda Soft"]);
  });

  it("entrega ao conferidor todos os valores em reais do sistema", () => {
    const c = montarContexto(entrada());
    expect(c.valoresPermitidos).toEqual(expect.arrayContaining([120000, 80000, 95000.5, 114000, 70000, 14000]));
  });

  it("pregão sem exceção sai marcado como fora do foco; com exceção, não", () => {
    const fora = montarContexto(entrada());
    expect(fora.pregao.foraDoFoco).toBe(true);
    expect(fora.texto).toContain("foraDoFoco = true");
    const com = montarContexto(entrada({ item: { ...ITEM, objeto: "Suporte gerenciado de TI" } }));
    expect(com.pregao).toMatchObject({ ehPregao: true, foraDoFoco: false, excecao: "suporte gerenciado" });
    expect(com.texto).toContain("foraDoFoco = false");
  });

  it("sem preço calculado, avisa e não inventa número", () => {
    const c = montarContexto(entrada({ preco: null }));
    expect(c.texto).toContain("ainda não calculou o preço sugerido");
    expect(c.valoresPermitidos).toEqual([120000]);
  });

  it("inclui a ficha do edital e os itens da compra só quando existem, com limite", () => {
    expect(montarContexto(entrada()).texto).not.toContain("FICHA DO EDITAL");
    expect(montarContexto(entrada()).texto).not.toContain("ITENS DA COMPRA");
    const itens: ItemCompra[] = Array.from({ length: MAX_ITENS_NO_CONTEXTO + 5 }, (_, i) => ({
      numero: i + 1,
      descricao: `Licença ${i + 1}`,
      tipo: "Serviço",
      quantidade: 10,
      unidade: "UN",
      valorUnitarioEstimado: 100,
      valorTotalEstimado: 1000,
      beneficio: null,
      exclusivoMeEpp: false,
      criterioJulgamento: null,
      situacao: null,
      sigiloso: false,
    }));
    const c = montarContexto(entrada({ ficha: FICHA_EXEMPLO, itensCompra: itens, totalItensCompra: itens.length }));
    expect(c.texto).toContain("FICHA DO EDITAL");
    expect(c.texto).toContain(`ITENS DA COMPRA (${MAX_ITENS_NO_CONTEXTO} de ${itens.length})`);
    expect(c.texto).toContain("Item 1:");
    expect(c.texto).not.toContain(`Item ${MAX_ITENS_NO_CONTEXTO + 1}:`);
    expect(c.texto).toContain("Mais 5 itens não listados");
  });
});
