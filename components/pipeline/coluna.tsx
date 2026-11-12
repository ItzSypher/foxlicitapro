"use client";

import { cn } from "@/lib/utils";
import { CardItem } from "./card-item";
import { formatarReais } from "./formato";
import type { EtapaId, ItemPipeline, ResumoEtapa } from "./tipos";

interface Props {
  etapa: EtapaId;
  rotulo: string;
  itens: ItemPipeline[];
  resumo: ResumoEtapa;
  /** No telefone só a coluna da aba ativa aparece; no desktop todas. */
  ativaNoTelefone: boolean;
  agoraInicial: number;
  desktop: boolean;
  arrastandoId: string | null;
  alvo: boolean;
  aoEntrarNoAlvo: (etapa: EtapaId) => void;
  aoSairDoAlvo: () => void;
  aoSoltar: (id: string | null, etapa: EtapaId) => void;
  aoIniciarArraste: (id: string) => void;
  aoTerminarArraste: () => void;
  aoMover: (id: string, etapa: EtapaId) => void;
  aoRemover: (id: string) => void;
}

export function Coluna({
  etapa,
  rotulo,
  itens,
  resumo,
  ativaNoTelefone,
  agoraInicial,
  desktop,
  arrastandoId,
  alvo,
  aoEntrarNoAlvo,
  aoSairDoAlvo,
  aoSoltar,
  aoIniciarArraste,
  aoTerminarArraste,
  aoMover,
  aoRemover,
}: Props) {
  return (
    <section
      id={`coluna-${etapa}`}
      aria-label={rotulo}
      onDragOver={(e) => {
        if (arrastandoId === null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!alvo) aoEntrarNoAlvo(etapa);
      }}
      onDragLeave={(e) => {
        const para = e.relatedTarget;
        if (para instanceof Node && e.currentTarget.contains(para)) return;
        aoSairDoAlvo();
      }}
      onDrop={(e) => {
        e.preventDefault();
        aoSoltar(e.dataTransfer.getData("text/plain") || arrastandoId, etapa);
      }}
      className={cn(
        "min-w-0 flex-col rounded-card border bg-ground lg:flex lg:h-full lg:w-[280px] lg:shrink-0",
        ativaNoTelefone ? "flex" : "hidden",
        alvo ? "border-brand" : "border-border",
      )}
    >
      <header className="flex items-baseline justify-between gap-2 px-3 pt-3 pb-1">
        <h2 className="flex items-baseline gap-2 text-sm font-medium text-ink">
          {rotulo}
          <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">
            {resumo.quantidade}
          </span>
        </h2>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {resumo.valor > 0 ? formatarReais(resumo.valor) : "—"}
        </span>
      </header>

      <ul className="flex flex-col gap-2 p-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {itens.length === 0 ? (
          <li className="rounded-card border border-dashed border-control px-3 py-8 text-center text-[13px] text-muted-foreground">
            Nada aqui ainda.
          </li>
        ) : (
          itens.map((dado) => (
            <CardItem
              key={dado.id}
              dado={dado}
              agoraInicial={agoraInicial}
              arrastavel={desktop}
              arrastando={arrastandoId === dado.id}
              aoIniciarArraste={aoIniciarArraste}
              aoTerminarArraste={aoTerminarArraste}
              aoMover={aoMover}
              aoRemover={aoRemover}
            />
          ))
        )}
      </ul>
    </section>
  );
}
