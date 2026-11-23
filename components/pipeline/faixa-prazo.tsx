"use client";

import Link from "next/link";
import { AlertTriangle, Clock, FilePlus2 } from "lucide-react";
import { PontoVivo } from "@/components/radar/selos-vivos";
import { linkInternoDaOportunidade, temChavePncp } from "@/core/link-oportunidade";
import { resumirObjeto } from "@/core/objeto";
import { grupoDoPrazo, horaDoPrazo, pendentesDeProposta } from "@/core/pipeline-prazos";
import { cn } from "@/lib/utils";
import { ROTULO_ETAPA, type ItemPipeline } from "./tipos";

const BOTAO_LINHA =
  "inline-flex h-11 items-center rounded-control px-2.5 text-[13px] font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-brand lg:h-8";

/** Abre o item do mesmo jeito que o "Abrir" do card: página interna da licitação ou link externo. */
export function LinkAbrirItem({ dado, className }: { dado: ItemPipeline; className?: string }) {
  const link = linkInternoDaOportunidade(dado.item);
  if (link === null) return null;
  return (
    <Link
      href={link.href}
      {...(link.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(BOTAO_LINHA, "text-brand underline-offset-4 hover:underline", className)}
    >
      Abrir
    </Link>
  );
}

/** Rota de criação de proposta já existente (a mesma do botão "Criar proposta" da licitação); null sem chave do PNCP. */
export function rotaDaProposta(dado: ItemPipeline): string | null {
  const o = dado.item;
  if (!temChavePncp(o)) return null;
  return `/propostas/nova?compra=${o.orgaoCnpj}-${o.anoCompra}-${o.sequencialCompra}`;
}

function Bloco({
  tom,
  titulo,
  itens,
  podeCriarProposta,
}: {
  tom: "hoje" | "amanha";
  titulo: string;
  itens: ItemPipeline[];
  podeCriarProposta: boolean;
}) {
  const vermelho = tom === "hoje";
  const Icone = vermelho ? AlertTriangle : Clock;
  return (
    <section
      aria-label={titulo}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-card px-3 py-2.5",
        vermelho ? "bg-pill-neg-bg text-pill-neg-fg" : "bg-pill-warn-bg text-pill-warn-fg",
      )}
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <span className="relative inline-flex shrink-0">
          <Icone aria-hidden="true" className="size-4" />
          <span className="absolute -top-0.5 -right-1">
            <PontoVivo className={vermelho ? "bg-negative" : "bg-warning"} />
          </span>
        </span>
        {titulo}
      </h2>
      <ul className="flex max-h-44 flex-col divide-y divide-current/15 overflow-y-auto">
        {itens.map((dado) => {
          const proposta = podeCriarProposta ? rotaDaProposta(dado) : null;
          return (
            <li key={dado.id} className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-1.5">
              <p className="flex min-w-0 flex-1 basis-48 flex-col">
                <span className="line-clamp-1 text-[13px] font-medium text-ink">{resumirObjeto(dado.item.objeto)}</span>
                <span className="text-xs tabular-nums">
                  {horaDoPrazo(dado.item.dataEncerramento)} · {ROTULO_ETAPA[dado.etapa]} ·{" "}
                  {dado.responsavelNome ?? "Sem responsável"}
                </span>
              </p>
              <span className="flex shrink-0 items-center">
                <LinkAbrirItem dado={dado} />
                {proposta === null ? null : (
                  <Link href={proposta} className={cn(BOTAO_LINHA, "bg-brand-fill text-black hover:opacity-90")}>
                    <FilePlus2 aria-hidden="true" className="mr-1 size-3.5" />
                    Fazer proposta
                  </Link>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function frase(n: number, hoje: boolean): string {
  const verbo = n === 1 ? "fecha" : "fecham";
  return hoje ? `${n} ${verbo} hoje sem proposta` : `${n} ${verbo} amanhã`;
}

/**
 * Faixa de alerta no topo do Pipeline: o que fecha hoje sem proposta (vermelho) e o que fecha amanhã (âmbar).
 * Some quando não há pendência. O pulso do ícone só anima se o aparelho não pediu menos movimento.
 */
export function FaixaPrazo({
  itens,
  agora,
  podeCriarProposta,
}: {
  itens: ItemPipeline[];
  agora: number;
  podeCriarProposta: boolean;
}) {
  const pendentes = pendentesDeProposta(itens, agora);
  if (pendentes.length === 0) return null;
  const hoje = pendentes.filter((i) => grupoDoPrazo(i.item.dataEncerramento, agora) === "hoje");
  const amanha = pendentes.filter((i) => grupoDoPrazo(i.item.dataEncerramento, agora) === "amanha");
  return (
    <div
      data-tour="pipeline-alerta-prazo"
      role="region"
      aria-label="Prazos sem proposta"
      className="grid shrink-0 gap-2 md:grid-cols-2"
    >
      {hoje.length > 0 ? (
        <Bloco tom="hoje" titulo={frase(hoje.length, true)} itens={hoje} podeCriarProposta={podeCriarProposta} />
      ) : null}
      {amanha.length > 0 ? (
        <Bloco tom="amanha" titulo={frase(amanha.length, false)} itens={amanha} podeCriarProposta={podeCriarProposta} />
      ) : null}
    </div>
  );
}
