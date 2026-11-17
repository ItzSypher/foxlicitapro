"use client";

import { useState, useTransition } from "react";
import { desligarAction, pausarAction, religarAction, type ResultadoSimples } from "./actions";

const BOTAO =
  "inline-flex h-11 w-full items-center justify-center rounded-control border border-border bg-surface px-4 text-sm font-medium text-ink outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 sm:w-fit";
const BOTAO_PERIGO =
  "inline-flex h-11 w-full items-center justify-center rounded-control border border-border bg-surface px-4 text-sm font-medium text-negative outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 sm:w-fit";

export function ControlesWhatsapp({ recebendo }: { recebendo: boolean }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function executar(acao: () => Promise<ResultadoSimples>) {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) setErro(r.erro);
    });
  }

  function desligar() {
    if (!window.confirm("Desligar o WhatsApp? Você deixa de receber os alertas e precisará ligar de novo para voltar.")) return;
    executar(desligarAction);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" disabled={pendente} onClick={() => executar(recebendo ? pausarAction : religarAction)} className={BOTAO}>
          {recebendo ? "Pausar" : "Religar"}
        </button>
        <button type="button" disabled={pendente} onClick={desligar} className={BOTAO_PERIGO}>
          Desligar
        </button>
      </div>
      {erro ? (
        <p role="alert" className="text-[13px] text-negative">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
