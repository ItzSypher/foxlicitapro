"use client";

import { resumirObjeto } from "@/core/objeto";
import { agruparPorPrazo, horaDoPrazo, ROTULO_GRUPO_PRAZO, type GrupoPrazo } from "@/core/pipeline-prazos";
import { cn } from "@/lib/utils";
import { LinkAbrirItem } from "./faixa-prazo";
import { formatarReais } from "./formato";
import { ETAPAS_ATIVAS, ROTULO_ETAPA, type ItemPipeline } from "./tipos";

const COR_GRUPO: Record<GrupoPrazo, string> = {
  hoje: "text-negative",
  amanha: "text-warning",
  semana: "text-muted-foreground",
  depois: "text-muted-foreground",
  encerrada: "text-muted-foreground",
};

/** Dia e mês do fechamento, para os grupos mais distantes, onde só a hora não basta. */
const formatoData = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

function quando(grupo: GrupoPrazo, iso: string): string {
  const hora = horaDoPrazo(iso);
  if (grupo === "hoje" || grupo === "amanha") return hora;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? hora : `${formatoData.format(new Date(t))} ${hora}`;
}

/** Lista única das etapas ativas agrupada por dia; linhas compactas que cabem em 375 px sem rolagem lateral. */
export function ListaPorPrazo({ itens, agora }: { itens: ItemPipeline[]; agora: number }) {
  const ativos = itens.filter((i) => ETAPAS_ATIVAS.includes(i.etapa));
  const grupos = agruparPorPrazo(ativos, agora);
  if (grupos.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-control px-3 py-8 text-center text-[13px] text-muted-foreground">
        Nenhum item ativo com esses filtros.
      </p>
    );
  }
  return (
    <div data-tour="pipeline-por-prazo" className="flex min-w-0 flex-col gap-4 md:pb-2">
      {grupos.map((g) => (
        <section key={g.grupo} aria-label={ROTULO_GRUPO_PRAZO[g.grupo]} className="flex min-w-0 flex-col gap-1">
          <h2 className={cn("px-1 text-xs font-semibold tracking-wide uppercase", COR_GRUPO[g.grupo])}>
            {ROTULO_GRUPO_PRAZO[g.grupo]}
            <span className="ml-1.5 font-normal tabular-nums">{g.itens.length}</span>
          </h2>
          <ul className="flex min-w-0 flex-col divide-y divide-border rounded-card bg-surface">
            {g.itens.map((dado) => (
              <li key={dado.id} className="flex min-w-0 items-center gap-2 px-3 py-2">
                <span
                  className={cn(
                    "w-[4.75rem] shrink-0 text-[13px] font-medium tabular-nums",
                    g.grupo === "hoje" ? "text-negative" : "text-ink",
                  )}
                >
                  {quando(g.grupo, dado.item.dataEncerramento)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-ink">{resumirObjeto(dado.item.objeto)}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {ROTULO_ETAPA[dado.etapa]} · {dado.responsavelNome ?? "Sem responsável"} ·{" "}
                    <span className="tabular-nums">
                      {dado.valorProposto !== null
                        ? `proposta ${formatarReais(dado.valorProposto)}`
                        : dado.item.valorEstimado === null
                          ? "—"
                          : formatarReais(dado.item.valorEstimado)}
                    </span>
                  </span>
                </span>
                <LinkAbrirItem dado={dado} className="shrink-0" />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
