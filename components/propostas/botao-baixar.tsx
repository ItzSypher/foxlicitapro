"use client";

import { Download } from "lucide-react";

export function BotaoBaixar() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-[6px] bg-[#111] px-4 text-sm font-medium text-white outline-none hover:bg-[#333] focus-visible:ring-2 focus-visible:ring-[#f57e11] focus-visible:ring-offset-2"
    >
      <Download aria-hidden className="size-4" />
      Baixar PDF
    </button>
  );
}
