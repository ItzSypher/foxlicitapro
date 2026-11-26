import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Faixa do resumo do dia: uma superfície só, dividida por filetes de 1px (gap sobre o tom do filete).
 * 4 colunas no celular (só os 4 números), 4 no tablet e 6 no desktop largo (a região pesa 1,6).
 */
export const GRADE_PAINEL =
  "grid grid-cols-4 gap-px overflow-hidden rounded-card bg-rule xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.6fr)_minmax(0,1fr)]";
export const COLUNAS_REGIAO = "md:col-span-3 xl:col-span-1";
export const COLUNAS_PIPELINE = "";

const CELULAS: ReadonlyArray<string> = ["", "", "", "max-md:hidden", cn("max-md:hidden", COLUNAS_REGIAO), COLUNAS_PIPELINE];

/** Esqueleto do resumo do dia: mesma faixa e mesmas alturas das células, barras planas. */
export function PainelEsqueleto() {
  return (
    <section aria-hidden="true" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className={GRADE_PAINEL}>
        {CELULAS.map((colunas, i) => (
          <div key={i} className={cn("flex min-h-16 flex-col gap-2 bg-surface p-2.5 md:min-h-[104px] md:p-4", colunas)}>
            <Skeleton className="h-4 w-full max-w-24" />
            <Skeleton className="h-8 w-full max-w-16" />
            <Skeleton className="h-3 w-full max-w-28 max-md:hidden" />
          </div>
        ))}
      </div>
    </section>
  );
}
