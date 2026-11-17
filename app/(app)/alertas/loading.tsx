import { Skeleton } from "@/components/ui/skeleton";

/** Cartão do WhatsApp e três cartões de texto, como na página. */
export default function CarregandoAlertas() {
  return (
    <div className="mx-auto flex w-full max-w-[720px] min-w-0 flex-col gap-5" aria-busy="true" role="status" aria-label="Carregando os alertas">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] leading-tight font-semibold text-ink">Alertas</h1>
        <p className="text-sm text-muted-foreground">Receba no WhatsApp o que precisa da sua atenção, sem abrir o painel.</p>
      </div>
      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3.5 w-full max-w-md" />
        <Skeleton className="h-11 w-full sm:w-44" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
      ))}
    </div>
  );
}
