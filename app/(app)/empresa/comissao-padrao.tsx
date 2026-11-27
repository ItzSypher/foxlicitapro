"use client";

import { useState, useTransition } from "react";
import { CLASSE_CAMPO } from "@/components/empresa/editor-perfil";
import { lerValorDigitado } from "@/core/fluxo-caixa";
import { COMISSAO_MAXIMA, COMISSAO_MINIMA } from "@/core/lucro";
import { salvarComissaoPadraoAction } from "./actions";

export function ComissaoPadrao({ percentual: inicial }: { percentual: number }) {
  const [texto, setTexto] = useState(String(inicial).replace(".", ","));
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, iniciar] = useTransition();

  function salvar() {
    setAviso(null);
    const percentual = lerValorDigitado(texto);
    if (percentual === null || percentual < COMISSAO_MINIMA || percentual > COMISSAO_MAXIMA) {
      setAviso({ ok: false, texto: `Use um número de ${COMISSAO_MINIMA} a ${COMISSAO_MAXIMA}.` });
      return;
    }
    iniciar(async () => {
      const r = await salvarComissaoPadraoAction({ percentual });
      setAviso(r.ok ? { ok: true, texto: "Comissão salva." } : { ok: false, texto: r.erro });
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-ink">Comissão</h2>
        <p className="text-[13px] text-muted-foreground">
          Só entra na licitação em que você marcar Tem comissão.
        </p>
      </div>

      <div className="flex flex-col gap-1 sm:max-w-48">
        <label htmlFor="comissao-padrao" className="text-sm font-medium text-ink">
          Comissão ao marcar (%)
        </label>
        <input
          id="comissao-padrao"
          inputMode="decimal"
          value={texto}
          onChange={(e) => setTexto(e.target.value.replace(/[^\d.,]/g, "").slice(0, 5))}
          className={`${CLASSE_CAMPO} tabular-nums`}
        />
      </div>

      {aviso ? (
        <p role={aviso.ok ? "status" : "alert"} className={aviso.ok ? "text-sm text-positive" : "text-sm text-negative"}>
          {aviso.texto}
        </p>
      ) : null}
      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="h-11 w-full cursor-pointer rounded-control bg-brand-fill px-4 text-base font-medium text-black outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-wait disabled:opacity-60 sm:w-fit"
      >
        {salvando ? "Salvando…" : "Salvar comissão"}
      </button>
    </section>
  );
}
