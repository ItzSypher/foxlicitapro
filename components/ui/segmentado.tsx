"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useFaixaRolavel } from "./usar-faixa-rolavel";

export interface OpcaoSegmentada<T extends string> {
  valor: T;
  rotulo: string;
  /** Número ao lado do rótulo, em algarismos tabulares. */
  contagem?: number;
  /** Ícone antes do rótulo (decorativo). */
  icone?: ReactNode;
  /** Nome para leitor de tela quando o rótulo visível não basta. */
  rotuloAcessivel?: string;
  /** Com `href` a opção é um link (filtro na URL, resolvido no servidor). */
  href?: string;
}

interface Props<T extends string> {
  /** Nome do grupo para leitor de tela (não aparece na tela). */
  rotulo: string;
  valor: T;
  opcoes: ReadonlyArray<OpcaoSegmentada<T>>;
  /** Obrigatório quando as opções são botões. Opções com `href` navegam sozinhas. */
  aoMudar?: (valor: T) => void;
  /** Ocupa a largura do contêiner e rola na horizontal se não couber, com as bordas esmaecendo. */
  rolavel?: boolean;
  /** Estica o grupo e reparte a largura igual entre as opções (folhas e telas estreitas). */
  larguraTotal?: boolean;
  className?: string;
}

/** Item e trilho compartilhados: o mesmo degrau de tom em Radar, Pipeline, Resultados e Encerradas. */
export const TRILHO_SEGMENTADO = "inline-flex max-w-full items-center gap-0.5 rounded-control bg-raised p-0.5 ring-1 ring-inset ring-border";

export function classeItemSegmentado(ativo: boolean, cheio = false): string {
  return cn(
    cheio && "flex-1",
    "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-[5px] px-3 text-sm whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand lg:h-8",
    ativo ? "bg-brand-fill font-medium text-black" : "text-muted-foreground hover:bg-active hover:text-ink",
  );
}

/**
 * Filtro segmentado: um grupo em degrau de tom, só o item ativo preenchido (laranja da marca).
 * Altura de 44px no toque e 36px no computador. Sem contorno em cada item.
 */
export function Segmentado<T extends string>({ rotulo, valor, opcoes, aoMudar, rolavel = false, larguraTotal = false, className }: Props<T>) {
  const faixa = useFaixaRolavel<HTMLDivElement>();
  const navegacao = opcoes.some((o) => o.href !== undefined);

  const itens = opcoes.map((o) => {
    const ativo = o.valor === valor;
    const conteudo = (
      <>
        {o.icone}
        {o.rotulo}
        {o.contagem === undefined ? null : (
          <span className={cn("text-xs tabular-nums", ativo ? "text-black/70" : "text-faint")}>{o.contagem}</span>
        )}
      </>
    );
    if (o.href !== undefined) {
      return (
        <Link
          key={o.valor}
          href={o.href}
          aria-current={ativo ? "true" : undefined}
          aria-label={o.rotuloAcessivel}
          className={classeItemSegmentado(ativo, larguraTotal)}
        >
          {conteudo}
        </Link>
      );
    }
    return (
      <button
        key={o.valor}
        type="button"
        aria-pressed={ativo}
        aria-label={o.rotuloAcessivel}
        onClick={() => aoMudar?.(o.valor)}
        className={classeItemSegmentado(ativo, larguraTotal)}
      >
        {conteudo}
      </button>
    );
  });

  const classes = cn(TRILHO_SEGMENTADO, larguraTotal && "flex w-full", rolavel && "sem-barra min-w-0 overflow-x-auto", className);

  if (navegacao) {
    return (
      <nav aria-label={rotulo} ref={rolavel ? faixa : undefined} className={classes}>
        {itens}
      </nav>
    );
  }
  return (
    <div role="group" aria-label={rotulo} ref={rolavel ? faixa : undefined} className={classes}>
      {itens}
    </div>
  );
}
