import { Skeleton } from "@/components/ui/skeleton";

export default function CarregandoPreferencias() {
  return (
    <div className="flex max-w-[720px] flex-col gap-5" aria-busy="true">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] leading-tight font-semibold text-ink">Preferências</h1>
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
