"use client";

import { useState, useTransition } from "react";
import { Check, Plus } from "lucide-react";
import { salvarNoPipeline, tirarDoPipeline } from "@/app/(app)/pipeline/actions";
import type { OportunidadeComScore } from "@/core/types";
import { cn } from "@/lib/utils";

/**
 * Alternador "Pipeline": desligado é contorno com "+", ligado é preenchido com check ("No pipeline").
 * Atualiza na hora e desfaz se o servidor recusar.
 */
export function BotaoSalvarPipeline({
  item,
  salvo,
  travado = null,
  className,
}: {
  item: OportunidadeComScore;
  salvo: boolean;
  /** Motivo pelo qual o item não pode sair do pipeline (em disputa, ganho, com proposta, sem permissão); liga e trava o botão. */
  travado?: string | null;
  className?: string;
}) {
  const chave = `${item.id}:${salvo}`;
  const [chaveAnterior, setChaveAnterior] = useState(chave);
  const [marcado, setMarcado] = useState(salvo);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  // Quando o servidor informa outro estado (ou outro item), o estado local acompanha.
  if (chave !== chaveAnterior) {
    setChaveAnterior(chave);
    setMarcado(salvo);
    setErro(null);
  }

  const bloqueado = marcado && travado !== null;

  function alternar() {
    if (bloqueado) return;
    const anterior = marcado;
    setErro(null);
    setMarcado(!anterior);
    iniciar(async () => {
      const r = anterior ? await tirarDoPipeline(item.id) : await salvarNoPipeline(item);
      if (!r.ok) {
        setMarcado(anterior);
        setErro(r.erro);
      }
    });
  }

  const Icone = marcado ? Check : Plus;
  return (
    <div className="contents">
      <button
        type="button"
        onClick={alternar}
        aria-pressed={marcado}
        aria-busy={pendente}
        disabled={bloqueado || pendente}
        title={bloqueado ? (travado ?? undefined) : marcado ? "Tirar do pipeline" : "Salvar no pipeline"}
        className={cn(
          "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-control border px-3.5 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand md:h-9",
          marcado
            ? "border-transparent bg-brand-fill text-black hover:opacity-90"
            : "border-control bg-transparent text-ink hover:bg-active",
          bloqueado && "cursor-not-allowed opacity-70",
          pendente && !bloqueado && "cursor-progress",
          className,
        )}
      >
        <Icone aria-hidden="true" className="size-4 shrink-0" />
        {marcado ? "No pipeline" : "Pipeline"}
        {bloqueado ? <span className="sr-only">. {travado}</span> : null}
      </button>
      {erro ? (
        <p role="alert" className="order-last basis-full text-sm text-negative">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
