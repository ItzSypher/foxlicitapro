"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ETAPAS, ehEtapa, type EtapaId } from "./tipos";

/** Select nativo estilizado para mudar de etapa. */
export function SeletorEtapa({
  valor,
  aoMudar,
  className,
}: {
  valor: EtapaId;
  aoMudar: (etapa: EtapaId) => void;
  className?: string;
}) {
  return (
    <label className={cn("relative flex items-center", className)}>
      <span className="sr-only">Mover para</span>
      <select
        value={valor}
        onChange={(e) => {
          const nova = e.target.value;
          if (ehEtapa(nova) && nova !== valor) aoMudar(nova);
        }}
        className="h-11 w-full min-w-0 cursor-pointer appearance-none rounded-control border border-control bg-surface pr-8 pl-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand lg:h-9"
      >
        {ETAPAS.map((e) => (
          <option key={e.id} value={e.id}>
            {e.id === valor ? e.rotulo : `Mover para: ${e.rotulo}`}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 size-4 text-muted-foreground"
      />
    </label>
  );
}
