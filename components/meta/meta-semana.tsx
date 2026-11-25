import { ChevronDown } from "lucide-react";
import { linhaDeGanhos, percentualDaBarra, posicaoDoMinimo, type PainelMeta, type StatusMeta } from "@/core/meta";
import { formatarMoedaCurta, plural } from "@/lib/formato";
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

function formatarValorDaSemana(valor: number, estimado: boolean): string {
  return valor > 0 ? `${estimado ? "~" : ""}${formatarMoedaCurta(valor)}` : "R$ 0";
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
export function MetaSemana({ painel, compacta = false, className }: { painel: PainelMeta; compacta?: boolean; className?: string }) {
  const { meta, placar, historico, propostas, ganhos } = painel;
  const largura = percentualDaBarra(placar.disputas, meta);
  const marcaMinimo = posicaoDoMinimo(meta);
  const lembrete = fraseDeLembrete(placar);
  const maiorHistorico = Math.max(1, meta.ideal, ...historico.map((s) => s.disputas));
  const linhaGanhos = linhaDeGanhos(ganhos.semana, formatarMoedaCurta);

  const barra = (
    <span
      role="progressbar"
      aria-label="Disputas na semana"
      aria-valuemin={0}
      aria-valuemax={meta.ideal}
      aria-valuenow={Math.min(placar.disputas, meta.ideal)}
      aria-valuetext={`${placar.disputas} de ${meta.ideal}, mínimo ${meta.minimo}`}
      className={cn("relative block h-2 overflow-hidden rounded-full bg-raised", compacta && "min-w-12 flex-1")}
    >
      <span
        className={cn("block h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none", COR_BARRA[placar.status])}
        style={{ width: `${largura}%` }}
      />
      <span aria-hidden="true" className="absolute inset-y-0 w-0.5 bg-ink/60" style={{ left: `${marcaMinimo}%` }} />
    </span>
  );

  const seta = (
    <ChevronDown
      aria-hidden="true"
      className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
    />
  );

  return (
    <section aria-label="Meta da semana" data-tour="radar-meta" className={cn("rounded-card border border-border bg-surface", className)}>
      <details className="group">
        {compacta ? (
          // Uma linha só: no Pipeline o espaço é dos cards. O resto abre num toque.
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-3 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 shrink-0 flex-col leading-tight">
              <span className="text-[13px] font-semibold text-ink">Meta da semana</span>
              <span className={cn("truncate text-[11px] font-medium", COR_TEXTO[placar.status])}>{ROTULO_STATUS[placar.status]}</span>
            </span>
            {barra}
            <span className="shrink-0 text-lg leading-none font-semibold tabular-nums text-ink">
              {placar.disputas}
              <span className="text-sm font-medium text-muted-foreground">/{meta.ideal}</span>
            </span>
            <span className="hidden min-w-0 truncate text-xs font-medium tabular-nums text-ink md:block md:max-w-[40%]">{linhaGanhos}</span>
            {seta}
          </summary>
        ) : (
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
                {seta}
              </span>
            </span>
            {barra}
            {lembrete === null ? null : <span className="text-xs text-muted-foreground">{lembrete}</span>}
            <span className="text-xs font-medium tabular-nums text-ink">{linhaGanhos}</span>
          </summary>
        )}

        <div className={cn("flex flex-col gap-3 px-4 pb-4", compacta && "max-h-[50dvh] overflow-y-auto pt-1")}>
          {compacta ? (
            <div className="flex flex-col gap-0.5">
              {lembrete === null ? null : <span className="text-xs text-muted-foreground">{lembrete}</span>}
              <span className="text-xs font-medium tabular-nums text-ink md:hidden">{linhaGanhos}</span>
            </div>
          ) : null}
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
            <span className="text-xs text-muted-foreground">Disputadas e vencidas por semana</span>
            <ul className="flex flex-col gap-1">
              {[...ganhos.historico, ganhos.semana].map((s, i, todas) => (
                <li key={s.inicio} className="flex items-baseline justify-between gap-3 text-xs tabular-nums">
                  <span className="text-muted-foreground">
                    {i === todas.length - 1 ? "Esta semana" : `Semana de ${diaDaSemana(s.inicio)}`}
                  </span>
                  <span className="text-right text-ink">
                    {s.disputadas} {s.disputadas === 1 ? "disputada" : "disputadas"} ({formatarValorDaSemana(s.valorDisputadas, s.estimadoDisputadas)})
                    {" · "}
                    {s.vencidas} {s.vencidas === 1 ? "vencida" : "vencidas"} ({formatarValorDaSemana(s.valorVencidas, s.estimadoVencidas)})
                  </span>
                </li>
              ))}
            </ul>
            <span className="text-[11px] text-muted-foreground">
              Valor da proposta aprovada, pronta ou enviada; sem proposta, o valor estimado do item (com ~).
            </span>
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
