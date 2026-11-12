import { CardEsqueleto } from "@/components/radar/estados";
import { Skeleton } from "@/components/ui/skeleton";

export default function CarregandoRadar() {
  return (
    <div className="flex flex-col gap-4 lg:gap-5" role="status" aria-label="Carregando oportunidades">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[22px] leading-tight font-semibold text-ink">Radar</h1>
        <Skeleton className="h-11 w-11 md:h-9 md:w-[200px]" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {[112, 128, 176, 120].map((largura, i) => (
          <Skeleton key={i} className="h-11 shrink-0 lg:h-9" style={{ width: largura }} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <CardEsqueleto key={i} />
        ))}
      </div>
    </div>
  );
}
