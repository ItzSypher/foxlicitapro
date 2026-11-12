"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TEXTO_FAIXA } from "@/components/radar/faixa";
import { usePrazo } from "@/components/radar/prazo";
import { Termometro } from "@/components/radar/termometro";
import type { Score } from "@/core/types";
import { formatarEncerramento, formatarMoeda } from "@/lib/formato";
import { nomeFaixa } from "@/lib/radar-filtros";
import { cn } from "@/lib/utils";

interface Props {
  titulo: string;
  identificacao: string;
  score: Score | null;
  valorEstimado: number | null;
  dataEncerramento: string | null;
  agoraInicial: number;
}

function Prazo({ encerramentoIso, agoraInicial }: { encerramentoIso: string; agoraInicial: number }) {
  const { contagem, encerrada, menosDe24h } = usePrazo(encerramentoIso, agoraInicial);
  return (
    <>
      <p
        className={cn(
          "font-mono text-xl leading-tight font-medium tabular-nums",
          encerrada ? "text-muted-foreground" : menosDe24h ? "text-negative" : "text-ink",
        )}
      >
        {contagem}
      </p>
      <p className="text-[13px] leading-snug text-muted-foreground">{formatarEncerramento(encerramentoIso)}</p>
    </>
  );
}

const ROTULO = "text-xs font-medium text-muted-foreground";

export function CabecalhoLicitacao({
  titulo,
  identificacao,
  score,
  valorEstimado,
  dataEncerramento,
  agoraInicial,
}: Props) {
  return (
    <header className="flex flex-col gap-3">
      <Link
        href="/radar"
        className="-ml-2 inline-flex h-11 w-fit items-center gap-1.5 rounded-control px-2 text-sm text-muted-foreground outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Radar
      </Link>

      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl leading-snug font-semibold wrap-break-word text-ink sm:text-[22px]">{titulo}</h1>
        <p className="text-[13px] leading-snug wrap-break-word text-muted-foreground">{identificacao}</p>
      </div>

      <div className="grid gap-4 rounded-card border border-border bg-surface p-4 md:grid-cols-3 md:gap-0 md:p-0">
        <div className="flex min-w-0 flex-col gap-2 md:p-4">
          <p className={ROTULO}>Nota</p>
          {score ? (
            <>
              <p className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "font-mono text-[32px] leading-none font-semibold tabular-nums",
                    TEXTO_FAIXA[score.faixa],
                  )}
                >
                  {score.total}
                </span>
                <span className={cn("text-sm font-medium", TEXTO_FAIXA[score.faixa])}>{nomeFaixa(score.faixa)}</span>
              </p>
              <Termometro score={score} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sem nota: faltam dados de modalidade ou prazo.</p>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2 border-t border-border pt-4 md:border-t-0 md:border-l md:p-4">
          <p className={ROTULO}>Valor estimado</p>
          {valorEstimado === null ? (
            <p className="text-[26px] leading-tight font-medium text-muted-foreground">Sigiloso</p>
          ) : (
            <p className="font-mono text-[26px] leading-tight font-medium tabular-nums wrap-break-word text-ink">
              {formatarMoeda(valorEstimado)}
            </p>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2 border-t border-border pt-4 md:border-t-0 md:border-l md:p-4">
          <p className={ROTULO}>Prazo para propostas</p>
          {dataEncerramento === null ? (
            <p className="text-sm text-muted-foreground">Prazo não informado.</p>
          ) : (
            <Prazo encerramentoIso={dataEncerramento} agoraInicial={agoraInicial} />
          )}
        </div>
      </div>
    </header>
  );
}
