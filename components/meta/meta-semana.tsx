import { ChevronDown } from "lucide-react";
import { percentualDaBarra, posicaoDoMinimo, type PainelMeta, type StatusMeta } from "@/core/meta";
import { plural } from "@/lib/formato";
import { cn } from "@/lib/utils";

const ROTULO_STATUS: Record<StatusMeta, string> = {
  abaixo: "Abaixo do mínimo",
  minimo: "Mínimo batido",
  ideal: "Ideal batido",
};

const COR_TEXTO: Record<StatusMeta, string> = {
  abaixo: "text-warning",
  minimo: "text-brand",
  ideal: "text-positive",
};

const COR_BARRA: Record<StatusMeta, string> = {
  abaixo: "bg-warning",
  minimo: "bg-brand-fill",
  ideal: "bg-positive",
};

const formatoDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

function diaDaSemana(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? "" : formatoDia.format(data);
}

/** Lembrete da semana: quantas disputas faltam para a meta mínima (ou, batida ela, para a ideal). Null com a ideal batida. */
export function fraseDeLembrete(placar: PainelMeta["placar"]): string | null {
  if (placar.status === "ideal") return null;
  if (placar.status === "minimo") {
    const n = placar.faltamParaIdeal;
    return `Meta mínima batida, ${plural(n, "falta", "faltam")} ${n} para a ideal`;
  }
  const n = placar.faltamParaMinimo;
  return `${plural(n, "Falta", "Faltam")} ${n} ${plural(n, "disputa", "disputas")} para a meta mínima até domingo`;
}

function Numero({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xl leading-tight font-semibold tabular-nums text-ink">{valor.toLocaleString("pt-BR")}</span>
      <span className="text-xs text-muted-foreground">{rotulo}</span>
    </div>
  );
}

/**
 * Meta da semana: disputas que entraram na semana (segunda a domingo) contra o mínimo e o ideal da empresa.
 * Sempre à vista: placar e barra. Propostas e as quatro semanas anteriores abrem num toque.
 */
export function MetaSemana({ painel, className }: { painel: PainelMeta; className?: string }) {
  const { meta, placar, historico, propostas } = painel;
  const largura = percentualDaBarra(placar.disputas, meta);
  const marcaMinimo = posicaoDoMinimo(meta);
  const lembrete = fraseDeLembrete(placar);
  const maiorHistorico = Math.max(1, meta.ideal, ...historico.map((s) => s.disputas));

  return (
    <section aria-label="Meta da semana" data-tour="radar-meta" className={cn("rounded-card border border-border bg-surface", className)}>
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-col gap-2 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold text-ink">Meta da semana</span>
              <span className={cn("truncate text-xs font-medium", COR_TEXTO[placar.status])}>{ROTULO_STATUS[placar.status]}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-2xl leading-none font-semibold tabular-nums text-ink">
                {placar.disputas}
                <span className="text-base font-medium text-muted-foreground">/{meta.ideal}</span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className="size-4 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
              />
            </span>
          </span>
          <span
            role="progressbar"
            aria-label="Disputas na semana"
            aria-valuemin={0}
            aria-valuemax={meta.ideal}
            aria-valuenow={Math.min(placar.disputas, meta.ideal)}
            aria-valuetext={`${placar.disputas} de ${meta.ideal}, mínimo ${meta.minimo}`}
            className="relative block h-2 overflow-hidden rounded-full bg-raised"
          >
            <span
              className={cn(
                "block h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none",
                COR_BARRA[placar.status],
              )}
              style={{ width: `${largura}%` }}
            />
            <span aria-hidden="true" className="absolute inset-y-0 w-0.5 bg-ink/60" style={{ left: `${marcaMinimo}%` }} />
          </span>
          {lembrete === null ? null : <span className="text-xs text-muted-foreground">{lembrete}</span>}
        </summary>

        <div className="flex flex-col gap-3 px-4 pb-4">
          <p className="flex justify-between gap-3 text-xs text-muted-foreground tabular-nums">
            <span>mínimo {meta.minimo}</span>
            <span>ideal {meta.ideal}</span>
          </p>

          <div className="grid grid-cols-3 gap-3 border-t border-border pt-3">
            <Numero rotulo="Enviadas na semana" valor={propostas.enviadas} />
            <Numero rotulo="Aguardando resultado" valor={propostas.aguardando} />
            <Numero rotulo="Ganhas na semana" valor={propostas.ganhas} />
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">Últimas 4 semanas</span>
            <ul className="grid grid-cols-4 gap-2">
              {historico.map((s) => (
                <li
                  key={s.inicio}
                  aria-label={`Semana de ${diaDaSemana(s.inicio)}: ${s.disputas} ${s.disputas === 1 ? "disputa" : "disputas"}, ${ROTULO_STATUS[s.status].toLowerCase()}`}
                  className="flex min-w-0 flex-col items-center gap-1"
                >
                  <span className="text-sm font-semibold tabular-nums text-ink">{s.disputas}</span>
                  <span aria-hidden="true" className="flex h-8 w-full items-end overflow-hidden rounded-control bg-raised">
                    <span
                      className={cn("block w-full rounded-control", COR_BARRA[s.status])}
                      style={{ height: `${s.disputas === 0 ? 0 : Math.max(8, Math.round((s.disputas / maiorHistorico) * 100))}%` }}
                    />
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">{diaDaSemana(s.inicio)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </section>
  );
}
