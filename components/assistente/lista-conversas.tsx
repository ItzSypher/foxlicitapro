"use client";

import { useEffect, useState, useTransition } from "react";
import { MessageSquare, Trash2 } from "lucide-react";
import { apagarConversaAction, listarConversasAction } from "@/app/(app)/conselheiro/conversas-actions";
import { quandoFoi, type ResumoConversa } from "@/lib/conselheiro/historico";
import { cn } from "@/lib/utils";

/** Lista das conversas guardadas da pessoa: tocar continua, a lixeira apaga depois de confirmar. */
export function ListaConversas({
  atual,
  aoContinuar,
  aoApagar,
}: {
  atual: string | null;
  aoContinuar: (id: string) => void;
  aoApagar: (id: string) => void;
}) {
  const [conversas, setConversas] = useState<ResumoConversa[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [apagando, iniciar] = useTransition();

  useEffect(() => {
    let ativo = true;
    void listarConversasAction().then((r) => {
      if (!ativo) return;
      if (r.ok) setConversas(r.dados);
      else setErro(r.erro);
    });
    return () => {
      ativo = false;
    };
  }, []);

  function apagar(id: string) {
    setErro(null);
    iniciar(async () => {
      const r = await apagarConversaAction(id);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setConfirmando(null);
      setConversas((atuais) => (atuais ?? []).filter((c) => c.id !== id));
      aoApagar(id);
    });
  }

  if (conversas === null && erro === null) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Carregando as conversas…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {erro ? (
        <p role="alert" className="text-sm text-negative">
          {erro}
        </p>
      ) : null}
      {conversas !== null && conversas.length === 0 ? (
        <p className="text-sm leading-snug text-muted-foreground">Nenhuma conversa guardada ainda. As perguntas que você fizer aparecem aqui.</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {(conversas ?? []).map((c) => (
          <li
            key={c.id}
            className={cn("flex min-w-0 items-stretch gap-1 rounded-card border bg-surface", c.id === atual ? "border-brand" : "border-border")}
          >
            {confirmando === c.id ? (
              <div className="flex min-w-0 flex-1 flex-col gap-2 px-3 py-2">
                <p className="text-[13px] leading-snug text-ink">Apagar esta conversa? Não dá para desfazer.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => apagar(c.id)}
                    disabled={apagando}
                    className="min-h-9 rounded-control bg-pill-neg-bg px-3 text-[13px] font-medium text-pill-neg-fg outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
                  >
                    {apagando ? "Apagando…" : "Apagar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmando(null)}
                    disabled={apagando}
                    className="min-h-9 rounded-control border border-control px-3 text-[13px] text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => aoContinuar(c.id)}
                  className="flex min-h-11 min-w-0 flex-1 items-start gap-2 rounded-card px-3 py-2 text-left outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <MessageSquare aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="line-clamp-2 text-sm leading-snug break-words text-ink">{c.titulo}</span>
                    <span className="text-xs text-muted-foreground">
                      {quandoFoi(c.atualizadoEm)} · {c.mensagens} {c.mensagens === 1 ? "mensagem" : "mensagens"}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmando(c.id)}
                  aria-label={`Apagar a conversa ${c.titulo}`}
                  className="inline-flex size-11 shrink-0 items-center justify-center self-center rounded-control text-muted-foreground outline-none hover:bg-active hover:text-negative focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
