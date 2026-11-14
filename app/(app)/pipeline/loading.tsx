import { Skeleton } from "@/components/ui/skeleton";

/** Cards por coluna no desktop; no celular só a primeira aparece, com 3 cards. */
const COLUNAS = [3, 2, 2, 1, 1, 1, 1, 1] as const;
const SEGMENTOS = ["w-24", "w-32", "w-32", "w-28", "w-28", "w-24"] as const;

function CardEsqueleto() {
  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}

export default function CarregandoPipeline() {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-5" aria-busy="true">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-[22px] font-semibold leading-tight text-ink">Pipeline</h1>
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
        <Skeleton className="h-11 w-28 shrink-0" />
      </div>

      <div className="-mx-4 flex gap-1 overflow-hidden px-4 md:hidden" aria-hidden="true">
        {SEGMENTOS.map((largura, i) => (
          <Skeleton key={i} className={`h-11 shrink-0 ${largura}`} />
        ))}
      </div>

      <div className="flex min-w-0 items-start gap-3 overflow-hidden md:h-[calc(100dvh-17rem)] md:items-stretch lg:h-[calc(100dvh-13rem)]">
        {COLUNAS.map((cards, i) => (
          <div
            key={i}
            aria-hidden="true"
            className={`w-full shrink-0 flex-col md:flex md:h-full md:w-[288px] md:rounded-card md:border md:border-border md:bg-ground ${i === 0 ? "flex" : "hidden"}`}
          >
            <div className="flex items-center justify-between gap-2 px-1 pt-1 pb-2 md:px-3 md:pt-3 md:pb-1">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-14" />
            </div>
            <div className="flex flex-col gap-2 md:p-2">
              {Array.from({ length: i === 0 ? 3 : cards }, (_, k) => (
                <CardEsqueleto key={k} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
