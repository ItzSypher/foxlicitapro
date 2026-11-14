/** Texto para busca simples: minúsculo, sem acento e sem pontuação. Funções puras. */

const IGNORADAS: ReadonlySet<string> = new Set(["para", "com", "sem", "por", "uma", "uns", "das", "dos", "nas", "nos", "que"]);

export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Palavras que contam na busca: 3+ letras (ou números de 2+ dígitos), sem repetir e sem conectivos. */
export function palavrasDe(texto: string): string[] {
  const vistas = new Set<string>();
  for (const p of normalizarTexto(texto).split(" ")) {
    if (p === "" || IGNORADAS.has(p)) continue;
    if (p.length >= 3 || (/^\d+$/.test(p) && p.length >= 2)) vistas.add(p);
  }
  return [...vistas];
}
