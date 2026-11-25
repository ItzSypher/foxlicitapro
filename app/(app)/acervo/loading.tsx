import { Skeleton } from "@/components/ui/skeleton";

/** Mesma forma da lista: título, busca, filtros e cartões. */
export default function CarregandoAcervo() {
  return (
    <div className="mx-auto flex w-full max-w-[960px] min-w-0 flex-col gap-4 lg:gap-6" aria-busy="true" role="status" aria-label="Carregando o acervo">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[22px] font-semibold leading-tight text-ink">Acervo</h1>
          <p className="text-sm text-muted-foreground">Atestados, notas fiscais, contratos e certidões da empresa, para achar rápido quando uma licitação pedir.</p>
        </div>
        <Skeleton className="h-11 w-32 shrink-0" />
      </header>
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
