"use client";

import { useActionState } from "react";
import { CONTROLE } from "@/components/propostas/campos";
import { trocarMinhaSenhaAction, type EstadoSenha } from "../actions";

const ESTADO_INICIAL: EstadoSenha = { erro: null, ok: false };

function Campo({ id, rotulo, autoComplete }: { id: string; rotulo: string; autoComplete: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {rotulo}
      </label>
      <input id={id} name={id} type="password" required maxLength={200} autoComplete={autoComplete} className={CONTROLE} />
    </div>
  );
}

export function FormSenha() {
  const [estado, acao, pendente] = useActionState(trocarMinhaSenhaAction, ESTADO_INICIAL);
  return (
    <form action={acao} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <h2 className="text-base font-semibold text-ink">Trocar senha</h2>
      <Campo id="atual" rotulo="Senha atual" autoComplete="current-password" />
      <Campo id="nova" rotulo="Nova senha (mínimo 8 caracteres)" autoComplete="new-password" />
      <Campo id="confirmar" rotulo="Repita a nova senha" autoComplete="new-password" />
      {estado.erro ? (
        <p role="alert" className="text-[13px] text-negative">
          {estado.erro}
        </p>
      ) : null}
      {estado.ok ? (
        <p role="status" className="text-[13px] text-positive">
          Senha alterada.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pendente}
        className="inline-flex h-11 w-full items-center justify-center rounded-control bg-brand-fill px-4 text-sm font-medium text-black outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 sm:w-fit"
      >
        {pendente ? "Salvando…" : "Trocar senha"}
      </button>
    </form>
  );
}
