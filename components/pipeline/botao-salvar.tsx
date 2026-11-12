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
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 items-center gap-2 text-sm text-ink md:h-9">
            <BookmarkCheck aria-hidden="true" className="size-4 text-positive" />
            No pipeline
          </span>
          <Link
            href="/pipeline"
            className="inline-flex h-11 items-center rounded-control px-2 text-sm font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand md:h-9"
          >
            Ver
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={salvar}
        disabled={pendente}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-control border border-control bg-transparent px-4 text-sm font-medium text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 md:h-9"
      >
        <BookmarkPlus aria-hidden="true" className="size-4" />
        Salvar no pipeline
      </button>
      {erro ? (
        <p role="alert" className="text-xs text-negative">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
