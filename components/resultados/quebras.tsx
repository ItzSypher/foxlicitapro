import type { MotivoResultado, QuebraResultado } from "@/core/resultados";
import { formatarMoedaCurta, plural } from "@/lib/formato";

/** Barra de CSS: largura proporcional ao maior valor do grupo. */
function Barra({ fracao }: { fracao: number }) {
  return (
    <div aria-hidden="true" className="h-1 w-full overflow-hidden rounded-full bg-raised">
      <div className="h-full rounded-full bg-ink/70" style={{ width: `${Math.max(0, Math.min(1, fracao)) * 100}%` }} />
    </div>
  );
}

/** Ganhas e perdidas por região ou por frente, com o valor ganho em barras e o lucro ao lado. */
export function BarrasQuebra({ titulo, itens }: { titulo: string; itens: ReadonlyArray<QuebraResultado> }) {
  const maximo = Math.max(...itens.map((q) => q.valorGanho), 0);
  return (
    <section aria-label={titulo} className="flex min-w-0 flex-col gap-3 rounded-card bg-surface p-4">
      <h2 className="text-base font-semibold text-ink">{titulo}</h2>
      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma licitação decidida no período.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {itens.map((q) => (
            <li key={q.chave} className="flex min-w-0 flex-col gap-1">
              <div className="flex min-w-0 items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-ink">{q.rotulo}</span>
                <span className="shrink-0 text-sm font-medium tabular-nums text-ink">{formatarMoedaCurta(q.valorGanho)}</span>
              </div>
              <Barra fracao={maximo > 0 ? q.valorGanho / maximo : 0} />
              <p className="text-xs text-muted-foreground">
                {q.ganhas} {plural(q.ganhas, "ganha", "ganhas")} · {q.perdidas} {plural(q.perdidas, "perdida", "perdidas")}
                {q.lucro !== 0 ? ` · lucro ${formatarMoedaCurta(q.lucro)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Por que se perdeu, do motivo mais comum ao menos comum. */
export function BarrasMotivos({ motivos }: { motivos: ReadonlyArray<MotivoResultado> }) {
  const maximo = Math.max(...motivos.map((m) => m.quantidade), 0);
  return (
    <section aria-label="Motivos de perda" className="flex min-w-0 flex-col gap-3 rounded-card bg-surface p-4">
      <h2 className="text-base font-semibold text-ink">Motivos de perda</h2>
      {motivos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma licitação perdida no período.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {motivos.map((m) => (
            <li key={m.motivo} className="flex min-w-0 flex-col gap-1">
              <div className="flex min-w-0 items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-ink">{m.rotulo}</span>
                <span className="shrink-0 text-sm font-medium tabular-nums text-ink">{m.quantidade}</span>
              </div>
              <Barra fracao={maximo > 0 ? m.quantidade / maximo : 0} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
