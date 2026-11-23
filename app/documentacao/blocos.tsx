import type { LucideIcon } from "lucide-react";
import { Entrada, ListaEscalonada } from "@/components/ui/movimento";
import { cn } from "@/lib/utils";

/** Peças de layout compartilhadas pelas seções da documentação. */

export function Secao({
  id,
  titulo,
  resumo,
  icone: Icone,
  children,
}: {
  id: string;
  titulo: string;
  resumo: string;
  icone: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-20 py-8 sm:py-10">
      <Entrada className="mb-5 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-raised text-brand">
          <Icone className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-titulo`} className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            {titulo}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{resumo}</p>
        </div>
      </Entrada>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function Cartao({
  titulo,
  icone: Icone,
  children,
  className,
}: {
  titulo?: string;
  icone?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-xl border border-border bg-surface p-4 sm:p-5", className)}>
      {titulo ? (
        <h3 className="mb-2 flex items-center gap-2 text-base font-semibold text-ink">
          {Icone ? <Icone className="size-4 shrink-0 text-brand" aria-hidden="true" /> : null}
          {titulo}
        </h3>
      ) : null}
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

export function Grade({ children }: { children: React.ReactNode }) {
  return <ListaEscalonada className="grid gap-4 sm:grid-cols-2" classeItem="flex min-w-0 [&>*]:w-full">{children}</ListaEscalonada>;
}

export function Grade3({ children }: { children: React.ReactNode }) {
  return <ListaEscalonada className="grid gap-4 sm:grid-cols-3" classeItem="flex min-w-0 [&>*]:w-full">{children}</ListaEscalonada>;
}

export function Lista({ itens }: { itens: ReadonlyArray<React.ReactNode> }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {itens.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-fill" />
          <span className="min-w-0 break-words">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Codigo({ children }: { children: React.ReactNode }) {
  return <code className="rounded-md bg-raised px-1.5 py-0.5 font-mono text-[0.8125rem] break-words text-ink">{children}</code>;
}
