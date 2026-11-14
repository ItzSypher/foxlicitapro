"use client";

import { cn } from "@/lib/utils";
import { CardItem } from "./card-item";
import { formatarReais } from "./formato";
import type { EtapaId, ItemPipeline, PessoaPipeline, ResumoEtapa } from "./tipos";

interface Props {
  etapa: EtapaId;
  rotulo: string;
  itens: ItemPipeline[];
  resumo: ResumoEtapa;
  /** No celular a coluna da aba ativa fica inteira; as outras ficam fora da vista (deslizar troca de etapa). */
  ativaNoTelefone: boolean;
  /** Colunas lado a lado (md e acima) */
  colunas: boolean;
  agoraInicial: number;
  pessoas: PessoaPipeline[];
  aoResponsavel: (id: string, responsavelId: string | null) => void;
  podeEditar: boolean;
  podeRevisar: boolean;
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
  colunas,
  agoraInicial,
  pessoas,
  aoResponsavel,
  podeEditar,
  podeRevisar,
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
      inert={!colunas && !ativaNoTelefone}
      className={cn(
        "flex w-full shrink-0 snap-center snap-always flex-col md:h-full md:w-[288px] md:snap-align-none md:rounded-card md:border md:bg-ground",
        !colunas && !ativaNoTelefone ? "max-h-[60dvh] overflow-hidden" : "",
        alvo ? "md:border-brand" : "md:border-border",
      )}
    >
      <header className="flex items-baseline justify-between gap-2 px-1 pt-1 pb-2 md:px-3 md:pt-3 md:pb-1">
        <h2 className="flex items-baseline gap-2 text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
          {rotulo}
          <span className="font-mono tracking-normal tabular-nums text-faint">{resumo.quantidade}</span>
        </h2>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {resumo.valor > 0 ? formatarReais(resumo.valor) : "—"}
        </span>
      </header>

      <ul className="flex flex-col gap-2 md:min-h-0 md:flex-1 md:overflow-y-auto md:p-2">
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
              pessoas={pessoas}
              aoResponsavel={aoResponsavel}
              podeEditar={podeEditar}
              podeRevisar={podeRevisar}
              arrastavel={colunas && podeEditar}
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
