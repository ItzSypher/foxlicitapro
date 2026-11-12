import type { Score } from "@/core/types";
import { cn } from "@/lib/utils";

/**
 * Motivos da recomendação em pílulas neutras. No telefone aparecem 2; a partir de 768 px, até 3.
 */
export function Motivos({ motivos, className }: { motivos: ReadonlyArray<string>; className?: string }) {
  if (motivos.length === 0) return null;
  return (
    <span className={cn("flex min-w-0 flex-wrap gap-1.5", className)}>
      <span className="sr-only">Por que combina com você: </span>
      {motivos.slice(0, 3).map((motivo, posicao) => (
        <span
          key={motivo}
          className={cn(
            "min-h-5 max-w-full items-center rounded-full bg-pill-neutral-bg px-2 text-xs leading-5 font-medium text-pill-neutral-fg",
            posicao >= 2 ? "hidden md:inline-flex" : "inline-flex",
          )}
        >
          <span className="truncate">{motivo}</span>
        </span>
      ))}
    </span>
  );
}

/** Primeiro alerta do score, em uma linha, na cor de atenção. Nada quando não há alerta. */
export function AlertaDoScore({ score, className }: { score: Score; className?: string }) {
  const alertas = score.alertas;
  if (!alertas || alertas.length === 0) return null;
  return (
    <span title={alertas.join(". ")} className={cn("block truncate text-xs text-warning", className)}>
      {alertas[0]}
    </span>
  );
}
