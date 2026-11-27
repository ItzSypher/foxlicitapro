import { cn } from "@/lib/utils";

export type TomPilula = "neutro" | "positivo" | "negativo" | "aviso";

const TONS: Record<TomPilula, string> = {
  neutro: "bg-pill-neutral-bg text-pill-neutral-fg",
  positivo: "bg-pill-pos-bg text-pill-pos-fg",
  negativo: "bg-pill-neg-bg text-pill-neg-fg",
  aviso: "bg-pill-warn-bg text-pill-warn-fg",
};

export function Pilula({
  tom,
  children,
  className,
  title,
}: {
  tom: TomPilula;
  children: React.ReactNode;
  className?: string;
  /** Explicação que aparece ao pairar, para o que não cabe na pílula */
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-5 items-center whitespace-nowrap rounded-full px-2 text-xs font-medium",
        TONS[tom],
        className,
      )}
    >
      {children}
    </span>
  );
}
