import { Skeleton } from "@/components/ui/skeleton";

function CartaoLista({ chips }: { chips: number }) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
      <Skeleton className="h-5 w-48 max-w-full" />
      <Skeleton className="h-3.5 w-full max-w-md" />
      <div className="flex flex-wrap gap-2 py-1">
        {Array.from({ length: chips }, (_, i) => (
          <Skeleton key={i} className="h-11 w-24 rounded-full" />
        ))}
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-11 min-w-0 flex-1" />
        <Skeleton className="h-11 w-28 shrink-0" />
      </div>
    </div>
  );
}

/** Três listas de termos, o interruptor do resumo e os limites de caixa, como no formulário. */
export default function CarregandoPreferencias() {
  return (
    <div className="flex max-w-[720px] flex-col gap-5" aria-busy="true" role="status" aria-label="Carregando as preferências">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] leading-tight font-semibold text-ink">Preferências</h1>
        <p className="text-sm text-muted-foreground">Aqui você diz o que quer ver no Radar e quem recebe o resumo por e-mail.</p>
      </div>
      <div className="flex flex-col gap-4">
        <CartaoLista chips={3} />
        <CartaoLista chips={2} />
        <CartaoLista chips={1} />
        <div className="flex items-center justify-between gap-4 rounded-card border border-border bg-surface p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3.5 w-full max-w-sm" />
          </div>
          <Skeleton className="h-7 w-12 shrink-0 rounded-full" />
        </div>
        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3.5 w-full" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-[68px] w-full" />
            <Skeleton className="h-[68px] w-full" />
          </div>
        </div>
        <Skeleton className="h-11 w-full md:w-44" />
      </div>
    </div>
  );
}
