"use client";

import { ABAS, type Aba } from "@/lib/radar-filtros";
import { cn } from "@/lib/utils";

/** "Para você | Todas": abas de texto com sublinhado na ativa, para não se confundir com o seletor de frente. */
export function SeletorAba({
  aba,
  contagens,
  onEscolher,
}: {
  aba: Aba;
  /** Quantas oportunidades cada aba mostra agora */
  contagens: Record<Aba, number>;
  onEscolher: (valor: Aba) => void;
}) {
  return (
    <div role="group" aria-label="Oportunidades" className="flex items-end gap-1 border-b border-border">
      {ABAS.map((opcao) => {
        const ativa = aba === opcao.id;
        return (
          <button
            key={opcao.id}
            type="button"
            aria-pressed={ativa}
            onClick={() => onEscolher(opcao.id)}
            className={cn(
              "-mb-px inline-flex h-11 items-center gap-2 border-b-2 px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset",
              ativa
                ? "border-brand font-semibold text-ink"
                : "border-transparent text-muted-foreground hover:text-ink",
            )}
          >
            {opcao.rotulo}
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{contagens[opcao.id]}</span>
          </button>
        );
      })}
    </div>
  );
}
