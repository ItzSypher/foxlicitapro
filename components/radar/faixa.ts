import type { Faixa } from "@/core/types";

/** Texto na cor da faixa, com contraste de 4,5:1 em cada tema (tokens de texto, não os de preenchimento). */
export const TEXTO_FAIXA: Record<Faixa, string> = {
  go: "text-positive",
  atencao: "text-warning",
  nogo: "text-negative",
};

/** Pastilha da lista: fundo da cor da faixa a 15% e texto na cor da faixa. */
export const PASTILHA_FAIXA: Record<Faixa, string> = {
  go: "bg-go/15 text-positive",
  atencao: "bg-atencao/15 text-warning",
  nogo: "bg-nogo/15 text-negative",
};
