"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

/** Aviso discreto de parte que não carregou; o resto da tela segue. */
export function AvisoFalha({ texto }: { texto: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-x-4 rounded-card border border-dashed border-control px-4 py-1"
    >
      <p className="py-2 text-[13px] text-muted-foreground">{texto}</p>
      <button
        type="button"
        onClick={() => iniciar(() => router.refresh())}
        disabled={pendente}
        className="inline-flex h-11 items-center rounded-control px-1 text-sm font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
      >
        {pendente ? "Tentando…" : "Tentar de novo"}
      </button>
    </div>
  );
}
