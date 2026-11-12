"use client";

import { memo } from "react";
import type { OportunidadeComScore } from "@/core/types";
import { resumirObjeto } from "@/core/objeto";
import { formatarMoedaCurta } from "@/lib/formato";
import { nomeModalidade } from "@/lib/radar-filtros";
import { cn } from "@/lib/utils";
import { PASTILHA_FAIXA } from "./faixa";
import { AlertaDoScore, Motivos } from "./motivos";
import { usePrazo } from "./prazo";

/** Colunas da lista no desktop: nota | objeto | modalidade | valor | prazo. */
const COLUNAS = "md:grid-cols-[48px_minmax(0,1fr)_88px_128px_112px]";

/** Cabeçalho da lista (só a partir de 768 px): 12 px, sem faixa de fundo, com régua. */
export function CabecalhoLista() {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "hidden grid-cols-1 items-center gap-x-4 border-b border-rule px-2 pb-2 text-xs text-muted-foreground md:grid",
        COLUNAS,
      )}
    >
      <span>Nota</span>
      <span>Objeto</span>
      <span>Modalidade</span>
      <span className="text-right">Valor estimado</span>
      <span className="text-right">Prazo</span>
    </div>
  );
}

interface Props {
  item: OportunidadeComScore;
  indice: number;
  agoraInicial: number;
  /** Por que a oportunidade combina com o perfil (aba "Para você") */
  motivos?: ReadonlyArray<string>;
  onAbrir: (item: OportunidadeComScore) => void;
}

function LinhaOportunidadeBase({ item, indice, agoraInicial, motivos, onAbrir }: Props) {
  const { contagem, curto, encerrada, menosDe24h } = usePrazo(item.dataEncerramento, agoraInicial);
  const valor = item.valorEstimado === null ? "Sigiloso" : formatarMoedaCurta(item.valorEstimado);
  const prazoDesktop = menosDe24h ? contagem : encerrada ? "Encerrada" : `Fecha em ${curto}`;
  const prazoTelefone = encerrada ? "encerrada" : `fecha em ${curto}`;

  return (
    <button
      type="button"
      onClick={() => onAbrir(item)}
      style={{ "--i": indice } as React.CSSProperties}
      className={cn(
        "card-entrada grid w-full cursor-pointer grid-cols-[48px_minmax(0,1fr)] items-center gap-x-3 border-b border-rule px-2 py-3 text-left outline-none transition-colors hover:bg-raised focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset md:min-h-16 md:gap-x-4 md:py-2",
        COLUNAS,
      )}
    >
      <span
        className={cn(
          "flex h-9 w-12 items-center justify-center self-start rounded-control font-mono text-sm font-semibold tabular-nums md:self-center",
          PASTILHA_FAIXA[item.score.faixa],
        )}
      >
        {item.score.total}
      </span>

      <span className="flex min-w-0 flex-col gap-1 md:gap-0.5">
        <span className="line-clamp-2 text-[15px] leading-snug font-medium wrap-break-word text-ink md:line-clamp-1 md:text-sm">
          {resumirObjeto(item.objeto)}
        </span>
        <span className="hidden truncate text-xs text-muted-foreground md:block">
          {item.municipio} · {item.orgao}
        </span>
        <span className="font-mono text-[13px] tabular-nums text-muted-foreground md:hidden">
          <span className="text-ink">{valor}</span> ·{" "}
          <span className={menosDe24h ? "text-negative" : undefined}>{prazoTelefone}</span>
        </span>
        {motivos && motivos.length > 0 ? <Motivos motivos={motivos} className="mt-0.5" /> : null}
        <AlertaDoScore score={item.score} />
      </span>

      <span className="hidden truncate text-sm text-muted-foreground md:block">
        {nomeModalidade(item.modalidadeId)}
      </span>
      <span
        className={cn(
          "hidden text-right font-mono text-sm whitespace-nowrap tabular-nums md:block",
          item.valorEstimado === null ? "text-muted-foreground" : "text-ink",
        )}
      >
        {valor}
      </span>
      <span
        className={cn(
          "hidden text-right font-mono text-sm whitespace-nowrap tabular-nums md:block",
          menosDe24h ? "text-negative" : "text-muted-foreground",
        )}
      >
        {prazoDesktop}
      </span>
    </button>
  );
}

export const LinhaOportunidade = memo(LinhaOportunidadeBase);
