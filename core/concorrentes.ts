/**
 * Preço dos concorrentes: a partir de contratações parecidas já homologadas no PNCP, mostra
 * quanto costuma sair o contrato (média, mínimo, máximo) e o desconto médio sobre o estimado.
 * Funções puras, sem rede nem banco.
 */
import { normalizarTexto } from "./cnae-keywords";

export interface AmostraConcorrente {
  idPncp: string;
  objeto: string;
  uf: string;
  orgao: string;
  valorEstimado: number | null;
  valorHomologado: number;
  /** ISO 8601 */
  publicadaEm: string | null;
  link: string;
}

/** Palavras que aparecem em quase toda compra pública e não dizem o que se compra. */
const PALAVRAS_GENERICAS: ReadonlySet<string> = new Set([
  "contratacao", "empresa", "especializada", "aquisicao", "servico", "servicos", "fornecimento", "objeto",
  "registro", "preco", "precos", "eventual", "futura", "futuro", "prestacao", "execucao", "atender", "atendimento",
  "necessidades", "necessidade", "conforme", "especificacoes", "especificacao", "termo", "referencia", "edital",
  "anexo", "para", "com", "por", "das", "dos", "uma", "uns", "umas", "como", "sob", "demanda", "secretaria",
  "municipal", "estadual", "federal", "prefeitura", "municipio", "orgao", "unidade", "tipo", "demais", "outros",
  "visando", "atraves", "mediante", "pregao", "dispensa", "eletronico", "eletronica", "processo", "administrativo",
  "geral", "diversos", "diversas", "materiais", "material", "itens", "item", "lote", "grupo",
]);

export const MAX_PALAVRAS = 6;
const TAMANHO_MINIMO = 4;

function tokens(texto: string): string[] {
  return normalizarTexto(texto)
    .split(/[^a-z0-9]+/)
    .filter((t) => t !== "");
}

/** Plural simples: "computadores" casa com "computador". */
function raiz(token: string): string {
  if (token.length <= 4) return token;
  if (/(or|ar|er|ur|z)es$/.test(token)) return token.slice(0, -2);
  return token.endsWith("s") ? token.slice(0, -1) : token;
}

/** Palavras do objeto que dizem o que se compra: sem acento, sem genéricas, sem repetir, as mais longas primeiro (até 6). */
export function palavrasChaveDoObjeto(objeto: string): string[] {
  const vistas = new Set<string>();
  const lista: string[] = [];
  for (const t of tokens(objeto)) {
    if (t.length < TAMANHO_MINIMO || /^\d+$/.test(t) || PALAVRAS_GENERICAS.has(t)) continue;
    const r = raiz(t);
    if (vistas.has(r)) continue;
    vistas.add(r);
    lista.push(r);
  }
  return lista.sort((a, b) => b.length - a.length).slice(0, MAX_PALAVRAS);
}

/** Quantas das palavras aparecem no texto. */
export function contarPalavras(palavras: readonly string[], texto: string): number {
  const presentes = new Set(tokens(texto).map(raiz));
  return palavras.filter((p) => presentes.has(p)).length;
}

/** Parecida: casa pelo menos 2 palavras-chave (ou a única, se o objeto só tem uma). */
export function ehParecida(palavras: readonly string[], texto: string): boolean {
  if (palavras.length === 0) return false;
  return contarPalavras(palavras, texto) >= Math.min(2, palavras.length);
}

export interface Parecida extends AmostraConcorrente {
  /** Palavras-chave que casaram */
  casadas: number;
  mesmaUf: boolean;
}

function dataMs(iso: string | null): number {
  const ms = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(ms) ? 0 : ms;
}

/** Filtra as parecidas e ordena: mesma UF primeiro, depois mais palavras casadas, depois mais recentes. */
export function selecionarParecidas(
  amostras: readonly AmostraConcorrente[],
  palavras: readonly string[],
  uf: string,
  excluirId: string,
): Parecida[] {
  const ufAlvo = uf.trim().toUpperCase();
  const lista: Parecida[] = [];
  for (const a of amostras) {
    if (a.idPncp === excluirId || !(a.valorHomologado > 0)) continue;
    if (!ehParecida(palavras, a.objeto)) continue;
    lista.push({ ...a, casadas: contarPalavras(palavras, a.objeto), mesmaUf: ufAlvo !== "" && a.uf.toUpperCase() === ufAlvo });
  }
  return lista.sort(
    (x, y) =>
      Number(y.mesmaUf) - Number(x.mesmaUf) || y.casadas - x.casadas || dataMs(y.publicadaEm) - dataMs(x.publicadaEm),
  );
}

export interface EstatisticasConcorrentes {
  /** Amostras com valor homologado */
  amostras: number;
  media: number | null;
  minimo: number | null;
  maximo: number | null;
  /** Desconto médio do homologado sobre o estimado, em % (positivo = homologou abaixo do estimado) */
  descontoMedioPct: number | null;
  /** Amostras que têm estimado e homologado para calcular o desconto */
  amostrasComDesconto: number;
}

/** Percentual de desconto de uma amostra; null sem estimado. */
export function descontoPct(estimado: number | null, homologado: number): number | null {
  if (estimado === null || !(estimado > 0) || !(homologado > 0)) return null;
  return ((estimado - homologado) / estimado) * 100;
}

export function calcularEstatisticas(amostras: readonly AmostraConcorrente[]): EstatisticasConcorrentes {
  const valores = amostras.map((a) => a.valorHomologado).filter((v) => Number.isFinite(v) && v > 0);
  if (valores.length === 0) {
    return { amostras: 0, media: null, minimo: null, maximo: null, descontoMedioPct: null, amostrasComDesconto: 0 };
  }
  const descontos: number[] = [];
  for (const a of amostras) {
    const d = descontoPct(a.valorEstimado, a.valorHomologado);
    if (d !== null) descontos.push(d);
  }
  const soma = (xs: readonly number[]): number => xs.reduce((acc, x) => acc + x, 0);
  return {
    amostras: valores.length,
    media: soma(valores) / valores.length,
    minimo: Math.min(...valores),
    maximo: Math.max(...valores),
    descontoMedioPct: descontos.length > 0 ? soma(descontos) / descontos.length : null,
    amostrasComDesconto: descontos.length,
  };
}

/** Valor que o histórico sugere para esta licitação: estimado menos o desconto médio. Null sem os dois. */
export function valorProvavel(estimadoAtual: number | null, descontoMedioPct: number | null): number | null {
  if (estimadoAtual === null || !(estimadoAtual > 0) || descontoMedioPct === null) return null;
  return estimadoAtual * (1 - descontoMedioPct / 100);
}

export interface ResultadoConcorrentes {
  palavras: string[];
  estatisticas: EstatisticasConcorrentes;
  /** As mais parecidas (até 5), mesma UF primeiro */
  maisParecidas: Parecida[];
  /** Estimado desta licitação menos o desconto médio; null sem os dois */
  valorProvavel: number | null;
  /** Parecidas na mesma UF, dentro de todas as encontradas */
  naMesmaUf: number;
}

export const MAX_LISTA = 5;

/** Junta tudo: palavras do objeto, parecidas, estatísticas e as 5 melhores para mostrar. */
export function montarResultado(
  amostras: readonly AmostraConcorrente[],
  objeto: string,
  uf: string,
  idAtual: string,
  estimadoAtual: number | null,
): ResultadoConcorrentes {
  const palavras = palavrasChaveDoObjeto(objeto);
  const parecidas = selecionarParecidas(amostras, palavras, uf, idAtual);
  const estatisticas = calcularEstatisticas(parecidas);
  return {
    palavras,
    estatisticas,
    maisParecidas: parecidas.slice(0, MAX_LISTA),
    valorProvavel: valorProvavel(estimadoAtual, estatisticas.descontoMedioPct),
    naMesmaUf: parecidas.filter((p) => p.mesmaUf).length,
  };
}
