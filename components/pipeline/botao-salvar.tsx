"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BookmarkCheck, BookmarkPlus } from "lucide-react";
import { salvarNoPipeline } from "@/app/(app)/pipeline/actions";
import type { OportunidadeComScore } from "@/core/types";

export function BotaoSalvarPipeline({
  item,
  salvo,
}: {
  item: OportunidadeComScore;
  salvo: boolean;
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

  function salvar() {
    setErro(null);
    setMarcado(true);
    iniciar(async () => {
      const r = await salvarNoPipeline(item);
      if (!r.ok) {
        setMarcado(false);
        setErro(r.erro);
      }
    });
  }

  if (marcado) {
    return (
      <div className="flex h-11 min-w-0 flex-[1_1_calc(50%-0.25rem)] items-center justify-center gap-2 text-sm text-ink">
        <BookmarkCheck aria-hidden="true" className="size-4 shrink-0 text-positive" />
        <span className="truncate">No pipeline</span>
        <Link
          href="/pipeline"
          className="inline-flex h-11 shrink-0 items-center rounded-control px-2 font-medium text-ink underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          Ver
        </Link>
      </div>
    );
  }

  return (
    <div className="contents">
      <button
        type="button"
        onClick={salvar}
        disabled={pendente}
        className="inline-flex h-11 min-w-0 flex-[1_1_calc(50%-0.25rem)] items-center justify-center gap-2 rounded-control border border-control bg-transparent px-4 text-sm font-medium whitespace-nowrap text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
      >
        <BookmarkPlus aria-hidden="true" className="size-4 shrink-0" />
        {pendente ? "Salvando…" : "Salvar no pipeline"}
      </button>
      {erro ? (
        <p role="alert" className="order-last basis-full text-sm text-negative">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
