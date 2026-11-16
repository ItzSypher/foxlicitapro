import { Skeleton } from "@/components/ui/skeleton";

/** Mesma forma da página: título, período, filtros e os números. */
export default function CarregandoResultados() {
  return (
    <div
      className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4 lg:gap-6"
      aria-busy="true"
      role="status"
      aria-label="Carregando os resultados"
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Resultados</h1>
        <p className="text-sm text-muted-foreground">O que o pipeline já entregou, com custo, lucro e motivos de perda.</p>
      </header>
      <Skeleton className="h-11 w-full max-w-md" />
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}
