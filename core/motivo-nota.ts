import type { Score } from "./types";

/**
 * Principal motivo da nota, em uma frase: o foco da empresa quando casou; senão o critério que mais
 * pontos perdeu (empate fica com o primeiro da lista). Null quando a nota é cheia ou não há critérios.
 */
export function motivoPrincipal(score: Score): string | null {
  if (score.foco !== undefined) return `Bate com o seu foco: ${score.foco}`;
  let pior: { rotulo: string; motivo: string; perdidos: number } | null = null;
  for (const c of score.criterios) {
    const perdidos = c.maximo - c.pontos;
    if (perdidos > 0 && (pior === null || perdidos > pior.perdidos)) pior = { rotulo: c.rotulo, motivo: c.motivo, perdidos };
  }
  return pior === null ? null : `${pior.rotulo}: ${pior.motivo}`;
}
