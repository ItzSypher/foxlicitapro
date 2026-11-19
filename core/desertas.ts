import { casarCnaes } from "./cnae-keywords";
import type { CnaePerfil } from "./perfil";
import { paraIsoBrasilia } from "./pncp/normalize";
import type { ContratacaoPncp } from "./pncp/schema";

/**
 * Dispensas que terminaram sem vencedor: itens "Deserto" (ninguém propôs) ou "Fracassado" (propostas recusadas).
 * O órgão costuma abrir a mesma compra de novo. Funções puras, sem rede e sem banco.
 */

/** Código do item no PNCP (situacaoCompraItem): 4 = Deserto, 5 = Fracassado. */
export const SITUACAO_ITEM_DESERTO = 4;
export const SITUACAO_ITEM_FRACASSADO = 5;

/** Janela, em dias, em que uma deserta ainda aparece no Radar. */
export const DIAS_DESERTA_VALIDA = 60;

export interface ItemSituacao {
  numero: number;
  descricao: string;
  /** situacaoCompraItem do PNCP; null quando não veio */
  situacaoId: number | null;
  /** situacaoCompraItemNome (ex.: "Deserto"); null quando não veio */
  situacaoNome: string | null;
  valorTotal: number | null;
  /** dataAtualizacao do item, sem fuso, como o PNCP manda */
  atualizadoEm: string | null;
}

export type SituacaoDeserta = "deserta" | "fracassada" | "mista";

export interface Deserta {
  /** numeroControlePNCP */
  id: string;
  uf: string;
  codigoIbge: string;
  municipio: string;
  orgao: string;
  orgaoCnpj: string;
  unidade: string;
  objeto: string;
  /** Soma dos itens sem vencedor; null quando o órgão não informa */
  valorEstimado: number | null;
  itensSemVencedor: number;
  totalItens: number;
  situacao: SituacaoDeserta;
  /** ISO 8601; aproximação: o que for mais tarde entre o encerramento das propostas e a atualização do item */
  desertaEm: string;
  anoCompra: number;
  sequencialCompra: number;
  linkPncp: string;
}

/** Tipo de "sem vencedor" do item; null quando o item tem (ou terá) vencedor ou foi cancelado. */
export function tipoSemVencedor(item: Pick<ItemSituacao, "situacaoId" | "situacaoNome">): "deserto" | "fracassado" | null {
  if (item.situacaoId === SITUACAO_ITEM_DESERTO) return "deserto";
  if (item.situacaoId === SITUACAO_ITEM_FRACASSADO) return "fracassado";
  if (item.situacaoId === null) {
    const nome = (item.situacaoNome ?? "").toLowerCase();
    if (nome.includes("desert")) return "deserto";
    if (nome.includes("fracass")) return "fracassado";
  }
  return null;
}

function limpar(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\s+/g, " ").trim();
}

function maisTarde(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

/**
 * Monta a deserta da compra, ou null quando nenhum item ficou sem vencedor ou a compra ainda está em andamento.
 * O objeto leva a descrição dos itens sem vencedor, que é o que o ramo da empresa precisa enxergar.
 */
export function montarDeserta(c: ContratacaoPncp, itens: ReadonlyArray<ItemSituacao>, agora: Date): Deserta | null {
  const encerramento = paraIsoBrasilia(c.dataEncerramentoProposta);
  if (encerramento === null || Date.parse(encerramento) > agora.getTime()) return null;
  const semVencedor = itens.filter((i) => tipoSemVencedor(i) !== null);
  if (semVencedor.length === 0) return null;

  const tipos = new Set(semVencedor.map((i) => tipoSemVencedor(i)));
  const situacao: SituacaoDeserta = tipos.size > 1 ? "mista" : tipos.has("deserto") ? "deserta" : "fracassada";

  let soma = 0;
  let temValor = true;
  for (const i of semVencedor) {
    if (i.valorTotal === null || i.valorTotal <= 0) temValor = false;
    else soma += i.valorTotal;
  }
  const descricoes = semVencedor
    .map((i) => limpar(i.descricao))
    .filter((d) => d !== "")
    .slice(0, 5)
    .join("; ");
  const objetoCompra = limpar(c.objetoCompra);
  const objeto = descricoes === "" || objetoCompra.includes(descricoes) ? objetoCompra : `${objetoCompra} — itens sem vencedor: ${descricoes}`;
  if (objeto === "") return null;

  let quando: string | null = encerramento;
  for (const i of semVencedor) quando = maisTarde(quando, paraIsoBrasilia(i.atualizadoEm));
  // Atualização no futuro não existe: o limite é o momento da coleta.
  const desertaEm = quando !== null && Date.parse(quando) <= agora.getTime() ? quando : agora.toISOString();

  const cnpj = c.orgaoEntidade.cnpj;
  return {
    id: c.numeroControlePNCP,
    uf: limpar(c.unidadeOrgao.ufSigla).toUpperCase(),
    codigoIbge: String(c.unidadeOrgao.codigoIbge ?? "").trim(),
    municipio: limpar(c.unidadeOrgao.municipioNome),
    orgao: limpar(c.orgaoEntidade.razaoSocial),
    orgaoCnpj: cnpj,
    unidade: limpar(c.unidadeOrgao.nomeUnidade),
    objeto,
    valorEstimado: temValor && soma > 0 ? Math.round(soma * 100) / 100 : null,
    itensSemVencedor: semVencedor.length,
    totalItens: Math.max(itens.length, semVencedor.length),
    situacao,
    desertaEm,
    anoCompra: c.anoCompra,
    sequencialCompra: c.sequencialCompra,
    linkPncp: `https://pncp.gov.br/app/editais/${cnpj}/${c.anoCompra}/${c.sequencialCompra}`,
  };
}

/** O texto casa com alguma atividade (CNAE) do perfil, em qualquer frente. */
export function casaComRamo(texto: string, cnaes: ReadonlyArray<CnaePerfil>): boolean {
  const c = casarCnaes(texto, { cnaes: [...cnaes] });
  return c.servicos.length > 0 || c.produtos.length > 0;
}

/** Só as desertas dentro da validade e que casam com o ramo, da mais recente para a mais antiga. */
export function desertasDoRamo(
  desertas: ReadonlyArray<Deserta>,
  cnaes: ReadonlyArray<CnaePerfil>,
  agora: Date,
): Deserta[] {
  const limite = agora.getTime() - DIAS_DESERTA_VALIDA * 24 * 60 * 60 * 1000;
  return desertas
    .filter((d) => Date.parse(d.desertaEm) >= limite && casaComRamo(d.objeto, cnaes))
    .sort((a, b) => Date.parse(b.desertaEm) - Date.parse(a.desertaEm) || a.id.localeCompare(b.id));
}

/** Dia yyyyMMdd (fuso de Brasília) a `dias` de `agora`; negativo olha para trás. */
export function diaPncp(agora: Date, dias: number): string {
  const alvo = new Date(agora.getTime() + dias * 24 * 60 * 60 * 1000);
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(alvo);
  const v = (tipo: string): string => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${v("year")}${v("month")}${v("day")}`;
}

/** Soma `dias` a um dia yyyyMMdd. */
export function somarDias(dia: string, dias: number): string {
  const t = Date.UTC(Number(dia.slice(0, 4)), Number(dia.slice(4, 6)) - 1, Number(dia.slice(6, 8)) + dias);
  const d = new Date(t);
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`;
}

/** Dias a olhar nesta rodada, em ordem: do dia seguinte ao último já olhado até `limite`, no máximo `maximo` dias. */
export function diasParaVarrer(ultimoOlhado: string | null, limite: string, inicioPadrao: string, maximo: number): string[] {
  const primeiro = ultimoOlhado === null ? inicioPadrao : somarDias(ultimoOlhado, 1);
  const dias: string[] = [];
  for (let dia = primeiro; dia <= limite && dias.length < maximo; dia = somarDias(dia, 1)) dias.push(dia);
  return dias;
}
