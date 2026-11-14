import { Skeleton } from "@/components/ui/skeleton";

/** Lista de pessoas (nome, e-mail, pílulas, resumo, ações) e o cartão de adicionar. */
export default function CarregandoEquipe() {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-6" aria-busy="true" role="status" aria-label="Carregando a equipe">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Equipe</h1>
        <p className="text-sm text-muted-foreground">Quem acessa o painel. Cada pessoa entra com o próprio e-mail e senha.</p>
      </header>
      <div className="flex max-w-2xl min-w-0 flex-col gap-4">
        <Skeleton className="h-3.5 w-16" />
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col gap-3 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
                <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
              </div>
              <Skeleton className="h-3.5 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-11 w-32" />
                <Skeleton className="h-11 w-32" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </div>
  );
}
