import { Skeleton } from "@/components/ui/skeleton";

const COLUNAS = [3, 2, 2, 1, 1, 1, 1] as const;

export default function CarregandoPipeline() {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-5" aria-busy="true">
      <div className="flex flex-col gap-2">
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Pipeline</h1>
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>

      <div className="flex gap-1 overflow-hidden lg:hidden">
        {COLUNAS.map((_, i) => (
          <Skeleton key={i} className="h-11 w-28 shrink-0" />
        ))}
      </div>

      <div className="min-w-0 lg:h-[calc(100dvh-13rem)] lg:overflow-hidden">
        <div className="flex flex-col lg:h-full lg:flex-row lg:gap-3">
          {COLUNAS.map((cards, i) => (
            <div
              key={i}
              aria-hidden="true"
              className={`min-w-0 flex-col rounded-card border border-border bg-ground lg:flex lg:h-full lg:w-[280px] lg:shrink-0 ${i === 0 ? "flex" : "hidden"}`}
            >
              <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-14" />
              </div>
              <div className="flex flex-col gap-2 p-2">
                {Array.from({ length: cards }, (_, k) => (
                  <div
                    key={k}
                    className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3"
                  >
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-6" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
