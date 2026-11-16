import { CardEsqueleto } from "@/components/radar/estados";
import { Skeleton } from "@/components/ui/skeleton";

export default function CarregandoForaRj() {
  return (
    <div className="flex flex-col gap-4 lg:gap-5" role="status" aria-label="Consultando o PNCP">
      <div className="flex flex-col gap-2">
        <h1 className="text-[22px] leading-tight font-semibold text-ink">Fora do RJ</h1>
        <p className="text-sm text-muted-foreground">Consultando o PNCP. A busca pode levar alguns segundos…</p>
      </div>
      <Skeleton className="h-4 w-full max-w-md" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <CardEsqueleto key={i} />
        ))}
      </div>
    </div>
  );
}
