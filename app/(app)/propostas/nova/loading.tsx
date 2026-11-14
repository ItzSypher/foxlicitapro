import { Skeleton } from "@/components/ui/skeleton";

/** Cabeçalho e os cartões de modelo, na mesma grade da escolha. */
export default function CarregandoNovaProposta() {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-6" aria-busy="true" role="status" aria-label="Carregando os modelos">
      <header className="flex flex-col gap-1">
        <Skeleton className="my-2 h-4 w-20" />
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Nova proposta</h1>
        <p className="text-sm text-muted-foreground">Escolha o modelo para começar.</p>
      </header>
      <ul className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i}>
            <Skeleton className="h-[92px] w-full rounded-card" />
          </li>
        ))}
      </ul>
    </div>
  );
}
