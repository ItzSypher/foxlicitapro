"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Senha mostrada uma única vez, com botão de copiar. */
export function SenhaUnica({ titulo, senha, aoFechar }: { titulo: string; senha: string; aoFechar: () => void }) {
  const [copiada, setCopiada] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(senha);
      setCopiada(true);
    } catch {
      setCopiada(false);
    }
  }

  return (
    <div role="status" className="flex flex-col gap-3 rounded-card border border-brand bg-surface p-4">
      <p className="text-sm font-medium text-ink">{titulo}</p>
      <p className="text-[13px] text-muted-foreground">Copie agora e envie à pessoa. Esta senha não aparece de novo.</p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={senha}
          aria-label="Senha gerada"
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 min-w-0 flex-1 rounded-control border border-control bg-raised px-3 font-mono text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand"
        />
        <button
          type="button"
          onClick={() => void copiar()}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-control bg-brand-fill px-4 text-sm font-medium text-black outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand"
        >
          {copiada ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          {copiada ? "Copiada" : "Copiar"}
        </button>
      </div>
      <button
        type="button"
        onClick={aoFechar}
        className="inline-flex h-11 w-fit items-center rounded-control px-3 text-sm text-muted-foreground outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand"
      >
        Já copiei
      </button>
    </div>
  );
}
