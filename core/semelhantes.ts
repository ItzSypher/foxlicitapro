import { normalizarTexto } from "./cnae-keywords";
import type { Oportunidade } from "./types";

/**
 * Oportunidades de objeto parecido, para reaproveitar a proposta. Função pura: o texto é comparado por termos
 * normalizados (sem acento, sem palavras de ligação), sem rede e sem banco.
 */

/** Ligações e termos de edital que aparecem em quase todo objeto e não dizem o que se compra. */
const STOPWORDS: ReadonlySet<string> = new Set([
  "de", "da", "do", "das", "dos", "para", "por", "com", "sem", "em", "no", "na", "nos", "nas", "ao", "aos", "as", "os",
  "um", "uma", "uns", "umas", "ou", "que", "se", "sob", "sobre", "entre", "ate", "pelo", "pela", "pelos", "pelas",
  "contratacao", "aquisicao", "empresa", "especializada", "fornecimento", "prestacao", "servico", "servicos",
  "futura", "eventual", "objeto", "conforme", "termo", "referencia", "edital", "atender", "atendimento",
  "necessidades", "necessidade", "demanda", "demandas", "municipio", "prefeitura", "secretaria", "municipal",
  "estado", "orgao", "unidade", "unidades", "item", "itens", "tipo", "geral", "diversos", "diversas", "materiais",
  "material", "dispensa", "licitacao", "registro", "preco", "precos", "visando", "vista", "fins", "deste", "desta",
  "durante", "mediante", "inclusive", "incluindo", "bem", "bens", "mes", "ano", "anos", "meses",
]);

const MINIMO_LETRAS = 3;

/** Termos que sobram do texto: normalizados, sem números soltos nem palavras de ligação, sem repetição. */
export function termosDoObjeto(texto: string): Set<string> {
  const termos = new Set<string>();
  for (const palavra of normalizarTexto(texto).split(" ")) {
    if (palavra.length < MINIMO_LETRAS) continue;
    if (/^[0-9]+$/.test(palavra)) continue;
    if (STOPWORDS.has(palavra)) continue;
    // Plural simples, para "cadeira" e "cadeiras" valerem o mesmo termo.
    termos.add(palavra.length > 4 && palavra.endsWith("s") ? palavra.slice(0, -1) : palavra);
  }
  return termos;
}

/** Mínimo de termos em comum para duas compras serem tratadas como parecidas. */
export const MINIMO_TERMOS_EM_COMUM = 2;
/** Parte mínima do objeto menor que precisa aparecer no outro. */
export const SIMILARIDADE_MINIMA = 0.45;

/**
 * Semelhança de 0 a 1: termos em comum sobre o menor dos dois conjuntos (um objeto curto contido num longo vale muito),
 * misturada com o índice de Jaccard para o longo demais não empatar com o igual.
 */
export function similaridade(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let comuns = 0;
  for (const t of a) if (b.has(t)) comuns += 1;
  if (comuns < Math.min(MINIMO_TERMOS_EM_COMUM, a.size, b.size)) return 0;
  const menor = Math.min(a.size, b.size);
  const uniao = a.size + b.size - comuns;
  return 0.6 * (comuns / menor) + 0.4 * (comuns / uniao);
}

export type AlvoSemelhante = Pick<Oportunidade, "id" | "objeto" | "orgaoCnpj">;

export interface Semelhante {
  oportunidade: Oportunidade;
  /** 0 a 1 */
  similaridade: number;
}

export const MAXIMO_SEMELHANTES = 5;

/**
 * Até `maximo` oportunidades do cache com objeto parecido com o do alvo, em outros órgãos (o mesmo órgão e a própria compra ficam de fora).
 * Mais parecidas primeiro; no empate, a que encerra por último (mais recente).
 */
export function acharSemelhantes(
  alvo: AlvoSemelhante,
  candidatas: ReadonlyArray<Oportunidade>,
  maximo: number = MAXIMO_SEMELHANTES,
): Semelhante[] {
  const termosAlvo = termosDoObjeto(alvo.objeto);
  if (termosAlvo.size === 0) return [];
  const vistos = new Set<string>();
  const achadas: Semelhante[] = [];
  for (const o of candidatas) {
    if (o.id === alvo.id || vistos.has(o.id)) continue;
    vistos.add(o.id);
    if (alvo.orgaoCnpj !== "" && o.orgaoCnpj === alvo.orgaoCnpj) continue;
    const nota = similaridade(termosAlvo, termosDoObjeto(o.objeto));
    if (nota >= SIMILARIDADE_MINIMA) achadas.push({ oportunidade: o, similaridade: nota });
  }
  achadas.sort(
    (x, y) =>
      y.similaridade - x.similaridade ||
      Date.parse(y.oportunidade.dataEncerramento) - Date.parse(x.oportunidade.dataEncerramento) ||
      x.oportunidade.id.localeCompare(y.oportunidade.id),
  );
  return achadas.slice(0, Math.max(0, maximo));
}
