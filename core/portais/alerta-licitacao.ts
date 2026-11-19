import { z } from "zod";
import { PALAVRAS_CHAVE, TERMOS_FORTES } from "../cnae-keywords";
import type { CodigoCnae } from "../empresa";
import { paraIsoBrasilia } from "../pncp/normalize";
import type { CnaePerfil } from "../perfil";
import { regiaoDe } from "../regioes";
import type { Oportunidade } from "../types";

/** Nome da fonte mostrado ao usuário; o uso comercial da API exige manter o link para o Alerta Licitação. */
export const NOME_FONTE_ALERTA = "Alerta Licitação";

export const URL_ALERTA_API = "https://alertalicitacao.com.br/api/v1/licitacoesAbertas/";

/** Cabeçalho em que a API recebe a chave de 32 caracteres (preferível a pô-la na URL). */
export const CABECALHO_TOKEN = "Token";

/** Código de "Dispensas e dispensas eletrônicas" na tabela de modalidades do Alerta Licitação. */
export const MODALIDADE_ALERTA_DISPENSA = 6;

/** Máximo de licitações por página aceito pela API. */
export const MAX_POR_PAGINA = 100;

/** Prefixo do id das oportunidades que só existem no Alerta Licitação (fora do PNCP). */
const PREFIXO_ID = "ALERTA-";

const texto = z.union([z.string(), z.number()]).transform((v) => String(v));

/** Uma licitação da resposta. A doc chama o id de `id_licitacao`; aceitamos também `id`. */
const licitacaoSchema = z
  .object({
    id_licitacao: texto.optional(),
    id: texto.optional(),
    titulo: texto.nullish(),
    orgao: texto.nullish(),
    uf: texto.nullish(),
    municipio: texto.nullish(),
    municipio_IBGE: texto.nullish(),
    abertura_datetime: texto.nullish(),
    objeto: texto.nullish(),
    link: texto.nullish(),
    linkExterno: texto.nullish(),
    id_tipo: texto.nullish(),
    tipo: texto.nullish(),
  })
  .refine((l) => (l.id_licitacao ?? l.id ?? "").trim() !== "", "licitação sem id");

export type LicitacaoAlerta = z.infer<typeof licitacaoSchema>;

const erroSchema = z.object({ codigo: texto.nullish(), descricao: texto.nullish() });

/** Corpo da resposta: ou as licitações, ou `totalErros`/`erros`. Cada licitação é validada à parte. */
/** Número que pode vir como texto ("12"). */
const numero = z.union([z.number(), z.string()]).transform((v) => Number(v)).pipe(z.number().finite());

/** Lista que pode vir como objeto indexado ({"0": {...}, "1": {...}}). */
const listaFlexivel = z
  .union([z.array(z.unknown()), z.record(z.string(), z.unknown())])
  .transform((v) => (Array.isArray(v) ? v : Object.values(v)));

const respostaSchema = z.object({
  totalLicitacoes: numero.optional().catch(undefined),
  paginas: numero.optional().catch(undefined),
  licitacoesPorPagina: numero.optional().catch(undefined),
  licitacoesNestaPagina: numero.optional().catch(undefined),
  licitacoes: listaFlexivel.nullish(),
  totalErros: numero.optional().catch(undefined),
  erros: z.array(erroSchema.catch({ codigo: null, descricao: null })).nullish().catch(undefined),
});

/** Forma da resposta (chaves e tipos, sem valores), para o log quando ela não for entendida. */
export function formaDaResposta(corpo: unknown): string {
  if (corpo === null || typeof corpo !== "object") return typeof corpo;
  if (Array.isArray(corpo)) return `array(${corpo.length})`;
  return Object.entries(corpo)
    .slice(0, 12)
    .map(([k, v]) => `${k}:${Array.isArray(v) ? "array" : v === null ? "null" : typeof v}`)
    .join(",");
}

export interface RespostaAlerta {
  totalLicitacoes: number;
  paginas: number;
  licitacoesNestaPagina: number;
  licitacoes: LicitacaoAlerta[];
}

export type LeituraResposta = { ok: true; resposta: RespostaAlerta } | { ok: false; erro: string };

/** Valida o JSON da API. Licitação fora do formato é descartada; resposta com `erros` vira falha com a descrição. */
export function lerResposta(corpo: unknown): LeituraResposta {
  // Algumas respostas vêm só com a lista, sem o envelope.
  const r = respostaSchema.safeParse(Array.isArray(corpo) ? { licitacoes: corpo } : corpo);
  if (!r.success) return { ok: false, erro: `resposta fora do formato esperado (${formaDaResposta(corpo)})` };
  const { data } = r;
  if ((data.totalErros ?? 0) > 0 || (data.erros?.length ?? 0) > 0) {
    const descricoes = (data.erros ?? []).map((e) => `${e.codigo ?? "?"}: ${e.descricao ?? ""}`.trim()).join("; ");
    return { ok: false, erro: descricoes || "a API devolveu erro" };
  }
  const licitacoes: LicitacaoAlerta[] = [];
  for (const bruta of data.licitacoes ?? []) {
    const l = licitacaoSchema.safeParse(bruta);
    if (l.success) licitacoes.push(l.data);
  }
  return {
    ok: true,
    resposta: {
      totalLicitacoes: data.totalLicitacoes ?? licitacoes.length,
      paginas: data.paginas ?? 1,
      licitacoesNestaPagina: data.licitacoesNestaPagina ?? licitacoes.length,
      licitacoes,
    },
  };
}

export interface FiltrosAlerta {
  /** Siglas em maiúsculas; obrigatório (consulta sem filtro é proibida pela política da API) */
  ufs: ReadonlyArray<string>;
  /** Termos do ramo; com espaço, vão entre aspas (sequência exata). Obrigatório. */
  palavrasChave: ReadonlyArray<string>;
  /** Códigos de modalidade do Alerta Licitação; ausente vale só as dispensas (6) */
  modalidades?: ReadonlyArray<number>;
  municipioIbge?: string;
  pagina?: number;
  porPagina?: number;
}

function termoDaApi(termo: string): string {
  const limpo = termo.replace(/["',]/g, " ").replace(/\s+/g, " ").trim();
  return /\s/.test(limpo) ? `"${limpo}"` : limpo;
}

/**
 * URL da consulta, sem o token (ele vai no cabeçalho). Lança se faltar UF ou palavra-chave:
 * varrer o banco sem filtro viola a política de acesso e pode bloquear a chave.
 */
export function montarUrl(filtros: FiltrosAlerta): string {
  const ufs = [...new Set(filtros.ufs.map((u) => u.trim().toUpperCase()).filter((u) => /^[A-Z]{2}$/.test(u)))];
  const termos = [...new Set(filtros.palavrasChave.map(termoDaApi).filter((t) => t !== ""))];
  if (ufs.length === 0) throw new Error("Alerta Licitação: consulta sem UF.");
  if (termos.length === 0) throw new Error("Alerta Licitação: consulta sem palavra-chave.");
  const modalidades = filtros.modalidades && filtros.modalidades.length > 0 ? filtros.modalidades : [MODALIDADE_ALERTA_DISPENSA];

  const params = new URLSearchParams();
  params.set("uf", ufs.join(","));
  params.set("palavra_chave", termos.join(","));
  params.set("modalidade", modalidades.join(","));
  if (filtros.municipioIbge && /^\d{7}$/.test(filtros.municipioIbge)) params.set("municipio_ibge", filtros.municipioIbge);
  params.set("pagina", String(Math.max(1, Math.floor(filtros.pagina ?? 1))));
  params.set("licitacoesPorPagina", String(Math.min(MAX_POR_PAGINA, Math.max(1, Math.floor(filtros.porPagina ?? MAX_POR_PAGINA)))));
  return `${URL_ALERTA_API}?${params.toString()}`;
}

const ID_PNCP = /^PNCP-(\d{14})-(\d+)-(\d+)-(\d{4})$/i;

export interface ChavePncp {
  cnpj: string;
  /** Sequencial como número (sem zeros à esquerda) */
  sequencial: number;
  ano: number;
  /** numeroControlePNCP, no formato que o PNCP usa: "{cnpj}-1-{seq 6 dígitos}/{ano}" */
  numeroControle: string;
}

/** Lê o id "PNCP-{cnpj}-1-{seq}-{ano}" do Alerta Licitação. Null quando a licitação não veio do PNCP. */
export function chavePncpDoId(id: string): ChavePncp | null {
  const m = ID_PNCP.exec(id.trim());
  if (!m) return null;
  const [, cnpj, tipo, seq, ano] = m;
  const sequencial = Number(seq);
  if (!cnpj || !tipo || !ano || !Number.isSafeInteger(sequencial)) return null;
  return { cnpj, sequencial, ano: Number(ano), numeroControle: `${cnpj}-${tipo}-${String(sequencial).padStart(6, "0")}/${ano}` };
}

function limpar(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\s+/g, " ").trim();
}

function ouNulo(valor: string | null | undefined): string | null {
  const l = limpar(valor);
  return l === "" ? null : l;
}

/** "2026-12-30 09:00:00" (sem fuso) em ISO de Brasília. */
function dataDaApi(valor: string | null | undefined): string | null {
  const t = limpar(valor);
  if (t === "") return null;
  return paraIsoBrasilia(t.replace(" ", "T"));
}

/** A API só traz a abertura. Sem hora (meia-noite), o prazo vale até o fim do dia. */
function encerramentoDe(valor: string | null | undefined): string | null {
  const t = limpar(valor);
  if (t === "") return null;
  const base = t.replace(" ", "T");
  const semHora = /^\d{4}-\d{2}-\d{2}$/.test(base) || /T00:00(:00)?$/.test(base);
  if (semHora) return paraIsoBrasilia(`${base.slice(0, 10)}T23:59:59`);
  return paraIsoBrasilia(base);
}

/**
 * Converte uma licitação do Alerta Licitação em Oportunidade (modalidade Dispensa).
 * Com id do PNCP, usa a mesma chave do PNCP (numeroControlePNCP, CNPJ, ano, sequencial), então
 * repete o id de quem já veio de lá. Sem id do PNCP, o id é "ALERTA-{id}" e não há CNPJ nem sequencial.
 * Devolve null sem data de abertura válida, já encerrada ou sem UF.
 */
export function converter(l: LicitacaoAlerta, agora: Date = new Date()): Oportunidade | null {
  const idAlerta = limpar(l.id_licitacao ?? l.id);
  const dataEncerramento = encerramentoDe(l.abertura_datetime);
  if (idAlerta === "" || dataEncerramento === null) return null;
  if (new Date(dataEncerramento).getTime() < agora.getTime()) return null;
  const uf = limpar(l.uf).toUpperCase();
  if (uf === "") return null;

  const codigoIbge = limpar(l.municipio_IBGE);
  const pncp = chavePncpDoId(idAlerta);
  const linkAlerta = ouNulo(l.link) ?? `https://alertalicitacao.com.br/!licitacao/${encodeURIComponent(idAlerta)}`;
  const orgao = limpar(l.orgao);

  return {
    id: pncp ? pncp.numeroControle : `${PREFIXO_ID}${idAlerta}`,
    objeto: limpar(l.objeto) || limpar(l.titulo),
    valorEstimado: null,
    orgao,
    orgaoCnpj: pncp ? pncp.cnpj : "",
    unidade: orgao,
    municipio: limpar(l.municipio),
    codigoIbge,
    uf,
    regiao: regiaoDe(codigoIbge, uf),
    modalidadeId: 8,
    modalidadeNome: limpar(l.tipo) || "Dispensa",
    dataAbertura: dataDaApi(l.abertura_datetime),
    dataPublicacao: null,
    dataEncerramento,
    anoCompra: pncp ? pncp.ano : Number(dataEncerramento.slice(0, 4)),
    sequencialCompra: pncp ? pncp.sequencial : 0,
    linkPncp: pncp ? `https://pncp.gov.br/app/editais/${pncp.cnpj}/${pncp.ano}/${pncp.sequencial}` : linkAlerta,
    // Só o portal de origem, quando a API traz; a página no Alerta Licitação vai em `linkAlerta`.
    linkOrigem: ouNulo(l.linkExterno),
    linkAlerta,
  };
}

/** A oportunidade só existe no Alerta Licitação (não tem número do PNCP). */
export function ehSoDoAlerta(o: Pick<Oportunidade, "id">): boolean {
  return o.id.startsWith(PREFIXO_ID);
}

/** A oportunidade veio do Alerta Licitação, com ou sem cópia no PNCP. */
export function veioDoAlerta(o: Pick<Oportunidade, "linkAlerta">): boolean {
  return typeof o.linkAlerta === "string" && o.linkAlerta !== "";
}

/**
 * Converte e junta ao que já existe sem repetir: o que o PNCP já trouxe (mesmo id) fica como está;
 * repetidos dentro da própria resposta contam uma vez. Devolve só as novas.
 */
export function novasSemDuplicata(
  licitacoes: ReadonlyArray<LicitacaoAlerta>,
  idsExistentes: ReadonlySet<string>,
  agora: Date = new Date(),
): Oportunidade[] {
  const vistos = new Set(idsExistentes);
  const novas: Oportunidade[] = [];
  for (const l of licitacoes) {
    const o = converter(l, agora);
    if (o === null || vistos.has(o.id)) continue;
    vistos.add(o.id);
    novas.push(o);
  }
  return novas;
}

/**
 * Lista nova do PNCP mais o que só o Alerta Licitação tem e ainda vale na lista anterior:
 * uma coleta completa do PNCP substitui a lista e não pode apagar essas oportunidades.
 */
export function manterDoAlerta(antigas: ReadonlyArray<Oportunidade>, novas: ReadonlyArray<Oportunidade>, agora: Date): Oportunidade[] {
  const ids = new Set(novas.map((o) => o.id));
  const mantidas = antigas.filter((o) => ehSoDoAlerta(o) && !ids.has(o.id) && new Date(o.dataEncerramento).getTime() > agora.getTime());
  return mantidas.length === 0 ? [...novas] : [...novas, ...mantidas];
}

/** Máximo de termos por consulta. */
export const MAX_TERMOS = 15;

/**
 * Termos de busca do ramo das empresas: dos CNAEs informados, primeiro os termos fortes (inequívocos),
 * depois os demais, alternando entre os CNAEs para cobrir todos. Em minúsculas e sem acento, como estão na base.
 */
export function termosDosCnaes(cnaes: ReadonlyArray<Pick<CnaePerfil, "codigo">>, maximo: number = MAX_TERMOS): string[] {
  const codigos = [...new Set(cnaes.map((c) => c.codigo))].filter((c): c is CodigoCnae => c in PALAVRAS_CHAVE);
  const filas = codigos.map((codigo) => {
    const fortes = TERMOS_FORTES[codigo];
    const todos = PALAVRAS_CHAVE[codigo];
    return [...fortes, ...todos.filter((t) => !fortes.includes(t))];
  });
  const termos: string[] = [];
  const usados = new Set<string>();
  for (let i = 0; termos.length < maximo && filas.some((f) => i < f.length); i += 1) {
    for (const fila of filas) {
      const termo = fila[i];
      if (termo === undefined || usados.has(termo) || termos.length >= maximo) continue;
      usados.add(termo);
      termos.push(termo);
    }
  }
  return termos;
}
