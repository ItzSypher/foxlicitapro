import type { Resultados } from "@/core/resultados";
import { formatarMoedaCurta, formatarPercentual, plural } from "@/lib/formato";
import { cn } from "@/lib/utils";

function Numero({ rotulo, valor, detalhe, tom }: { rotulo: string; valor: string; detalhe?: string; tom?: "bom" | "ruim" }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-card border border-border bg-surface p-4">
      <dt className="text-[13px] text-muted-foreground">{rotulo}</dt>
      <dd
        className={cn(
          "truncate text-2xl leading-tight font-semibold tabular-nums sm:text-3xl",
          tom === "bom" ? "text-positive" : tom === "ruim" ? "text-negative" : "text-ink",
        )}
      >
        {valor}
      </dd>
      {detalhe ? <p className="text-xs text-muted-foreground">{detalhe}</p> : null}
    </div>
  );
}

function percentualInteiro(taxa: number | null): string {
  return taxa === null ? "—" : `${Math.round(taxa * 100)}%`;
}

/** Os números do topo: dinheiro, desfecho e, por último, o funil e o caixa. */
export function Indicadores({ r }: { r: Resultados }) {
  const decididas = r.ganhas + r.perdidas;
  const temCusto = r.ganhas > r.ganhasSemCusto;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero rotulo="Valor ganho" valor={formatarMoedaCurta(r.valorGanho)} detalhe="Homologado, proposta ou estimado" />
        <Numero rotulo="Custo total" valor={temCusto ? formatarMoedaCurta(r.custoTotal) : "—"} detalhe="Das ganhas com custo informado" />
        <Numero
          rotulo="Lucro total"
          valor={temCusto ? formatarMoedaCurta(r.lucroTotal) : "—"}
          tom={temCusto ? (r.lucroTotal < 0 ? "ruim" : "bom") : undefined}
          detalhe="Valor menos custo real"
        />
        <Numero
          rotulo="Margem média"
          valor={r.margemMedia === null ? "—" : formatarPercentual(r.margemMedia)}
          tom={r.margemMedia === null ? undefined : r.margemMedia < 0 ? "ruim" : "bom"}
          detalhe={r.margemMediaSimples === null ? "Ponderada pelo valor" : `Ponderada pelo valor. Média simples: ${formatarPercentual(r.margemMediaSimples)}`}
        />
        <Numero rotulo="Ganhas" valor={String(r.ganhas)} />
        <Numero rotulo="Perdidas" valor={String(r.perdidas)} />
        <Numero
          rotulo="Taxa de vitória"
          valor={percentualInteiro(r.taxaVitoria)}
          detalhe={decididas === 0 ? "Sem disputa decidida no período" : `${decididas} ${plural(decididas, "disputa decidida", "disputas decididas")}`}
        />
        <Numero
          rotulo="Ticket médio"
          valor={r.ticketMedio === null ? "—" : formatarMoedaCurta(r.ticketMedio)}
          detalhe="Valor ganho por licitação ganha"
        />
      </dl>

      {r.ganhasSemCusto > 0 ? (
        <p className="rounded-control border border-border bg-pill-warn-bg px-3 py-2 text-sm text-pill-warn-fg">
          {r.ganhasSemCusto} {plural(r.ganhasSemCusto, "ganha sem custo informado", "ganhas sem custo informado")}: entram no valor,
          mas ficam fora do lucro e da margem. Informe o custo na lista abaixo.
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {r.analisadas !== null ? <Numero rotulo="Licitações analisadas" valor={String(r.analisadas)} /> : null}
        {r.propostasEnviadas !== null ? <Numero rotulo="Propostas enviadas" valor={String(r.propostasEnviadas)} /> : null}
        <Numero rotulo="Receita mensal contratada" valor={formatarMoedaCurta(r.receitaMensal)} detalhe="Ganhas com medição mensal" />
        <Numero
          rotulo="Capital de giro comprometido"
          valor={formatarMoedaCurta(r.capitalComprometido)}
          detalhe={
            r.ganhasEmAndamento === 0
              ? "Nenhuma ganha em andamento hoje"
              : `Estimado em ${r.ganhasEmAndamento} ${plural(r.ganhasEmAndamento, "ganha em andamento", "ganhas em andamento")} hoje`
          }
        />
      </dl>
    </div>
  );
}
