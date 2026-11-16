import { Skeleton } from "@/components/ui/skeleton";

/** Mesma forma da lista: título, filtro de região e cartões. */
export default function CarregandoEncerradas() {
  return (
    <div
      className="mx-auto flex w-full max-w-[960px] min-w-0 flex-col gap-4 lg:gap-5"
      aria-busy="true"
      role="status"
      aria-label="Carregando as licitações encerradas"
    >
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Encerradas</h1>
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <Skeleton className="h-11 w-full" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2.5 rounded-card border border-border bg-surface p-3 sm:p-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
    </div>
  );
}
