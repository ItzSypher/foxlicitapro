import { fonteDaOportunidade } from "@/core/fonte";
import { cn } from "@/lib/utils";

/** Selo discreto com o portal de origem da contratação (Compras.gov, BNC, BLL...). */
export function SeloFonte({ linkOrigem, className }: { linkOrigem: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit max-w-full items-center truncate rounded-full border border-border bg-raised px-2 py-0.5 text-[11px] leading-4 font-medium text-muted-foreground",
        className,
      )}
    >
      {fonteDaOportunidade(linkOrigem)}
    </span>
  );
}
