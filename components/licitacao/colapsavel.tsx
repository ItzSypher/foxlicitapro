import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bloco que abre e fecha, sem JavaScript (details nativo). O cabeçalho fica sempre visível
 * e pode trazer um resumo à direita e selos embaixo do título.
 */
export function Colapsavel({
  id,
  titulo,
  aberta = false,
  resumo,
  selos,
  children,
  className,
}: {
  id?: string;
  titulo: string;
  aberta?: boolean;
  /** Texto curto à direita do título */
  resumo?: React.ReactNode;
  /** Linha de selos embaixo do título, visível mesmo fechado */
  selos?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <details
      id={id}
      open={aberta}
      className={cn("group scroll-mt-[calc(52px+3.5rem)] rounded-card border border-border bg-surface lg:scroll-mt-16", className)}
    >
      <summary className="flex min-h-11 cursor-pointer list-none flex-col gap-2 rounded-card px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-brand [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-ink">{titulo}</span>
          <span className="flex min-w-0 items-center gap-2">
            {resumo ? <span className="min-w-0 text-[13px] text-muted-foreground">{resumo}</span> : null}
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </span>
        </span>
        {selos ? <span className="flex flex-wrap gap-1.5">{selos}</span> : null}
      </summary>
      <div className="border-t border-border px-4 py-4">{children}</div>
    </details>
  );
}
