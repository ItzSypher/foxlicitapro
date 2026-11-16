/** Operações puras sobre a lista de itens da proposta, na ordem em que aparecem na tela. */
export interface ComChave {
  /** Identidade estável para o React; não vai para o banco */
  chave: number;
}

export function proximaChave(itens: readonly ComChave[]): number {
  return itens.reduce((max, i) => Math.max(max, i.chave), 0) + 1;
}

export function alterarItem<T extends ComChave>(itens: readonly T[], chave: number, parte: Partial<T>): T[] {
  return itens.map((i) => (i.chave === chave ? { ...i, ...parte } : i));
}

export function removerItem<T extends ComChave>(itens: readonly T[], chave: number): T[] {
  return itens.filter((i) => i.chave !== chave);
}

export function acrescentarItem<T extends ComChave>(itens: readonly T[], criar: (chave: number) => T): T[] {
  return [...itens, criar(proximaChave(itens))];
}

export function moverItem<T>(itens: readonly T[], indice: number, delta: -1 | 1): T[] {
  const alvo = indice + delta;
  if (indice < 0 || indice >= itens.length || alvo < 0 || alvo >= itens.length) return [...itens];
  const copia = [...itens];
  [copia[indice], copia[alvo]] = [copia[alvo], copia[indice]];
  return copia;
}
