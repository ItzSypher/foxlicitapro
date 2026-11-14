import { useSyncExternalStore } from "react";

/** Largura mínima (md) a partir da qual as etapas viram colunas lado a lado. */
const CONSULTA_COLUNAS = "(min-width: 768px)";

function assinar(aviso: () => void): () => void {
  const m = window.matchMedia(CONSULTA_COLUNAS);
  m.addEventListener("change", aviso);
  return () => m.removeEventListener("change", aviso);
}

/** true quando cabem colunas lado a lado; no celular e no servidor, false (uma etapa por vez). */
export function useColunas(): boolean {
  return useSyncExternalStore(
    assinar,
    () => window.matchMedia(CONSULTA_COLUNAS).matches,
    () => false,
  );
}

/** Classes da folha (Sheet) que sobe de baixo no celular: altura do conteúdo, sem sombra, área segura embaixo. */
export const CLASSE_FOLHA =
  "gap-0 overflow-y-auto rounded-t-sheet border-t border-border pb-[env(safe-area-inset-bottom)] shadow-none data-[side=bottom]:h-auto data-[side=bottom]:max-h-[85dvh]";
