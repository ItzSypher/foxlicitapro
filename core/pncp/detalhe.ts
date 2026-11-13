import type { ArquivoCompra, ChaveCompra, DetalheCompra, ItemCompra } from "../types-detalhe";
import { ErroPncp } from "./client";
import {
  arquivoSchema,
  compraSchema,
  itemSchema,
  listaSchema,
  type CompraPncp,
  type ItemPncp,
} from "./detalhe-schema";
import { paraIsoBrasilia } from "./normalize";

const URL_CONSULTA = "https://pncp.gov.br/api/consulta/v1/orgaos";
const URL_PNCP = "https://pncp.gov.br/api/pncp/v1/orgaos";
const TIMEOUT_MS = 8000;
const REVALIDAR_SEGUNDOS = 900;
const ESPERA_RETRY_MS = 800;
const POR_PAGINA = 50;
const MAX_PAGINAS = 4;
const STATUS_COM_RETRY: ReadonlySet<number> = new Set([429, 500, 502, 503, 504]);

/** tipoBeneficio 1 = participação exclusiva para ME/EPP */
const BENEFICIO_EXCLUSIVO_ME_EPP = 1;
/** 4 = sem benefício; 5 = não se aplica: nada a mostrar */
const BENEFICIOS_VAZIOS: ReadonlySet<number> = new Set([4, 5]);

export interface OpcoesDetalhe {
  /** Permite trocar o fetch nos testes */
  fetchImpl?: typeof fetch;
  /** Espera antes da nova tentativa em 429/5xx; 0 nos testes */
  esperaRetryMs?: number;
}

type Config = Required<OpcoesDetalhe>;
type Resultado = { ok: true; valor: unknown } | { ok: false; status: number | null };

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

/** Uma chamada com timeout de 8 s e 1 nova tentativa em 429, 5xx ou falha de rede. */
async function chamar(url: string, config: Config): Promise<Response> {
  for (let tentativa = 0; ; tentativa += 1) {
    const ultima = tentativa >= 1;
    try {
      const r = await config.fetchImpl(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        next: { revalidate: REVALIDAR_SEGUNDOS },
      });
      if (!ultima && STATUS_COM_RETRY.has(r.status)) {
        await esperar(config.esperaRetryMs);
        continue;
      }
      return r;
    } catch (e) {
      if (ultima) throw e;
      await esperar(config.esperaRetryMs);
    }
  }
}

async function lerJson(url: string, config: Config): Promise<Resultado> {
  try {
    const r = await chamar(url, config);
    if (!r.ok) return { ok: false, status: r.status };
    return { ok: true, valor: (await r.json()) as unknown };
  } catch {
    return { ok: false, status: null };
  }
}

function limpar(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\s+/g, " ").trim();
}

function ouNulo(valor: string | null | undefined): string | null {
  const t = limpar(valor);
  return t === "" ? null : t;
}

/** Só aceita endereços https (ou http quando permitido); qualquer outro esquema vira null. */
function linkSeguro(valor: string | null | undefined, apenasHttps: boolean): string | null {
  const t = ouNulo(valor);
  if (t === null) return null;
  try {
    const u = new URL(t);
    if (u.protocol === "https:" || (!apenasHttps && u.protocol === "http:")) return u.toString();
  } catch {
    return null;
  }
  return null;
}

function valorPositivo(v: number | null | undefined): number | null {
  return typeof v === "number" && v > 0 ? v : null;
}

export function normalizarItem(bruto: ItemPncp): ItemCompra {
  const sigiloso = bruto.orcamentoSigiloso === true;
  const quantidade = typeof bruto.quantidade === "number" ? bruto.quantidade : null;
  const unitario = sigiloso ? null : valorPositivo(bruto.valorUnitarioEstimado);
  let total = sigiloso ? null : valorPositivo(bruto.valorTotal);
  if (total === null && unitario !== null && quantidade !== null) {
    total = Math.round(unitario * quantidade * 100) / 100;
  }
  const nomeBeneficio = ouNulo(bruto.tipoBeneficioNome);
  const idBeneficio = bruto.tipoBeneficio ?? null;
  const exclusivo =
    idBeneficio === BENEFICIO_EXCLUSIVO_ME_EPP ||
    (idBeneficio === null &&
      nomeBeneficio !== null &&
      /exclusiv/i.test(nomeBeneficio) &&
      /ME\/?EPP/i.test(nomeBeneficio));
  const semBeneficio = idBeneficio !== null && BENEFICIOS_VAZIOS.has(idBeneficio);
  return {
    numero: bruto.numeroItem,
    descricao: limpar(bruto.descricao),
    tipo: ouNulo(bruto.materialOuServicoNome),
    quantidade,
    unidade: ouNulo(bruto.unidadeMedida),
    valorUnitarioEstimado: unitario,
    valorTotalEstimado: total,
    beneficio: semBeneficio ? null : nomeBeneficio,
    exclusivoMeEpp: exclusivo,
    criterioJulgamento: ouNulo(bruto.criterioJulgamentoNome),
    situacao: ouNulo(bruto.situacaoCompraItemNome),
    sigiloso,
  };
}

/** Valida cada item sozinho, descarta os inválidos e ordena pelo número. */
export function normalizarItens(lista: readonly unknown[]): ItemCompra[] {
  const itens: ItemCompra[] = [];
  for (const bruto of lista) {
    const lido = itemSchema.safeParse(bruto);
    if (lido.success) itens.push(normalizarItem(lido.data));
  }
  return itens.sort((a, b) => a.numero - b.numero);
}

export function normalizarArquivos(lista: readonly unknown[]): ArquivoCompra[] {
  const arquivos: ArquivoCompra[] = [];
  for (const bruto of lista) {
    const lido = arquivoSchema.safeParse(bruto);
    if (!lido.success) continue;
    const a = lido.data;
    if (a.statusAtivo === false) continue;
    const url = linkSeguro(a.url ?? a.uri, true);
    if (url === null) continue;
    arquivos.push({
      sequencial: a.sequencialDocumento,
      titulo: ouNulo(a.titulo) ?? `Documento ${a.sequencialDocumento}`,
      tipo: ouNulo(a.tipoDocumentoNome),
      url,
      publicadoEm: paraIsoBrasilia(a.dataPublicacaoPncp),
    });
  }
  return arquivos.sort((a, b) => a.sequencial - b.sequencial);
}

function montarDetalhe(
  chave: ChaveCompra,
  c: CompraPncp,
  itens: ItemCompra[],
  totalItens: number,
  arquivos: ArquivoCompra[],
  falhas: DetalheCompra["falhas"],
): DetalheCompra {
  const sigiloso =
    c.orcamentoSigilosoCodigo !== null &&
    c.orcamentoSigilosoCodigo !== undefined &&
    c.orcamentoSigilosoCodigo !== 0 &&
    c.orcamentoSigilosoCodigo !== 1;
  return {
    chave,
    numeroControle: c.numeroControlePNCP,
    numeroCompra: ouNulo(c.numeroCompra),
    processo: ouNulo(c.processo),
    objeto: limpar(c.objetoCompra),
    informacaoComplementar: ouNulo(c.informacaoComplementar),
    modalidadeId: c.modalidadeId,
    modalidadeNome: limpar(c.modalidadeNome) || "Modalidade não informada",
    modoDisputa: ouNulo(c.modoDisputaNome),
    amparoLegal: ouNulo(c.amparoLegal?.nome),
    situacao: ouNulo(c.situacaoCompraNome),
    srp: c.srp === true,
    orgao: limpar(c.orgaoEntidade.razaoSocial),
    orgaoCnpj: c.orgaoEntidade.cnpj,
    unidade: limpar(c.unidadeOrgao.nomeUnidade),
    municipio: limpar(c.unidadeOrgao.municipioNome),
    uf: limpar(c.unidadeOrgao.ufSigla).toUpperCase(),
    codigoIbge: String(c.unidadeOrgao.codigoIbge ?? "").trim(),
    valorEstimado: sigiloso ? null : valorPositivo(c.valorTotalEstimado),
    valorHomologado: valorPositivo(c.valorTotalHomologado),
    dataInclusao: paraIsoBrasilia(c.dataInclusao),
    dataPublicacao: paraIsoBrasilia(c.dataPublicacaoPncp),
    dataAbertura: paraIsoBrasilia(c.dataAberturaProposta),
    dataEncerramento: paraIsoBrasilia(c.dataEncerramentoProposta),
    dataAtualizacao: paraIsoBrasilia(c.dataAtualizacaoGlobal ?? c.dataAtualizacao),
    linkPncp: `https://pncp.gov.br/app/editais/${chave.cnpj}/${chave.ano}/${chave.sequencial}`,
    linkOrigem: linkSeguro(c.linkSistemaOrigem, false),
    linkProcesso: linkSeguro(c.linkProcessoEletronico, false),
    itens,
    totalItens,
    arquivos,
    falhas,
  };
}

async function buscarGeral(base: string, config: Config): Promise<CompraPncp | null> {
  let resposta = await lerJson(`${URL_CONSULTA}/${base}`, config);
  if (!resposta.ok && resposta.status === 404) {
    resposta = await lerJson(`${URL_PNCP}/${base}`, config);
    if (!resposta.ok && (resposta.status === 404 || resposta.status === 301)) return null;
  }
  if (!resposta.ok) {
    throw new ErroPncp("O PNCP não respondeu os dados da contratação", resposta.status ?? undefined);
  }
  const lido = compraSchema.safeParse(resposta.valor);
  if (!lido.success) throw new ErroPncp("Resposta do PNCP fora do formato esperado");
  return lido.data;
}

interface ItensLidos {
  itens: ItemCompra[];
  total: number;
}

/** Lê a contagem e depois até 4 páginas de 50 itens, em série. Lança erro se algo falhar. */
async function buscarItens(base: string, config: Config): Promise<ItensLidos> {
  const qtd = await chamar(`${URL_PNCP}/${base}/itens/quantidade`, config);
  if (!qtd.ok) throw new ErroPncp("Falha na contagem de itens", qtd.status);
  const total = Number.parseInt((await qtd.text()).trim(), 10);
  if (!Number.isInteger(total) || total < 0) throw new ErroPncp("Contagem de itens inválida");
  if (total === 0) return { itens: [], total: 0 };

  const paginas = Math.min(MAX_PAGINAS, Math.ceil(total / POR_PAGINA));
  const itens: ItemCompra[] = [];
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    const r = await lerJson(`${URL_PNCP}/${base}/itens?pagina=${pagina}&tamanhoPagina=${POR_PAGINA}`, config);
    if (!r.ok) throw new ErroPncp("Falha ao ler os itens", r.status ?? undefined);
    const lista = listaSchema.safeParse(r.valor);
    if (!lista.success) throw new ErroPncp("Itens fora do formato esperado");
    if (lista.data.length === 0) break;
    itens.push(...normalizarItens(lista.data));
  }
  return { itens, total };
}

async function buscarArquivos(base: string, config: Config): Promise<ArquivoCompra[]> {
  const r = await lerJson(`${URL_PNCP}/${base}/arquivos`, config);
  if (!r.ok) throw new ErroPncp("Falha ao ler os arquivos", r.status ?? undefined);
  const lista = listaSchema.safeParse(r.valor);
  if (!lista.success) throw new ErroPncp("Arquivos fora do formato esperado");
  return normalizarArquivos(lista.data);
}

/**
 * Busca no PNCP tudo sobre uma contratação: dados gerais, itens e arquivos.
 * Assinatura fixa: a tela de licitação e o módulo de propostas dependem dela
 * (o segundo parâmetro é opcional e serve aos testes).
 * Devolve null quando a contratação não existe. Dados gerais falhando lança erro;
 * itens ou arquivos falhando entram em `falhas` e o resto segue.
 */
export async function buscarDetalheCompra(
  chave: ChaveCompra,
  opcoes: OpcoesDetalhe = {},
): Promise<DetalheCompra | null> {
  const config: Config = {
    fetchImpl: opcoes.fetchImpl ?? fetch,
    esperaRetryMs: opcoes.esperaRetryMs ?? ESPERA_RETRY_MS,
  };
  const base = `${chave.cnpj}/compras/${chave.ano}/${chave.sequencial}`;

  const geral = await buscarGeral(base, config);
  if (geral === null) return null;

  // No máximo 2 chamadas ao mesmo tempo: itens (em série) e arquivos.
  const [itensR, arquivosR] = await Promise.allSettled([buscarItens(base, config), buscarArquivos(base, config)]);
  const falhas: DetalheCompra["falhas"] = [];
  if (itensR.status === "rejected") falhas.push("itens");
  if (arquivosR.status === "rejected") falhas.push("arquivos");

  return montarDetalhe(
    chave,
    geral,
    itensR.status === "fulfilled" ? itensR.value.itens : [],
    itensR.status === "fulfilled" ? itensR.value.total : 0,
    arquivosR.status === "fulfilled" ? arquivosR.value : [],
    falhas,
  );
}
