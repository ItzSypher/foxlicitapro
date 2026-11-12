import { cn } from "@/lib/utils";
import type { Sinal, TomSinal } from "./dominio";
import { Secao } from "./secao";

const PONTO: Record<TomSinal, string> = {
  positive: "bg-positive",
  warning: "bg-warning",
  negative: "bg-negative",
};

const LEGENDA: Record<TomSinal, string> = {
  positive: "Favorável",
  warning: "Atenção",
  negative: "Problema",
};

export function Sinais({ sinais }: { sinais: readonly Sinal[] }) {
  return (
    <Secao id="sinais" titulo="Sinais para o seu perfil">
      <ul className="flex flex-col rounded-card border border-border bg-surface">
        {sinais.map((s) => (
          <li key={s.id} className="flex items-start gap-3 border-t border-border px-4 py-3 first:border-t-0">
            <span aria-hidden="true" className={cn("mt-[7px] size-2 shrink-0 rounded-full", PONTO[s.tom])} />
            <span className="text-sm leading-snug wrap-break-word text-ink">
              <span className="sr-only">{LEGENDA[s.tom]}: </span>
              {s.texto}
            </span>
          </li>
        ))}
      </ul>
    </Secao>
  );
}
