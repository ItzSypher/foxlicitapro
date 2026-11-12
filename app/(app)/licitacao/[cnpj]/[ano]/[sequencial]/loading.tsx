import { Skeleton } from "@/components/ui/skeleton";

export default function CarregandoLicitacao() {
  return (
    <div className="flex min-w-0 flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-11 w-20" />
        <Skeleton className="h-6 w-full max-w-xl" />
        <Skeleton className="h-6 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>

      <div className="grid gap-4 rounded-card border border-border bg-surface p-4 md:grid-cols-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-11 w-36" />
        <Skeleton className="h-11 w-40" />
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-24" />
        <div className="grid grid-cols-2 gap-4 rounded-card border border-border bg-surface p-4 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-16" />
        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
