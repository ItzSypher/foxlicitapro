import { normalizarTexto } from "@/core/texto-busca";

/**
 * Pregão fica "fora do foco atual", exceto quando o objeto casa com uma exceção das preferências
 * (por padrão, "suporte gerenciado"), com um termo do foco da empresa ou com um CNAE/frente dela
 * (o casamento que o score já calculou). Funções puras.
 */

export interface RegraPregao {
  ehPregao: boolean;
  /** Termo da exceção das preferências que casou com o objeto; null sem casamento */
  excecao: string | null;
  /** O que casou do lado da empresa: termo do foco ou a atividade (CNAE); null sem casamento */
  casouFoco: string | null;
  /** Pregão sem exceção, sem foco e sem CNAE casado: o conselheiro avisa, mas não reprova só por isso */
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
  /** Termo do foco da empresa que casou com o objeto (o score já calcula); null ou ausente sem casamento */
  focoCasado?: string | null;
  /** Códigos CNAE da empresa que casaram com o objeto (o score já calcula) */
  cnaesCasados?: readonly string[];
}): RegraPregao {
  const ehPregao = ehModalidadePregao(entrada.modalidadeId, entrada.modalidadeNome);
  const casouFoco = motivoDoFoco(entrada.focoCasado ?? null, entrada.cnaesCasados ?? []);
  if (!ehPregao) return { ehPregao: false, excecao: null, casouFoco, foraDoFoco: false };
  const excecao = excecaoCasada(entrada.objeto, entrada.excecoes);
  return { ehPregao: true, excecao, casouFoco, foraDoFoco: excecao === null && casouFoco === null };
}

/** Marca de casamento só por CNAE (sem termo do foco). */
export const ATIVIDADE_DA_EMPRESA = "atividade (CNAE) da empresa";

/** Termo do foco, ou a atividade da empresa quando só o CNAE casou; null sem casamento. */
function motivoDoFoco(foco: string | null, cnaesCasados: readonly string[]): string | null {
  if (foco !== null && foco.trim() !== "") return foco.trim();
  return cnaesCasados.length > 0 ? ATIVIDADE_DA_EMPRESA : null;
}
