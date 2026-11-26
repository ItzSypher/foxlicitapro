import { Skeleton } from "@/components/ui/skeleton";

/** Mesma forma da página: título, os três números e a primeira lista do mês. */
export default function CarregandoCaixa() {
  return (
    <div className="mx-auto flex w-full max-w-[720px] min-w-0 flex-col gap-5" aria-busy="true" role="status" aria-label="Carregando o caixa">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] leading-tight font-semibold text-ink">Caixa</h1>
        <Skeleton className="h-4 w-64 max-w-full" />
      </header>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border sm:grid-cols-3">
        <Skeleton className="h-24 rounded-none" />
        <Skeleton className="h-24 rounded-none" />
        <Skeleton className="col-span-2 h-24 rounded-none sm:col-span-1" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </div>
  );
}
