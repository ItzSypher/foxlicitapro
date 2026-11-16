import { ROTULO_VEREDITO_CONSELHEIRO, type VereditoConselheiro } from "@/lib/conselheiro/esquema";
import { cn } from "@/lib/utils";

const COR: Record<VereditoConselheiro, string> = {
  vale: "bg-pill-pos-bg text-pill-pos-fg",
  talvez: "bg-pill-warn-bg text-pill-warn-fg",
  "nao-vale": "bg-pill-neg-bg text-pill-neg-fg",
};

/** Selo do veredito do conselheiro: verde vale, âmbar talvez, vermelho não vale. */
export function SeloConselheiro({ veredito, className }: { veredito: VereditoConselheiro; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-control px-1.5 text-[11px] leading-none font-medium whitespace-nowrap",
        COR[veredito],
        className,
      )}
    >
      {ROTULO_VEREDITO_CONSELHEIRO[veredito]}
    </span>
  );
}
