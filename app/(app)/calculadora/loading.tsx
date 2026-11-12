import { Skeleton } from "@/components/ui/skeleton";

export default function CarregandoCalculadora() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Carregando a calculadora">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Calculadora</h1>
        <p className="text-sm text-muted-foreground">Quanto cobrar sem tomar prejuízo.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)] lg:gap-x-8">
        <div className="flex flex-col gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[68px] w-full" />
          ))}
        </div>
        <Skeleton className="h-[320px] w-full" />
      </div>
    </div>
  );
}
