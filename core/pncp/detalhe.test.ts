import { describe, expect, it, vi } from "vitest";
import { buscarDetalheCompra, normalizarArquivos, normalizarItens } from "./detalhe";

/** Amostras reais do PNCP (IFF Campos, dispensa 235/2026; Campos dos Goytacazes, pregão 34/2026), descrições abreviadas. */
const COMPRA_REAL = {
  valorTotalEstimado: 9399.52,
  valorTotalHomologado: null,
  orcamentoSigilosoCodigo: 1,
  orcamentoSigilosoDescricao: "Compra sem sigilo",
  numeroControlePNCP: "10779511000107-1-000235/2026",
  linkSistemaOrigem:
    "https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=15813906004282026",
  linkProcessoEletronico: "https://suap.iff.edu.br/processo_eletronico/processo/258910/",
  anoCompra: 2026,
  sequencialCompra: 235,
  numeroCompra: "428",
  processo: "158139",
  orgaoEntidade: {
    cnpj: "10779511000107",
    razaoSocial: "INSTITUTO FEDERAL DE EDUCACAO, CIENCIA E TECNOLOGIA FLUMINENSE.",
    poderId: "E",
    esferaId: "F",
  },
  unidadeOrgao: {
    ufNome: "Rio de Janeiro",
    municipioNome: "Campos dos Goytacazes",
    ufSigla: "RJ",
    codigoIbge: "3301009",
    codigoUnidade: "158139",
    nomeUnidade: "INST.FED.DE EDUC.,CIENC.E TEC.FLUMINENSE",
  },
  modalidadeId: 8,
  modalidadeNome: "Dispensa",
  modoDisputaId: 4,
  modoDisputaNome: "Dispensa Com Disputa",
  amparoLegal: {
    nome: "Lei 14.133/2021, Art. 75, II",
    descricao: "Dispensa de Licitação: para contratação que envolva valores inferiores a R$ 50.000,00",
    codigo: 19,
  },
  objetoCompra:
    "Aquisição de gases especiais e industriais, incluindo a realização de testes hidrostáticos e a requalificação de cilindros",
  informacaoComplementar: null,
  srp: false,
  dataPublicacaoPncp: "2026-10-30T11:48:04",
  dataAberturaProposta: "2026-11-09T08:00:00",
  dataEncerramentoProposta: "2026-11-16T08:00:00",
  situacaoCompraId: 1,
  situacaoCompraNome: "Divulgada no PNCP",
  dataAtualizacao: "2026-10-30T11:48:04",
  dataAtualizacaoGlobal: "2026-10-30T11:49:08",
};

const ITEM_EXCLUSIVO = {
  numeroItem: 1,
  descricao: "Gás Comprimido nome: oxigênio,   aspecto físico: incolor, inodoro. OBS: 02 recargas de cilindros de 10m³",
  materialOuServico: "M",
  materialOuServicoNome: "Material",
  valorUnitarioEstimado: 26.0,
  valorTotal: 520.0,
  quantidade: 20.0,
  unidadeMedida: "Metro Cúbico",
  orcamentoSigiloso: false,
  criterioJulgamentoId: 1,
  criterioJulgamentoNome: "Menor preço",
  situacaoCompraItem: 1,
  situacaoCompraItemNome: "Em andamento",
  tipoBeneficio: 1,
  tipoBeneficioNome: "Participação exclusiva para ME/EPP",
};

const ITEM_SEM_BENEFICIO = {
  numeroItem: 2,
  descricao: "Serviços de engenharia para manutenção preventiva e corretiva",
  materialOuServico: "S",
  materialOuServicoNome: "Serviço",
  valorUnitarioEstimado: 117118.11,
  valorTotal: 117118.11,
  quantidade: 1.0,
  unidadeMedida: "UNIDADE",
  orcamentoSigiloso: false,
  criterioJulgamentoNome: "Menor preço",
  situacaoCompraItemNome: "Em andamento",
  tipoBeneficio: 5,
  tipoBeneficioNome: "Não se aplica",
};

/** Pregão com orçamento sigiloso: a API manda valores 0. */
const ITEM_SIGILOSO = {
  numeroItem: 3,
  descricao: "Bebedouro vertical elétrico",
  materialOuServicoNome: "Material",
  valorUnitarioEstimado: 0,
  valorTotal: 0,
  quantidade: 4,
  unidadeMedida: "UND",
  orcamentoSigiloso: true,
  criterioJulgamentoNome: "Menor preço",
  situacaoCompraItemNome: "Em andamento",
  tipoBeneficio: 4,
  tipoBeneficioNome: "Sem benefício",
};

const ARQUIVOS_REAIS = [
  {
    uri: "https://pncp.gov.br/pncp-api/v1/orgaos/10779511000107/compras/2026/235/arquivos/3",
    url: "https://pncp.gov.br/pncp-api/v1/orgaos/10779511000107/compras/2026/235/arquivos/3",
    statusAtivo: true,
    cnpj: "10779511000107",
    anoCompra: 2026,
    sequencialCompra: 235,
    dataPublicacaoPncp: "2026-10-30T11:49:06",
    sequencialDocumento: 3,
    titulo: "Termo de Referencia 105-2026.pdf",
    tipoDocumentoNome: "Termo de Referência",
    tipoDocumentoDescricao: "Termo de Referência",
    tipoDocumentoId: 4,
  },
  {
    uri: "https://pncp.gov.br/pncp-api/v1/orgaos/10779511000107/compras/2026/235/arquivos/1",
    url: "https://pncp.gov.br/pncp-api/v1/orgaos/10779511000107/compras/2026/235/arquivos/1",
    statusAtivo: true,
    dataPublicacaoPncp: "2026-10-30T11:48:04",
    sequencialDocumento: 1,
    titulo: "Estudo Tecnico Preliminar 145-2026.pdf",
    tipoDocumentoNome: "Estudo Técnico Preliminar",
  },
];

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
}

const CHAVE = { cnpj: "10779511000107", ano: 2026, sequencial: 235 };

/** Fetch falso que responde cada rota; `falhar` troca a resposta de uma parte. */
function fetchFalso(falhar: { itens?: number; arquivos?: number; geral?: number } = {}) {
  return vi.fn(async (entrada: string | URL | Request) => {
    const url = String(entrada);
    if (url.includes("/itens/quantidade")) return falhar.itens ? new Response("x", { status: falhar.itens }) : new Response("2");
    if (url.includes("/itens?")) return json([ITEM_EXCLUSIVO, ITEM_SEM_BENEFICIO]);
    if (url.endsWith("/arquivos")) return falhar.arquivos ? new Response("x", { status: falhar.arquivos }) : json(ARQUIVOS_REAIS);
    if (falhar.geral) return new Response("x", { status: falhar.geral });
    return json(COMPRA_REAL);
  });
}

describe("normalizarItens", () => {
  it("normaliza item exclusivo ME/EPP e limpa espaços", () => {
    const [item] = normalizarItens([ITEM_EXCLUSIVO]);
    expect(item).toMatchObject({
      numero: 1,
      tipo: "Material",
      quantidade: 20,
      unidade: "Metro Cúbico",
      valorUnitarioEstimado: 26,
      valorTotalEstimado: 520,
      beneficio: "Participação exclusiva para ME/EPP",
      exclusivoMeEpp: true,
      criterioJulgamento: "Menor preço",
      sigiloso: false,
    });
    expect(item?.descricao).toBe("Gás Comprimido nome: oxigênio, aspecto físico: incolor, inodoro. OBS: 02 recargas de cilindros de 10m³");
  });

  it("trata 'Não se aplica' e 'Sem benefício' como sem benefício", () => {
    const itens = normalizarItens([ITEM_SEM_BENEFICIO, ITEM_SIGILOSO]);
    expect(itens.map((i) => i.beneficio)).toEqual([null, null]);
    expect(itens.map((i) => i.exclusivoMeEpp)).toEqual([false, false]);
  });

  it("orçamento sigiloso zera valores para null", () => {
    const [item] = normalizarItens([ITEM_SIGILOSO]);
    expect(item).toMatchObject({ sigiloso: true, valorUnitarioEstimado: null, valorTotalEstimado: null, quantidade: 4 });
  });

  it("calcula o total quando a API não manda", () => {
    const [item] = normalizarItens([{ ...ITEM_EXCLUSIVO, valorTotal: null }]);
    expect(item?.valorTotalEstimado).toBe(520);
  });

  it("descarta item inválido sem derrubar os outros e ordena pelo número", () => {
    const itens = normalizarItens([ITEM_SEM_BENEFICIO, { lixo: true }, ITEM_EXCLUSIVO]);
    expect(itens.map((i) => i.numero)).toEqual([1, 2]);
  });
});

describe("normalizarArquivos", () => {
  it("usa o campo url, mantém o tipo e a data com fuso de Brasília", () => {
    const arquivos = normalizarArquivos(ARQUIVOS_REAIS);
    expect(arquivos.map((a) => a.sequencial)).toEqual([1, 3]);
    expect(arquivos[1]).toEqual({
      sequencial: 3,
      titulo: "Termo de Referencia 105-2026.pdf",
      tipo: "Termo de Referência",
      url: "https://pncp.gov.br/pncp-api/v1/orgaos/10779511000107/compras/2026/235/arquivos/3",
      publicadoEm: "2026-10-30T11:49:06-03:00",
    });
  });

  it("rejeita url que não é https e arquivo inativo", () => {
    const base = ARQUIVOS_REAIS[0];
    const arquivos = normalizarArquivos([
      { ...base, url: "http://exemplo.com/a.pdf", uri: null },
      { ...base, url: "javascript:alert(1)", uri: null },
      { ...base, statusAtivo: false },
    ]);
    expect(arquivos).toEqual([]);
  });
});

describe("buscarDetalheCompra", () => {
  it("monta o detalhe completo", async () => {
    const fetchImpl = fetchFalso();
    const d = await buscarDetalheCompra(CHAVE, { fetchImpl, esperaRetryMs: 0 });
    expect(d).not.toBeNull();
    expect(d).toMatchObject({
      numeroControle: "10779511000107-1-000235/2026",
      numeroCompra: "428",
      processo: "158139",
      modalidadeId: 8,
      modoDisputa: "Dispensa Com Disputa",
      amparoLegal: "Lei 14.133/2021, Art. 75, II",
      situacao: "Divulgada no PNCP",
      srp: false,
      orgaoCnpj: "10779511000107",
      municipio: "Campos dos Goytacazes",
      uf: "RJ",
      codigoIbge: "3301009",
      valorEstimado: 9399.52,
      valorHomologado: null,
      dataAbertura: "2026-11-09T08:00:00-03:00",
      dataEncerramento: "2026-11-16T08:00:00-03:00",
      dataAtualizacao: "2026-10-30T11:49:08-03:00",
      linkPncp: "https://pncp.gov.br/app/editais/10779511000107/2026/235",
      totalItens: 2,
      falhas: [],
    });
    expect(d?.linkOrigem).toContain("comprasnet-web");
    expect(d?.linkProcesso).toBe("https://suap.iff.edu.br/processo_eletronico/processo/258910/");
    expect(d?.itens).toHaveLength(2);
    expect(d?.arquivos).toHaveLength(2);
  });

  it("devolve null quando a contratação não existe (404 nas duas rotas)", async () => {
    const fetchImpl = vi.fn(async () => json({ status: "404" }, 404));
    const d = await buscarDetalheCompra(CHAVE, { fetchImpl, esperaRetryMs: 0 });
    expect(d).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("lança erro quando os dados gerais falham", async () => {
    const fetchImpl = fetchFalso({ geral: 500 });
    await expect(buscarDetalheCompra(CHAVE, { fetchImpl, esperaRetryMs: 0 })).rejects.toThrow();
  });

  it("falha nos itens vira aviso e a tela segue com os arquivos", async () => {
    const fetchImpl = fetchFalso({ itens: 500 });
    const d = await buscarDetalheCompra(CHAVE, { fetchImpl, esperaRetryMs: 0 });
    expect(d?.falhas).toEqual(["itens"]);
    expect(d?.itens).toEqual([]);
    expect(d?.totalItens).toBe(0);
    expect(d?.arquivos).toHaveLength(2);
  });

  it("falha nos arquivos vira aviso e a tela segue com os itens", async () => {
    const fetchImpl = fetchFalso({ arquivos: 503 });
    const d = await buscarDetalheCompra(CHAVE, { fetchImpl, esperaRetryMs: 0 });
    expect(d?.falhas).toEqual(["arquivos"]);
    expect(d?.arquivos).toEqual([]);
    expect(d?.itens).toHaveLength(2);
  });

  it("tenta de novo uma vez quando o PNCP responde 429", async () => {
    let chamadas = 0;
    const fetchImpl = vi.fn(async (entrada: string | URL | Request) => {
      const url = String(entrada);
      if (url.includes("/itens/quantidade")) return new Response("0");
      if (url.endsWith("/arquivos")) return json([]);
      chamadas += 1;
      return chamadas === 1 ? new Response("x", { status: 429 }) : json(COMPRA_REAL);
    });
    const d = await buscarDetalheCompra(CHAVE, { fetchImpl, esperaRetryMs: 0 });
    expect(d?.numeroControle).toBe("10779511000107-1-000235/2026");
    expect(chamadas).toBe(2);
  });

  it("pagina até 4 páginas de 50 itens", async () => {
    const paginas: string[] = [];
    const fetchImpl = vi.fn(async (entrada: string | URL | Request) => {
      const url = String(entrada);
      if (url.includes("/itens/quantidade")) return new Response("512");
      if (url.includes("/itens?")) {
        const pagina = new URL(url).searchParams.get("pagina") ?? "";
        paginas.push(pagina);
        const n = (Number(pagina) - 1) * 50;
        return json(Array.from({ length: 50 }, (_, i) => ({ ...ITEM_EXCLUSIVO, numeroItem: n + i + 1 })));
      }
      if (url.endsWith("/arquivos")) return json([]);
      return json(COMPRA_REAL);
    });
    const d = await buscarDetalheCompra(CHAVE, { fetchImpl, esperaRetryMs: 0 });
    expect(paginas).toEqual(["1", "2", "3", "4"]);
    expect(d?.itens).toHaveLength(200);
    expect(d?.totalItens).toBe(512);
  });

  it("valor 0 ou orçamento sigiloso vira valor estimado null", async () => {
    const fetchImpl = vi.fn(async (entrada: string | URL | Request) => {
      const url = String(entrada);
      if (url.includes("/itens/quantidade")) return new Response("0");
      if (url.endsWith("/arquivos")) return json([]);
      return json({ ...COMPRA_REAL, valorTotalEstimado: 0, orcamentoSigilosoCodigo: 3 });
    });
    const d = await buscarDetalheCompra(CHAVE, { fetchImpl, esperaRetryMs: 0 });
    expect(d?.valorEstimado).toBeNull();
  });
});
