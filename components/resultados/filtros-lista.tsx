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
import { Segmentado } from "@/components/ui/segmentado";
import { Seletor, type OpcaoSeletor } from "@/components/ui/seletor";
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

const OPCOES_REGIAO: ReadonlyArray<OpcaoSeletor> = [
  { valor: "todas", rotulo: "Todas" },
  ...REGIOES_PIPELINE.map((r) => ({ valor: r, rotulo: ROTULO_REGIAO[r] })),
];

const OPCOES_FRENTE: ReadonlyArray<OpcaoSeletor> = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "servicos", rotulo: ROTULO_FRENTE.servicos },
  { valor: "produtos", rotulo: ROTULO_FRENTE.produtos },
];

const OPCOES_ORDEM: ReadonlyArray<OpcaoSeletor> = ORDENS.map((o) => ({ valor: o.id, rotulo: o.rotulo }));

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
      <Segmentado
        rotulo="Situação"
        valor={filtros.etapa}
        aoMudar={(etapa) => mudar({ etapa })}
        opcoes={ETAPAS.map((e) => ({ valor: e.id, rotulo: e.rotulo }))}
        rolavel
      />

      <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-5">
        <Seletor
          rotulo="Região"
          valor={filtros.regiao}
          opcoes={OPCOES_REGIAO}
          aoMudar={(v) => mudar({ regiao: REGIOES_PIPELINE.find((r) => r === v) ?? "todas" })}
        />
        <Seletor
          rotulo="Frente"
          valor={filtros.frente}
          opcoes={OPCOES_FRENTE}
          aoMudar={(v) => mudar({ frente: v === "servicos" || v === "produtos" ? v : "todas" })}
        />
        <Seletor
          rotulo="Responsável"
          valor={filtros.responsavel}
          opcoes={[
            { valor: "todos", rotulo: "Todos" },
            { valor: "sem", rotulo: "Sem responsável" },
            ...pessoas.map((p) => ({ valor: p.id, rotulo: p.nome })),
          ]}
          aoMudar={(v) => mudar({ responsavel: v })}
        />
        <Seletor
          rotulo="Ordenar por"
          valor={filtros.ordem}
          opcoes={OPCOES_ORDEM}
          aoMudar={(v) => mudar({ ordem: v === "valor" || v === "lucro" ? v : "data" })}
        />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-muted-foreground">Sentido</span>
          <button
            type="button"
            onClick={() => mudar({ direcao: (filtros.direcao === "desc" ? "asc" : "desc") satisfies DirecaoResultados })}
            className="inline-flex h-11 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-control bg-raised px-3 text-left text-sm text-ink ring-1 ring-inset ring-border outline-none transition-colors hover:bg-active focus-visible:ring-2 focus-visible:ring-brand lg:h-9"
          >
            <span className="truncate">{filtros.direcao === "desc" ? "Maior ou mais recente primeiro" : "Menor ou mais antigo primeiro"}</span>
            {filtros.direcao === "desc" ? (
              <ArrowDown aria-hidden="true" className="size-4 shrink-0 text-faint" />
            ) : (
              <ArrowUp aria-hidden="true" className="size-4 shrink-0 text-faint" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
