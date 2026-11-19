"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  titulo: string;
  children: React.ReactNode;
  /** Abre já no celular (a partir de lg o conteúdo sempre aparece e o botão some). */
  abertoNoCelular?: boolean;
  /** Classes do conteúdo; o padrão é uma coluna que, em lg, se dissolve no pai. */
  classeConteudo?: string;
  className?: string;
}

/**
 * Bloco que começa recolhido no celular e abre ao tocar no título. No computador não recolhe:
 * o botão some e o conteúdo fica sempre à vista, como antes.
 */
export function BlocoRecolhivel({ titulo, children, abertoNoCelular = false, classeConteudo, className }: Props) {
  const [aberto, setAberto] = useState(abertoNoCelular);
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-2 lg:contents", className)}>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-controls={id}
        className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-control text-left text-sm font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand lg:hidden"
      >
        {titulo}
        <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-180")} />
      </button>
      <div id={id} className={cn("flex min-w-0 flex-col gap-2 lg:contents", !aberto && "max-lg:hidden", classeConteudo)}>
        {children}
      </div>
    </div>
  );
}
