"use client";

import { LayoutGrid, List } from "lucide-react";
import { VISOES, type Visao } from "@/lib/radar-filtros";
import { cn } from "@/lib/utils";

const ICONES = { cards: LayoutGrid, lista: List } as const;

const ROTULO_ACESSIVEL: Record<Visao, string> = {
  cards: "Ver em cards",
  lista: "Ver em lista",
};

interface Props {
  visao: Visao;
  onEscolher: (valor: Visao) => void;
  className?: string;
}

/** Segmentado "Cards | Lista": ícone e rótulo visíveis, aria-label descritivo. */
export function AlternadorVisao({ visao, onEscolher, className }: Props) {
  return (
    <div
      role="group"
      aria-label="Visualização"
      className={cn(
        "inline-grid grid-cols-2 gap-0.5 rounded-control border border-border bg-raised p-0.5",
        className,
      )}
    >
      {VISOES.map((opcao) => {
        const ativa = visao === opcao.id;
        const Icone = ICONES[opcao.id];
        return (
          <button
            key={opcao.id}
            type="button"
            aria-pressed={ativa}
            aria-label={ROTULO_ACESSIVEL[opcao.id]}
            onClick={() => onEscolher(opcao.id)}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-[5px] border px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand lg:h-8",
              ativa
                ? "border-border bg-surface font-medium text-ink"
                : "border-transparent text-muted-foreground hover:text-ink",
            )}
          >
            <Icone className="size-4" aria-hidden="true" />
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}
