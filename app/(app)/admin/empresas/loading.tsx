import { Skeleton } from "@/components/ui/skeleton";

/** Lista de empresas (nome, linha de dados, ação) e o cartão de nova empresa. */
export default function CarregandoAdminEmpresas() {
  return (
    <div className="flex max-w-[860px] min-w-0 flex-col gap-5" aria-busy="true" role="status" aria-label="Carregando as empresas">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] leading-tight font-semibold text-ink">Empresas</h1>
        <p className="text-sm text-muted-foreground">
          Cada empresa tem os próprios dados e a própria equipe. Empresa desativada não consegue entrar.
        </p>
      </header>
      <div className="flex flex-col gap-5">
        <Skeleton className="h-3.5 w-20" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3.5 w-full max-w-sm" />
              </div>
              <Skeleton className="h-11 w-full sm:w-28" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
          <Skeleton className="h-5 w-32" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full sm:w-28" />
          </div>
        </div>
      </div>
    </div>
  );
}
