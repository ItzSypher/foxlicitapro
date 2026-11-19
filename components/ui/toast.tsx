"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";

export interface DadosToast {
  /** Muda a cada aviso novo; reinicia o tempo de exibição */
  id: string;
  texto: string;
  /** Caminho com "Ver", opcional */
  link?: string | null;
}

/** Tempo até o aviso sumir sozinho. */
export const DURACAO_TOAST_MS = 6000;

/** Aviso curto no canto da tela: entra e sai com movimento leve, some em 6 s e fecha à mão. */
export function Toast({ toast, aoFechar }: { toast: DadosToast | null; aoFechar: () => void }) {
  const reduzir = useReducedMotion();
  const id = toast?.id ?? null;

  useEffect(() => {
    if (id === null) return;
    const t = window.setTimeout(aoFechar, DURACAO_TOAST_MS);
    return () => window.clearTimeout(t);
  }, [id, aoFechar]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed right-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex max-w-[min(22rem,calc(100vw-1.5rem))] justify-end lg:right-6 lg:bottom-6"
    >
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.id}
            initial={reduzir ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduzir ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 8, transition: { duration: 0.2 } }}
            transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
            className="pointer-events-auto flex items-center gap-3 rounded-card border border-border bg-surface py-2 pr-1 pl-4 text-sm text-ink shadow-lg"
          >
            <span className="min-w-0 flex-1 leading-snug">{toast.texto}</span>
            {toast.link ? (
              <Link
                href={toast.link}
                onClick={aoFechar}
                className="inline-flex h-11 shrink-0 items-center rounded-control px-2 text-sm font-medium text-brand outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
              >
                Ver
              </Link>
            ) : null}
            <button
              type="button"
              onClick={aoFechar}
              aria-label="Fechar aviso"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted-foreground outline-none hover:bg-raised hover:text-ink focus-visible:ring-2 focus-visible:ring-brand"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
