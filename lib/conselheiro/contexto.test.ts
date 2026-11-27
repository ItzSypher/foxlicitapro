import { describe, expect, it } from "vitest";
import { FICHA_EXEMPLO } from "@/core/ficha.fixture";
import type { DocumentoAcervo } from "@/core/acervo";
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

  it("pregão sem exceção, sem foco e sem CNAE casado sai marcado como fora do foco; com exceção, não", () => {
    const semCasamento = { ...ITEM, score: { ...ITEM.score, cnaesCasados: [], frenteCasada: null } };
    const fora = montarContexto(entrada({ item: semCasamento }));
    expect(fora.pregao.foraDoFoco).toBe(true);
    expect(fora.texto).toContain("foraDoFoco = true");
    const com = montarContexto(entrada({ item: { ...semCasamento, objeto: "Suporte gerenciado de TI" } }));
    expect(com.pregao).toMatchObject({ ehPregao: true, foraDoFoco: false, excecao: "suporte gerenciado" });
    expect(com.texto).toContain("foraDoFoco = false");
  });

  it("pregão que casa com o foco ou com o CNAE da empresa não é fora do foco", () => {
    const porCnae = montarContexto(entrada());
    expect(porCnae.pregao).toMatchObject({ ehPregao: true, foraDoFoco: false });
    expect(porCnae.texto).toContain("foraDoFoco = false");
    expect(porCnae.texto).toContain("a atividade (CNAE) da empresa");
    const semCasamento = { ...ITEM, objeto: "Desenvolvimento de site institucional", score: { ...ITEM.score, cnaesCasados: [], frenteCasada: null } };
    const porFoco = montarContexto(entrada({ item: semCasamento, perfil: { ...PERFIL, foco: ["site"] } }));
    expect(porFoco.pregao).toMatchObject({ foraDoFoco: false, casouFoco: "site" });
    expect(porFoco.texto).toContain('o foco "site"');
    expect(porFoco.texto).toContain("Foco da empresa: site.");
    const fora = montarContexto(entrada({ item: { ...semCasamento, objeto: "Compra de mesas" } }));
    expect(fora.pregao.foraDoFoco).toBe(true);
    expect(fora.texto).toContain("não reprove só por ser pregão");
  });

  it("traz o bloco de site, sistema e software com os números só para objeto de desenvolvimento", () => {
    expect(montarContexto(entrada()).texto).not.toContain("SITE, SISTEMA E SOFTWARE");
    const site = { ...ITEM, objeto: "Desenvolvimento e manutenção de site institucional", valorEstimado: 60000 };
    const c = montarContexto(
      entrada({
        item: site,
        preco: { ...PRECO, alvo: 48000, sugerido: 48000, custoTotal: 0 },
        software: { terceirizavel: true, devCusto: 10000, devParcelas: 4, contratoMeses: 12, comissaoPercentual: 10, precoLance: null, precoLanceMax: null, horasMes: null },
      }),
    );
    expect(c.texto).toContain("SITE, SISTEMA E SOFTWARE");
    expect(c.texto).toMatch(/mínimo de R\$\s3\.500,00 por mês/);
    expect(c.texto).toMatch(/hora técnica de R\$\s175,00/);
    // 48.000 x (1 - 10% - 50%) = 19.200
    expect(c.texto).toMatch(/Teto do dev .*: R\$\s19\.200,00/);
    expect(c.texto).toMatch(/Dev combinado: R\$\s10\.000,00 em 4 parcelas/);
    expect(c.texto).toContain("Veredito do sistema (conta de software): VALE");
    expect(c.texto).toContain("Preço mínimo");
    expect(c.texto).toContain("Folga até o valor estimado");
    expect(c.valoresPermitidos).toEqual(expect.arrayContaining([3500, 175, 19200, 10000, 4000, 4800]));
    expect(c.resultadoPositivo).toBe(true);
  });

  it("conta de software que reprova derruba o resultado positivo e explica o motivo", () => {
    const site = { ...ITEM, objeto: "Criação de site", valorEstimado: 30000 };
    const c = montarContexto(
      entrada({
        item: site,
        preco: { ...PRECO, alvo: 30000, sugerido: 30000, custoTotal: 0 },
        software: { terceirizavel: true, devCusto: 20000, devParcelas: 1, contratoMeses: 12, comissaoPercentual: null, precoLance: null, precoLanceMax: null, horasMes: null },
      }),
    );
    expect(c.texto).toContain("NÃO VALE");
    expect(c.texto).toContain("ABAIXO do mínimo");
    expect(c.resultadoPositivo).toBe(false);
  });

  it("traz o acervo com tipo, título e se casa com o objeto, até 10 linhas", () => {
    expect(montarContexto(entrada()).texto).not.toContain("ACERVO DA EMPRESA");
    const doc = (i: number, titulo: string, areas: string[]): DocumentoAcervo => ({
      id: `d${i}`,
      tipo: "atestado",
      titulo,
      emissor: `Cliente ${i}`,
      emissorCnpj: null,
      descricao: "",
      areas,
      valor: null,
      periodoInicio: null,
      periodoFim: null,
      emitidoEm: null,
      validade: null,
      arquivoTipo: null,
      arquivoNome: null,
      arquivoTamanho: null,
      atestadoId: null,
      criadoEm: `2026-01-${String(i + 10)}T00:00:00.000Z`,
    });
    const docs = [doc(1, "Atestado de desenvolvimento de site", ["site"]), ...Array.from({ length: 12 }, (_, i) => doc(i + 2, `Certidão ${i}`, []))];
    const site = { ...ITEM, objeto: "Criação de site institucional" };
    const c = montarContexto(entrada({ item: site, acervo: docs, atestados: [] }));
    expect(c.texto).toContain("ACERVO DA EMPRESA");
    expect(c.texto).toContain("Atestado: Atestado de desenvolvimento de site; cliente/emissor: Cliente 1; casa com o objeto");
    expect(c.texto).toContain("não parece casar com o objeto");
    const bloco = c.texto.split("ACERVO DA EMPRESA")[1].split("\n\n")[0];
    expect(bloco.split("\n").filter((l) => l.startsWith("- Atestado")).length).toBeLessThanOrEqual(10);
    expect(bloco).toContain("Mais 3 documentos não listados");
    const vazio = montarContexto(entrada({ acervo: [], atestados: [] }));
    expect(vazio.texto).toContain("não tem documento nem atestado");
    expect(vazio.texto).toContain("gerador de atestados");
  });

  it("atestado gerado no sistema entra no acervo sem duplicar o que já está lá", () => {
    const site = { ...ITEM, objeto: "Criação de site institucional" };
    const atestado = { id: "a1", clienteNome: "Clínica Sol", objeto: "Desenvolvimento de site institucional", areas: ["site"], valor: 5000, periodoInicio: null, periodoFim: null, status: "aguardando" };
    const c = montarContexto(entrada({ item: site, acervo: [], atestados: [atestado] }));
    expect(c.texto).toContain("cliente/emissor: Clínica Sol");
    expect(c.texto).toContain("situação: aguardando");
    expect(c.texto.match(/Clínica Sol/g)).toHaveLength(1);
  });

  it("sem preço calculado, avisa e não inventa número", () => {
    const c = montarContexto(entrada({ preco: null }));
    expect(c.texto).toContain("ainda não calculou o preço sugerido");
    // Sem preço sugerido, o lucro × prejuízo sai do valor estimado e do custo estimado pelo tipo do objeto.
    expect(c.valoresPermitidos[0]).toBe(120000);
    expect(c.texto).toContain("LUCRO × PREJUÍZO");
    expect(c.texto).toContain("Receita considerada (valor estimado)");
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
