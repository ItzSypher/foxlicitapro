import { Skeleton } from "@/components/ui/skeleton";

/** Mesma forma da lista: título, busca e linhas de duas linhas. */
export default function CarregandoFornecedores() {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-6" aria-busy="true" role="status" aria-label="Carregando os fornecedores">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[22px] font-semibold leading-tight text-ink">Fornecedores</h1>
          <p className="text-sm text-muted-foreground">Quem vende para você e quanto cobrou.</p>
        </div>
        <Skeleton className="h-11 w-40 shrink-0" />
      </header>
      <Skeleton className="h-11 w-full" />
      <div className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex min-h-14 flex-col justify-center gap-2 px-4 py-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
