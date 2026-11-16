"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { REGIOES_PIPELINE, ROTULO_REGIAO } from "@/components/pipeline/tipos";
import {
  ROTULO_FRENTE,
  consultaResultados,
  type DirecaoResultados,
  type FiltroEtapa,
  type FiltrosResultados,
  type OrdemResultados,
  type PeriodoResultados,
} from "@/core/resultados";
import { cn } from "@/lib/utils";

const ETAPAS: ReadonlyArray<{ id: FiltroEtapa; rotulo: string }> = [
  { id: "todas", rotulo: "Todas" },
  { id: "ganha", rotulo: "Ganhas" },
  { id: "perdida", rotulo: "Perdidas" },
  { id: "disputa", rotulo: "Em disputa" },
];

const ORDENS: ReadonlyArray<{ id: OrdemResultados; rotulo: string }> = [
  { id: "data", rotulo: "Data" },
  { id: "valor", rotulo: "Valor" },
  { id: "lucro", rotulo: "Lucro" },
];

const SELECT =
  "h-11 w-full min-w-0 cursor-pointer rounded-control border border-control bg-surface px-3 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand lg:h-10 lg:text-sm";

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      {children}
    </label>
  );
}

/** Filtros e ordenação da lista. Cada mudança vira parâmetro da URL, então o link, o CSV e o PDF levam os mesmos filtros. */
export function FiltrosLista({
  periodo,
  filtros,
  pessoas,
}: {
  periodo: PeriodoResultados;
  filtros: FiltrosResultados;
  pessoas: ReadonlyArray<{ id: string; nome: string }>;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  function mudar(parcial: Partial<FiltrosResultados>) {
    const novos: FiltrosResultados = { ...filtros, ...parcial };
    iniciar(() => {
      router.replace(`/resultados${consultaResultados(periodo, novos)}`, { scroll: false });
    });
  }

  return (
    <div aria-busy={pendente} className={cn("flex min-w-0 flex-col gap-3", pendente ? "opacity-70" : "")}>
      <div role="group" aria-label="Situação" className="sem-barra flex min-w-0 items-center gap-2 overflow-x-auto">
        {ETAPAS.map((e) => {
          const ativa = filtros.etapa === e.id;
          return (
            <button
              key={e.id}
              type="button"
              aria-pressed={ativa}
              onClick={() => mudar({ etapa: e.id })}
              className={cn(
                "inline-flex h-11 shrink-0 items-center rounded-control border px-4 text-sm whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-brand lg:h-9",
                ativa ? "border-control bg-active font-medium text-ink" : "border-border bg-surface text-muted-foreground hover:bg-raised hover:text-ink",
              )}
            >
              {e.rotulo}
            </button>
          );
        })}
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-5">
        <Campo rotulo="Região">
          <select
            value={filtros.regiao}
            onChange={(e) => {
              const v = e.target.value;
              mudar({ regiao: REGIOES_PIPELINE.find((r) => r === v) ?? "todas" });
            }}
            className={SELECT}
          >
            <option value="todas">Todas</option>
            {REGIOES_PIPELINE.map((r) => (
              <option key={r} value={r}>
                {ROTULO_REGIAO[r]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Frente">
          <select
            value={filtros.frente}
            onChange={(e) => {
              const v = e.target.value;
              mudar({ frente: v === "servicos" || v === "produtos" ? v : "todas" });
            }}
            className={SELECT}
          >
            <option value="todas">Todas</option>
            <option value="servicos">{ROTULO_FRENTE.servicos}</option>
            <option value="produtos">{ROTULO_FRENTE.produtos}</option>
          </select>
        </Campo>
        <Campo rotulo="Responsável">
          <select value={filtros.responsavel} onChange={(e) => mudar({ responsavel: e.target.value })} className={SELECT}>
            <option value="todos">Todos</option>
            <option value="sem">Sem responsável</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Ordenar por">
          <select
            value={filtros.ordem}
            onChange={(e) => {
              const v = e.target.value;
              mudar({ ordem: v === "valor" || v === "lucro" ? v : "data" });
            }}
            className={SELECT}
          >
            {ORDENS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Sentido">
          <button
            type="button"
            onClick={() => mudar({ direcao: (filtros.direcao === "desc" ? "asc" : "desc") satisfies DirecaoResultados })}
            className={cn(SELECT, "inline-flex items-center justify-between gap-2 text-left")}
          >
            <span className="truncate">{filtros.direcao === "desc" ? "Maior ou mais recente primeiro" : "Menor ou mais antigo primeiro"}</span>
            {filtros.direcao === "desc" ? (
              <ArrowDown aria-hidden="true" className="size-4 shrink-0" />
            ) : (
              <ArrowUp aria-hidden="true" className="size-4 shrink-0" />
            )}
          </button>
        </Campo>
      </div>
    </div>
  );
}
