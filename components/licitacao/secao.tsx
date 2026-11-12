import { cn } from "@/lib/utils";

/** Seção âncora da tela; o espaço de rolagem compensa a barra superior e os chips grudados. */
export function Secao({
  id,
  titulo,
  children,
  detalhe,
  className,
}: {
  id: string;
  titulo: string;
  children: React.ReactNode;
  /** Texto curto à direita do título (ex.: contagem) */
  detalhe?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className={cn("flex scroll-mt-[calc(52px+3.5rem)] flex-col gap-3 lg:scroll-mt-16", className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`${id}-titulo`} className="text-base font-semibold text-ink">
          {titulo}
        </h2>
        {detalhe ? <p className="text-[13px] text-muted-foreground">{detalhe}</p> : null}
      </div>
      {children}
    </section>
  );
}
