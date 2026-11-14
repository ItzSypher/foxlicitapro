import { Skeleton } from "@/components/ui/skeleton";

/** Mesma forma da lista: título, abas, busca e linhas de duas linhas. */
export default function CarregandoPropostas() {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-6" aria-busy="true" role="status" aria-label="Carregando as propostas">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[22px] font-semibold leading-tight text-ink">Propostas</h1>
          <p className="text-sm text-muted-foreground">Edite, mande para revisão e envie depois de aprovada.</p>
        </div>
        <Skeleton className="h-11 w-36 shrink-0" />
      </header>
      <div className="flex flex-col gap-4">
        <div className="flex gap-4 border-b border-border">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="mb-2 h-5 flex-1" />
          ))}
        </div>
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-4 w-24" />
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex min-h-14 flex-col justify-center gap-2 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3.5 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
