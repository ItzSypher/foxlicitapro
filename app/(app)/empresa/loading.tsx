import { Skeleton } from "@/components/ui/skeleton";

/** Nome fantasia, atividades com a frente de cada uma e as regiões, na ordem do formulário. */
export default function CarregandoEmpresa() {
  return (
    <div className="flex max-w-[720px] min-w-0 flex-col gap-5" aria-busy="true" role="status" aria-label="Carregando a empresa">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] leading-tight font-semibold text-ink">Empresa</h1>
        <Skeleton className="h-4 w-80 max-w-full" />
      </header>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
          <Skeleton className="h-5 w-56 max-w-full" />
          <Skeleton className="h-3.5 w-full" />
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-control border border-border p-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3.5 w-3/4" />
              </div>
              <Skeleton className="h-11 w-full sm:w-36" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
          <Skeleton className="h-5 w-44" />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex min-h-11 items-center gap-3">
              <Skeleton className="size-5" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
        <Skeleton className="h-11 w-full sm:w-24" />
      </div>
    </div>
  );
}
