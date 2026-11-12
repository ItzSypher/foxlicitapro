import { Skeleton } from "@/components/ui/skeleton";

export default function CarregandoEquipe() {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-6" aria-busy="true" role="status" aria-label="Carregando">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="flex max-w-2xl flex-col gap-2">
        {Array.from({ length: 2 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}
