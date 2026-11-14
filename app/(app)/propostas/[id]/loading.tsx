import { Skeleton } from "@/components/ui/skeleton";

/** Editor: voltar, título, ações, faixa de revisão, seções e a barra do total. */
export default function CarregandoProposta() {
  return (
    <div className="flex min-w-0 flex-col gap-4" aria-busy="true" role="status" aria-label="Carregando a proposta">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-14 w-full rounded-card" />
        <Skeleton className="h-12 w-full" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-11 w-32" />
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-11 w-28" />
        </div>
      </header>
      <div className="flex border-b border-border">
        <Skeleton className="mx-4 mb-2 h-5 flex-1" />
        <Skeleton className="mx-4 mb-2 h-5 flex-1" />
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <section key={i} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </section>
      ))}
    </div>
  );
}
