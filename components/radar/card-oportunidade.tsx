"use client";

import { memo } from "react";
import Link from "next/link";
import { FileCheck } from "lucide-react";
import type { OportunidadeComScore } from "@/core/types";
import { resumirObjeto } from "@/core/objeto";
import { formatarMoedaCurta } from "@/lib/formato";
import { nomeFaixa, nomeModalidade } from "@/lib/radar-filtros";
import { cn } from "@/lib/utils";
import { TEXTO_FAIXA } from "./faixa";
import { DicaNota } from "./dicas";
import { AlertaDoScore, Motivos } from "./motivos";
import { PrazoDoCard } from "./prazo";
import { SeloFonte } from "./selo-fonte";
import { SelosVivos } from "./selos-vivos";

interface Props {
  item: OportunidadeComScore;
  indice: number;
  agoraInicial: number;
  /** Por que a oportunidade combina com o perfil (aba "Para você") */
  motivos?: ReadonlyArray<string>;
  /** Id do rascunho que o assistente montou para esta oportunidade; mostra o selo "Proposta pronta" */
  propostaProntaId?: string;
  onAbrir: (item: OportunidadeComScore) => void;
}

function CardOportunidadeBase({ item, indice, agoraInicial, motivos, propostaProntaId, onAbrir }: Props) {
  const cor = TEXTO_FAIXA[item.score.faixa];
  return (
    <div
      style={{ "--i": indice } as React.CSSProperties}
      className="card-entrada relative isolate flex h-full w-full flex-col gap-3 rounded-card bg-surface p-4 text-left transition-[background-color,scale] duration-150 hover:bg-raised active:scale-[.99]"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1">
          <span className="flex shrink-0 flex-col">
            <span className={cn("text-[28px] leading-none font-semibold tabular-nums", cor)}>
              {item.score.total}
            </span>
            <span className={cn("mt-1 text-xs font-medium", cor)}>{nomeFaixa(item.score.faixa)}</span>
          </span>
          <DicaNota score={item.score} />
        </span>
        <span className="flex min-w-0 flex-col items-end gap-1.5">
          {item.valorEstimado === null ? (
            <span className="text-xl leading-tight font-medium text-muted-foreground">Sigiloso</span>
          ) : (
            <span className="text-xl leading-tight font-medium whitespace-nowrap tabular-nums text-ink">
              {formatarMoedaCurta(item.valorEstimado)}
            </span>
          )}
          <PrazoDoCard encerramentoIso={item.dataEncerramento} agoraInicial={agoraInicial} />
        </span>
      </span>

      <SelosVivos
        dataPublicacao={item.dataPublicacao}
        dataEncerramento={item.dataEncerramento}
        agoraInicial={agoraInicial}
      />

      <button
        type="button"
        onClick={() => onAbrir(item)}
        className="block cursor-pointer rounded-control text-left text-[15px] leading-snug font-medium wrap-break-word text-ink outline-none after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-brand"
      >
        <span className="line-clamp-3">{resumirObjeto(item.objeto)}</span>
      </button>

      <span className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
        <span className="min-w-0 truncate">
          {item.municipio}/{item.uf} · {nomeModalidade(item.modalidadeId)}
        </span>
        <SeloFonte linkOrigem={item.linkOrigem} linkAlerta={item.linkAlerta} className="shrink-0" />
      </span>

      {propostaProntaId ? (
        <Link
          href={`/propostas/${propostaProntaId}`}
          prefetch={false}
          className="relative z-10 inline-flex min-h-11 w-fit max-w-full items-center gap-1.5 rounded-full selo-brilho border border-border bg-raised px-3 text-xs font-medium text-brand outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
        >
          <FileCheck aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">Proposta pronta</span>
        </Link>
      ) : null}

      {motivos && motivos.length > 0 ? <Motivos motivos={motivos.slice(0, 1)} className="mt-auto" /> : null}
      <AlertaDoScore score={item.score} className={motivos && motivos.length > 0 ? undefined : "mt-auto"} />
    </div>
  );
}

export const CardOportunidade = memo(CardOportunidadeBase);
