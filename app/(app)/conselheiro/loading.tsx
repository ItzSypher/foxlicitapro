import { Skeleton } from "@/components/ui/skeleton";

/** Mesma forma da tela: título, busca, filtros e linhas da lista. */
export default function CarregandoConselheiro() {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-6" aria-busy="true" role="status" aria-label="Carregando o conselheiro">
      <header className="flex min-w-0 flex-col gap-1">
        <h1 className="text-[22px] leading-tight font-semibold text-ink">Conselheiro</h1>
        <Skeleton className="h-4 w-72 max-w-full" />
      </header>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <Skeleton className="h-11 w-full" />
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-24 shrink-0 lg:h-9" />
            ))}
          </div>
          <div className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex min-h-14 flex-col justify-center gap-2 px-4 py-3">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3.5 w-1/2" />
              </div>
            ))}
          </div>
        </div>
        <div className="hidden min-w-0 flex-col gap-4 lg:flex">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}
