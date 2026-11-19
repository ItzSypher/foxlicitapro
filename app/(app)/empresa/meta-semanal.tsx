"use client";

import { useState, useTransition } from "react";
import { CLASSE_CAMPO } from "@/components/empresa/editor-perfil";
import { META_LIMITE } from "@/core/meta";
import { salvarMetaSemanalAction } from "./actions";

interface Props {
  minimo: number;
  ideal: number;
}

/** Só dígitos; vazio fica vazio para a pessoa poder apagar e digitar de novo. */
function soDigitos(texto: string): string {
  return texto.replace(/\D/g, "").slice(0, 3);
}

export function MetaSemanal({ minimo: minimoInicial, ideal: idealInicial }: Props) {
  const [minimo, setMinimo] = useState(String(minimoInicial));
  const [ideal, setIdeal] = useState(String(idealInicial));
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, iniciar] = useTransition();

  function salvar() {
    setAviso(null);
    const min = Number(minimo);
    const ide = Number(ideal);
    if (!Number.isInteger(min) || !Number.isInteger(ide) || min < 1 || ide < 1 || min > META_LIMITE || ide > META_LIMITE) {
      setAviso({ ok: false, texto: `Use números inteiros de 1 a ${META_LIMITE}.` });
      return;
    }
    if (ide < min) {
      setAviso({ ok: false, texto: "O ideal não pode ser menor que o mínimo." });
      return;
    }
    iniciar(async () => {
      const r = await salvarMetaSemanalAction({ minimo: min, ideal: ide });
      setAviso(r.ok ? { ok: true, texto: "Meta da semana salva." } : { ok: false, texto: r.erro });
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-ink">Meta da semana</h2>
        <p className="text-[13px] text-muted-foreground">
          Quantas licitações entram em disputa por semana (de segunda a domingo). Aparece no Pipeline, no Radar e no resumo da manhã.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="meta-minimo" className="text-sm font-medium text-ink">
            Mínimo
          </label>
          <input
            id="meta-minimo"
            inputMode="numeric"
            value={minimo}
            onChange={(e) => setMinimo(soDigitos(e.target.value))}
            className={CLASSE_CAMPO}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="meta-ideal" className="text-sm font-medium text-ink">
            Ideal
          </label>
          <input
            id="meta-ideal"
            inputMode="numeric"
            value={ideal}
            onChange={(e) => setIdeal(soDigitos(e.target.value))}
            className={CLASSE_CAMPO}
          />
        </div>
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
        {salvando ? "Salvando…" : "Salvar meta"}
      </button>
    </section>
  );
}
