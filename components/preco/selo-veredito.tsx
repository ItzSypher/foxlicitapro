import { ROTULO_VEREDITO, type VereditoPreco } from "@/core/preco-sugerido";
import { cn } from "@/lib/utils";

const COR_VEREDITO: Record<VereditoPreco, string> = {
  vale: "border-positive text-positive",
  apertado: "border-brand text-brand",
  "nao-vale": "border-negative text-negative",
  "sem-custo": "border-border text-muted-foreground",
};

/** Selo do veredito do preço sugerido: verde vale, azul apertado, vermelho não vale, cinza sem custo. */
export function SeloVeredito({ veredito, className }: { veredito: VereditoPreco; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-control border px-1.5 text-[11px] leading-none font-medium whitespace-nowrap",
        COR_VEREDITO[veredito],
        className,
      )}
    >
      {ROTULO_VEREDITO[veredito]}
    </span>
  );
}
