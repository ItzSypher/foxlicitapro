import type { Faixa, Score } from "@/core/types";
import { cn } from "@/lib/utils";

const PREENCHIMENTO: Record<Faixa, string> = {
  go: "bg-go",
  atencao: "bg-atencao",
  nogo: "bg-nogo",
};

const PALAVRA: Record<Faixa, string> = { go: "boa", atencao: "atenção", nogo: "evitar" };

/**
 * Termômetro: um segmento por critério, largura proporcional ao máximo do critério,
 * preenchimento proporcional a pontos/máximo na cor da faixa. O trilho usa o token
 * de controle para aparecer nos dois temas.
 * O atraso do enchimento herda `--i` (posição) do item que o contém.
 */
export function Termometro({ score, className }: { score: Score; className?: string }) {
  return (
    <span
      role="img"
      aria-label={`${score.total} de 100: ${PALAVRA[score.faixa]}`}
      className={cn("flex h-1.5 w-full gap-0.5", className)}
    >
      {score.criterios.map((criterio, posicao) => {
        const razao = criterio.maximo > 0 ? Math.min(Math.max(criterio.pontos / criterio.maximo, 0), 1) : 0;
        return (
          <span
            key={criterio.id}
            className="block h-full min-w-0 overflow-hidden rounded-[2px] bg-control"
            style={{ flex: `${criterio.maximo} 1 0%` }}
          >
            <span
              className={cn("termo-enche block h-full w-full", PREENCHIMENTO[score.faixa])}
              style={{ "--r": razao, "--s": posicao } as React.CSSProperties}
            />
          </span>
        );
      })}
    </span>
  );
}
