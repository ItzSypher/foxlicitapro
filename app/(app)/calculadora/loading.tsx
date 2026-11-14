import { Skeleton } from "@/components/ui/skeleton";

function CampoFantasma({ rotulo = "w-28" }: { rotulo?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className={`h-3.5 ${rotulo}`} />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}

/** Formulário à esquerda, resultado à direita e a lista de cotações, no mesmo ritmo da tela. */
export default function CarregandoCalculadora() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" role="status" aria-label="Carregando a calculadora">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Calculadora</h1>
        <p className="text-sm text-muted-foreground">Quanto cobrar sem tomar prejuízo.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)] lg:gap-x-8">
        <div className="flex flex-col gap-4">
          <CampoFantasma />
          <CampoFantasma rotulo="w-14" />
          <CampoFantasma rotulo="w-32" />
          <CampoFantasma rotulo="w-44" />
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
            <CampoFantasma rotulo="w-36" />
            <CampoFantasma rotulo="w-32" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CampoFantasma rotulo="w-24" />
            <CampoFantasma rotulo="w-20" />
          </div>
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="flex flex-col gap-5 rounded-card border border-border bg-surface p-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
          <div className="grid gap-5 border-t border-border pt-5 sm:grid-cols-2">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            ))}
          </div>
          <Skeleton className="h-3 w-full" />
        </div>
        <div className="flex flex-col gap-2 lg:col-start-1 lg:row-start-2">
          <Skeleton className="h-5 w-36" />
          <div className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex min-h-11 flex-col justify-center gap-1.5 px-3 py-2.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3.5 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
