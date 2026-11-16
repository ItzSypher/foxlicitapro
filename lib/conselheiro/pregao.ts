import { normalizarTexto } from "@/core/texto-busca";

/**
 * Pregão fica "fora do foco atual", exceto quando o objeto casa com uma exceção das preferências
 * (por padrão, "suporte gerenciado"). Funções puras.
 */

export interface RegraPregao {
  ehPregao: boolean;
  /** Termo da exceção que casou com o objeto; null sem casamento */
  excecao: string | null;
  /** Pregão sem exceção: o conselheiro deve avisar que está fora do foco */
  foraDoFoco: boolean;
}

/** Pregão eletrônico (modalidade 6 do PNCP) ou presencial; o nome cobre rótulos de outras modalidades. */
export function ehModalidadePregao(modalidadeId: number, modalidadeNome: string): boolean {
  return modalidadeId === 6 || /\bpregao\b/.test(normalizarTexto(modalidadeNome));
}

/** Primeiro termo das exceções que aparece no objeto (comparação sem acento e sem pontuação), ou null. */
export function excecaoCasada(objeto: string, excecoes: readonly string[]): string | null {
  const texto = ` ${normalizarTexto(objeto)} `;
  for (const bruta of excecoes) {
    const termo = normalizarTexto(bruta);
    // Início de palavra obrigatório; o fim é livre para pegar plurais ("licenças" casa com "licenca").
    if (termo !== "" && texto.includes(` ${termo}`)) return bruta.trim();
  }
  return null;
}

export function avaliarPregao(entrada: {
  modalidadeId: number;
  modalidadeNome: string;
  objeto: string;
  excecoes: readonly string[];
}): RegraPregao {
  const ehPregao = ehModalidadePregao(entrada.modalidadeId, entrada.modalidadeNome);
  if (!ehPregao) return { ehPregao: false, excecao: null, foraDoFoco: false };
  const excecao = excecaoCasada(entrada.objeto, entrada.excecoes);
  return { ehPregao: true, excecao, foraDoFoco: excecao === null };
}
