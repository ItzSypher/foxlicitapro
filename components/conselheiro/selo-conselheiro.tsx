import { ROTULO_VEREDITO_CONSELHEIRO, type VereditoConselheiro } from "@/lib/conselheiro/esquema";
import { cn } from "@/lib/utils";

const COR: Record<VereditoConselheiro, string> = {
  vale: "border-positive text-positive",
  talvez: "border-brand text-brand",
  "nao-vale": "border-negative text-negative",
};

/** Selo do veredito do conselheiro: verde vale, azul talvez, vermelho não vale. */
export function SeloConselheiro({ veredito, className }: { veredito: VereditoConselheiro; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-control border px-1.5 text-[11px] leading-none font-medium whitespace-nowrap",
        COR[veredito],
        className,
      )}
    >
      {ROTULO_VEREDITO_CONSELHEIRO[veredito]}
    </span>
  );
}
