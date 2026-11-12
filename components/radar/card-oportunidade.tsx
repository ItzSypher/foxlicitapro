"use client";

import { memo } from "react";
import type { OportunidadeComScore } from "@/core/types";
import { resumirObjeto } from "@/core/objeto";
import { formatarMoedaCurta } from "@/lib/formato";
import { nomeFaixa, nomeModalidade } from "@/lib/radar-filtros";
import { cn } from "@/lib/utils";
import { TEXTO_FAIXA } from "./faixa";
import { AlertaDoScore, Motivos } from "./motivos";
import { PrazoDoCard } from "./prazo";
import { Termometro } from "./termometro";

interface Props {
  item: OportunidadeComScore;
  indice: number;
  agoraInicial: number;
  /** Por que a oportunidade combina com o perfil (aba "Para você") */
  motivos?: ReadonlyArray<string>;
  onAbrir: (item: OportunidadeComScore) => void;
}

function CardOportunidadeBase({ item, indice, agoraInicial, motivos, onAbrir }: Props) {
  const cor = TEXTO_FAIXA[item.score.faixa];
  return (
    <button
      type="button"
      onClick={() => onAbrir(item)}
      style={{ "--i": indice } as React.CSSProperties}
      className="card-entrada flex h-full w-full cursor-pointer flex-col gap-3 rounded-card border border-border bg-surface p-4 text-left outline-none transition-[border-color,scale] duration-150 hover:border-control focus-visible:ring-2 focus-visible:ring-brand active:scale-[.99]"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="flex shrink-0 flex-col">
          <span className={cn("font-mono text-[28px] leading-none font-semibold tabular-nums", cor)}>
            {item.score.total}
          </span>
          <span className={cn("mt-1 text-xs font-medium", cor)}>{nomeFaixa(item.score.faixa)}</span>
        </span>
        <span className="flex min-w-0 flex-col items-end gap-1.5">
          {item.valorEstimado === null ? (
            <span className="text-xl leading-tight font-medium text-muted-foreground">Sigiloso</span>
          ) : (
            <span className="font-mono text-xl leading-tight font-medium whitespace-nowrap tabular-nums text-ink">
              {formatarMoedaCurta(item.valorEstimado)}
            </span>
          )}
          <PrazoDoCard encerramentoIso={item.dataEncerramento} agoraInicial={agoraInicial} />
        </span>
      </span>

      <span className="line-clamp-3 text-[15px] leading-snug font-medium wrap-break-word text-ink">
        {resumirObjeto(item.objeto)}
      </span>

      <span className="truncate text-[13px] text-muted-foreground">
        {item.municipio} · {nomeModalidade(item.modalidadeId)} · {item.orgao}
      </span>

      {motivos && motivos.length > 0 ? <Motivos motivos={motivos} /> : null}
      <AlertaDoScore score={item.score} />

      <Termometro score={item.score} className="mt-auto" />
    </button>
  );
}

export const CardOportunidade = memo(CardOportunidadeBase);
