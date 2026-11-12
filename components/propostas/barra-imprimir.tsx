"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { BOTAO_PRIMARIO } from "@/components/propostas/campos";

/** Abre o diálogo de impressão ao carregar e deixa o botão para repetir. Some na impressão. */
export function BarraImprimir({ voltarPara }: { voltarPara: string }) {
  useEffect(() => {
    const t = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="nao-imprimir flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => window.print()} className={BOTAO_PRIMARIO}>
          <Printer aria-hidden className="size-4" />
          Imprimir ou salvar em PDF
        </button>
        <Link
          href={voltarPara}
          className="inline-flex h-11 items-center gap-1.5 rounded-control px-3 text-sm text-muted-foreground outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Voltar à proposta
        </Link>
      </div>
      <p className="text-[13px] text-muted-foreground">No diálogo de impressão, escolha Salvar como PDF.</p>
    </div>
  );
}
