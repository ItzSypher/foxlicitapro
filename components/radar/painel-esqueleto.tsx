import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Grade do resumo do dia: 2 colunas no celular, 3 no tablet e 7 no desktop largo (a região ocupa 2). */
export const GRADE_PAINEL = "grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-7";
export const COLUNAS_REGIAO = "col-span-2 md:col-span-1 xl:col-span-2";
export const COLUNAS_PIPELINE = "col-span-2 md:col-span-1";

const CARTOES: ReadonlyArray<string> = ["", "", "", "", COLUNAS_REGIAO, COLUNAS_PIPELINE];

/** Esqueleto do resumo do dia: mesma grade e altura dos cartões, barras planas. */
export function PainelEsqueleto() {
  return (
    <section aria-hidden="true" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className={GRADE_PAINEL}>
        {CARTOES.map((colunas, i) => (
          <div
            key={i}
            className={cn(
              "flex min-h-[116px] flex-col gap-3 rounded-card border border-border bg-surface p-3.5 md:p-4",
              colunas,
            )}
          >
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </section>
  );
}
