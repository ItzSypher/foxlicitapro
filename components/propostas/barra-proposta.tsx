"use client";

import { ClipboardCheck, Download, Send } from "lucide-react";
import { formatarMoeda } from "@/lib/formato";
import { cn } from "@/lib/utils";

export type EstadoSalvo =
  | { tipo: "parado" }
  | { tipo: "salvando" }
  | { tipo: "ok"; hora: string }
  | { tipo: "erro"; mensagem: string };

interface Props {
  salvo: EstadoSalvo;
  aoTentarDeNovo: () => void;
  total: number;
  /** O total ficou abaixo do preço mínimo da cotação: o valor fica em vermelho */
  abaixoDoMinimo: boolean;
  aoBaixar: () => void;
  /** Sem a função, o botão Enviar não aparece (quem só consulta) */
  aoEnviar?: () => void;
}

const BOTAO =
  "inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-control border px-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-brand lg:flex-none lg:px-4";
const BOTAO_PADRAO = "border-control bg-raised text-ink hover:bg-active";

/**
 * Barra fixa do documento: no celular fica no rodapé, acima da navegação (que já respeita a área segura);
 * no desktop fica presa ao topo da página.
 */
export function BarraProposta({ salvo, aoTentarDeNovo, total, abaixoDoMinimo, aoBaixar, aoEnviar }: Props) {
  return (
    <div
      className={cn(
        "nao-imprimir fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 flex flex-col gap-2 border-t border-border bg-ground px-3 py-2",
        "lg:sticky lg:inset-x-auto lg:top-0 lg:bottom-auto lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:rounded-card lg:border lg:bg-surface lg:px-4",
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-3 lg:justify-start lg:gap-5">
        <div className="flex min-w-0 items-center gap-2">
          <p
            role="status"
            className={cn("truncate text-[13px]", salvo.tipo === "erro" ? "text-negative" : "text-muted-foreground")}
          >
            {salvo.tipo === "parado" && "Sem alterações"}
            {salvo.tipo === "salvando" && "Salvando…"}
            {salvo.tipo === "ok" && `Salvo às ${salvo.hora}`}
            {salvo.tipo === "erro" && salvo.mensagem}
          </p>
          {salvo.tipo === "erro" && (
            <button
              type="button"
              onClick={aoTentarDeNovo}
              className="inline-flex h-11 shrink-0 items-center px-1 text-[13px] font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
            >
              Tentar de novo
            </button>
          )}
        </div>
        <p className="shrink-0 text-[13px] text-muted-foreground">
          Total{" "}
          <span className={cn("text-base font-semibold tabular-nums", abaixoDoMinimo ? "text-negative" : "text-ink")}>
            {formatarMoeda(total)}
          </span>
        </p>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={aoBaixar} className={cn(BOTAO, "border-transparent bg-brand-fill text-black hover:opacity-90")}>
          <Download aria-hidden className="size-4 shrink-0" />
          Baixar PDF
        </button>
        {aoEnviar && (
          <button type="button" onClick={aoEnviar} className={cn(BOTAO, BOTAO_PADRAO)}>
            <Send aria-hidden className="size-4 shrink-0" />
            Enviar
          </button>
        )}
        <a href="#revisao" className={cn(BOTAO, BOTAO_PADRAO)}>
          <ClipboardCheck aria-hidden className="size-4 shrink-0" />
          Revisão
        </a>
      </div>
    </div>
  );
}
