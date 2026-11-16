import type { Faixa } from "@/core/types";

/** Texto na cor da faixa, com contraste de 4,5:1 em cada tema (tokens de texto, não os de preenchimento). */
export const TEXTO_FAIXA: Record<Faixa, string> = {
  go: "text-positive",
  atencao: "text-warning",
  nogo: "text-negative",
};
