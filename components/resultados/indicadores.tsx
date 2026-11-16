import type { Resultados } from "@/core/resultados";
import { formatarMoedaCurta, formatarPercentual, plural } from "@/lib/formato";
import { cn } from "@/lib/utils";

interface Indicador {
  rotulo: string;
  /** null: ainda sem dado (entra na nota do grupo, não vira uma caixa com traço) */
  valor: string | null;
  detalhe?: string;
  tom?: "bom" | "ruim";
}

function Numero({ rotulo, valor, detalhe, tom }: { rotulo: string; valor: string; detalhe?: string; tom?: "bom" | "ruim" }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
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

/** Um grupo de números grandes em faixa; o que ainda não tem dado vira uma nota só, no fim do grupo. */
function Grupo({ titulo, indicadores, children }: { titulo: string; indicadores: ReadonlyArray<Indicador>; children?: React.ReactNode }) {
  const comDado = indicadores.filter((i): i is Indicador & { valor: string } => i.valor !== null);
  const semDado = indicadores.filter((i) => i.valor === null);
  return (
    <section aria-label={titulo} className="flex min-w-0 flex-col gap-4 border-t border-rule pt-5 first:border-t-0 first:pt-0">
      <h2 className="text-sm font-semibold text-ink">{titulo}</h2>
      {comDado.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
          {comDado.map((i) => (
            <Numero key={i.rotulo} rotulo={i.rotulo} valor={i.valor} detalhe={i.detalhe} tom={i.tom} />
          ))}
        </dl>
      ) : null}
      {semDado.length > 0 ? (
        <p className="text-[13px] text-muted-foreground">
          Sem dados ainda: {semDado.map((i) => i.rotulo.toLowerCase()).join(", ")}.
        </p>
      ) : null}
      {children}
    </section>
  );
}

/** Os números do topo, em três grupos: dinheiro, desfecho das disputas e, por último, o funil e o caixa. */
export function Indicadores({ r }: { r: Resultados }) {
  const decididas = r.ganhas + r.perdidas;
  const temCusto = r.ganhas > r.ganhasSemCusto;

  const dinheiro: Indicador[] = [
    { rotulo: "Valor ganho", valor: formatarMoedaCurta(r.valorGanho), detalhe: "Homologado, proposta ou estimado" },
    { rotulo: "Custo total", valor: temCusto ? formatarMoedaCurta(r.custoTotal) : null, detalhe: "Das ganhas com custo informado" },
    {
      rotulo: "Lucro total",
      valor: temCusto ? formatarMoedaCurta(r.lucroTotal) : null,
      tom: temCusto ? (r.lucroTotal < 0 ? "ruim" : "bom") : undefined,
      detalhe: "Valor menos custo real",
    },
    {
      rotulo: "Margem média",
      valor: r.margemMedia === null ? null : formatarPercentual(r.margemMedia),
      tom: r.margemMedia === null ? undefined : r.margemMedia < 0 ? "ruim" : "bom",
      detalhe: r.margemMediaSimples === null ? "Ponderada pelo valor" : `Ponderada pelo valor. Média simples: ${formatarPercentual(r.margemMediaSimples)}`,
    },
  ];

  const desfecho: Indicador[] = [
    { rotulo: "Ganhas", valor: String(r.ganhas) },
    { rotulo: "Perdidas", valor: String(r.perdidas) },
    {
      rotulo: "Taxa de vitória",
      valor: r.taxaVitoria === null ? null : `${Math.round(r.taxaVitoria * 100)}%`,
      detalhe: `${decididas} ${plural(decididas, "disputa decidida", "disputas decididas")}`,
    },
    {
      rotulo: "Ticket médio",
      valor: r.ticketMedio === null ? null : formatarMoedaCurta(r.ticketMedio),
      detalhe: "Valor ganho por licitação ganha",
    },
  ];

  const funil: Indicador[] = [];
  if (r.analisadas !== null) funil.push({ rotulo: "Licitações analisadas", valor: String(r.analisadas) });
  if (r.propostasEnviadas !== null) funil.push({ rotulo: "Propostas enviadas", valor: String(r.propostasEnviadas) });
  funil.push({ rotulo: "Receita mensal contratada", valor: formatarMoedaCurta(r.receitaMensal), detalhe: "Ganhas com medição mensal" });
  funil.push({
    rotulo: "Capital de giro comprometido",
    valor: formatarMoedaCurta(r.capitalComprometido),
    detalhe:
      r.ganhasEmAndamento === 0
        ? "Nenhuma ganha em andamento hoje"
        : `Estimado em ${r.ganhasEmAndamento} ${plural(r.ganhasEmAndamento, "ganha em andamento", "ganhas em andamento")} hoje`,
  });

  return (
    <div className="flex min-w-0 flex-col gap-5 rounded-card bg-surface p-4 md:p-5">
      <Grupo titulo="Dinheiro" indicadores={dinheiro}>
        {r.ganhasSemCusto > 0 ? (
          <p className="rounded-control bg-pill-warn-bg px-3 py-2 text-sm text-pill-warn-fg">
            {r.ganhasSemCusto} {plural(r.ganhasSemCusto, "ganha sem custo informado", "ganhas sem custo informado")}: entram no valor,
            mas ficam fora do lucro e da margem. Informe o custo na lista abaixo.
          </p>
        ) : null}
      </Grupo>
      <Grupo titulo="Desfecho das disputas" indicadores={desfecho} />
      <Grupo titulo="Funil e caixa" indicadores={funil} />
    </div>
  );
}
