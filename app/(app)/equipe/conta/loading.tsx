import { Skeleton } from "@/components/ui/skeleton";

export default function CarregandoConta() {
  return (
    <div className="flex max-w-md min-w-0 flex-col gap-4 lg:gap-6" aria-busy="true" role="status" aria-label="Carregando a conta">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Minha conta</h1>
        <Skeleton className="h-4 w-40" />
      </header>
      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
        <Skeleton className="h-5 w-28" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
        <Skeleton className="h-11 w-full sm:w-32" />
      </div>
    </div>
  );
}
