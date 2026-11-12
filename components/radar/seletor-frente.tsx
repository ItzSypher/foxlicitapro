"use client";

import type { Frente } from "@/core/types";
import { cn } from "@/lib/utils";

const OPCOES: ReadonlyArray<{ id: Frente; rotulo: string }> = [
  { id: "servicos", rotulo: "Serviços" },
  { id: "produtos", rotulo: "Produtos" },
];

export function SeletorFrente({
  frente,
  onEscolher,
}: {
  frente: Frente;
  onEscolher: (valor: Frente) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Frente de atuação"
      className="grid w-full grid-cols-2 gap-0.5 rounded-control border border-border bg-raised p-0.5 min-[480px]:inline-grid min-[480px]:w-auto"
    >
      {OPCOES.map((opcao) => {
        const ativa = frente === opcao.id;
        return (
          <button
            key={opcao.id}
            type="button"
            aria-pressed={ativa}
            onClick={() => onEscolher(opcao.id)}
            className={cn(
              "inline-flex h-10 items-center justify-center rounded-[5px] border px-4 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand md:h-8",
              ativa
                ? "border-border bg-surface font-semibold text-ink"
                : "border-transparent text-muted-foreground hover:text-ink",
            )}
          >
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}
