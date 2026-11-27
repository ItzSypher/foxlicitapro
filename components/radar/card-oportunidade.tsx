"use client";

import { memo } from "react";
import Link from "next/link";
import { FileCheck } from "lucide-react";
import { useFaixaRolavel } from "@/components/ui/usar-faixa-rolavel";
import type { OportunidadeComScore } from "@/core/types";
import { resumirObjeto } from "@/core/objeto";
import { formatarMoedaCurta } from "@/lib/formato";
import { nomeFaixa, nomeModalidade } from "@/lib/radar-filtros";
import { cn } from "@/lib/utils";
import { TEXTO_FAIXA } from "./faixa";
import { DicaNota } from "./dicas";
import { AlertaDoScore, Motivos } from "./motivos";
import { Pilula } from "./pilula";
import { PrazoDoCard, usePrazo } from "./prazo";
import { SeloFonte } from "./selo-fonte";
import { SelosCaixa } from "./selos-caixa";
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

const BADGE = "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap";

/** Prazo como badge, para a linha do celular: "Fecha em 3 d", "Encerrada" ou o relógio em vermelho nas últimas 24 h. */
function PrazoBadge({ encerramentoIso, agoraInicial }: { encerramentoIso: string; agoraInicial: number }) {
  const { contagem, curto, encerrada, menosDe24h } = usePrazo(encerramentoIso, agoraInicial);
  if (menosDe24h) {
    return (
      <Pilula tom="negativo" className="h-6 shrink-0 tabular-nums">
        {contagem}
      </Pilula>
    );
  }
  return (
    <Pilula tom="neutro" className="h-6 shrink-0 tabular-nums">
      {encerrada ? "Encerrada" : `Fecha em ${curto}`}
    </Pilula>
  );
}

function CardOportunidadeBase({ item, indice, agoraInicial, motivos, propostaProntaId, onAbrir }: Props) {
  const cor = TEXTO_FAIXA[item.score.faixa];
  const faixaBadges = useFaixaRolavel<HTMLDivElement>();
  const objeto = resumirObjeto(item.objeto);
  const primeiroMotivo = motivos !== undefined && motivos.length > 0 ? motivos.slice(0, 1) : null;
  return (
    <div
      data-tour="radar-card"
      style={{ "--i": indice } as React.CSSProperties}
      className="card-entrada relative isolate flex h-full w-full flex-col gap-2 rounded-card bg-surface p-3 text-left transition-[background-color,scale] duration-150 hover:bg-raised active:scale-[.99] md:gap-3 md:p-4"
    >
      {/* Celular: tudo numa linha de badges que rola de lado, objeto em 2 linhas e o resto no detalhe. */}
      <div className="contents md:hidden">
        {/* O toque na linha também abre o detalhe (o botão do objeto cobre o resto do card). */}
        <div
          ref={faixaBadges}
          onClick={() => onAbrir(item)}
          className="sem-barra relative z-10 -mx-3 -my-2 flex items-center gap-1.5 overflow-x-auto px-3 py-2"
        >
          <span className={cn(BADGE, "bg-raised tabular-nums", cor)}>
            <span className="font-semibold">{item.score.total}</span>
            {nomeFaixa(item.score.faixa)}
          </span>
          <span
            className={cn(
              BADGE,
              "border border-border tabular-nums",
              item.valorEstimado === null ? "text-muted-foreground" : "text-ink",
            )}
          >
            {item.valorEstimado === null ? "Sigiloso" : formatarMoedaCurta(item.valorEstimado)}
          </span>
          <PrazoBadge encerramentoIso={item.dataEncerramento} agoraInicial={agoraInicial} />
          <SelosVivos
            dataPublicacao={item.dataPublicacao}
            dataEncerramento={item.dataEncerramento}
            agoraInicial={agoraInicial}
            className="shrink-0 flex-nowrap"
          />
          {item.score.foco !== undefined ? (
            <Pilula tom="positivo" className="h-6 shrink-0">
              Seu foco
            </Pilula>
          ) : null}
          <SelosCaixa oportunidade={item} compacto className="shrink-0" />
          {propostaProntaId ? (
            <Link
              href={`/propostas/${propostaProntaId}`}
              prefetch={false}
              className={cn(
                BADGE,
                "selo-brilho relative border border-border bg-raised text-brand outline-none after:absolute after:-inset-y-2 after:inset-x-0 after:content-[''] hover:underline focus-visible:ring-2 focus-visible:ring-brand",
              )}
            >
              <FileCheck aria-hidden="true" className="size-3.5 shrink-0" />
              Proposta pronta
            </Link>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onAbrir(item)}
          className="block cursor-pointer rounded-control text-left text-[15px] leading-snug font-medium wrap-break-word text-ink outline-none after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-brand"
        >
          <span className="line-clamp-2">{objeto}</span>
        </button>

        <span className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
          <span className="min-w-0 truncate">
            {item.municipio}/{item.uf} · {nomeModalidade(item.modalidadeId)}
          </span>
          <SeloFonte linkOrigem={item.linkOrigem} linkAlerta={item.linkAlerta} className="shrink-0" />
        </span>

        {primeiroMotivo ? <Motivos motivos={primeiroMotivo} /> : null}
        <AlertaDoScore score={item.score} />
      </div>

      {/* A partir de 768 px: o card completo de sempre. */}
      <div className="hidden md:contents">
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

        <span className="flex flex-wrap items-center gap-1.5">
          {item.score.foco !== undefined ? <Pilula tom="positivo">Seu foco</Pilula> : null}
          <SelosCaixa oportunidade={item} />
        </span>

        <button
          type="button"
          onClick={() => onAbrir(item)}
          className="block cursor-pointer rounded-control text-left text-[15px] leading-snug font-medium wrap-break-word text-ink outline-none after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-brand"
        >
          <span className="line-clamp-3">{objeto}</span>
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

        {primeiroMotivo ? <Motivos motivos={primeiroMotivo} className="mt-auto" /> : null}
        <AlertaDoScore score={item.score} className={primeiroMotivo ? undefined : "mt-auto"} />
      </div>
    </div>
  );
}

export const CardOportunidade = memo(CardOportunidadeBase);
