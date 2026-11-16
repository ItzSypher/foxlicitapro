"use client";

import { useActionState } from "react";
import { Interruptor } from "@/components/ui/interruptor";
import { CONTROLE } from "@/components/propostas/campos";
import { salvarCanaisAction, type EstadoCanais } from "../actions";

const ESTADO_INICIAL: EstadoCanais = { erro: null, ok: false };

interface Props {
  /** Número já formatado para mostrar, ou vazio */
  whatsapp: string;
  email: boolean;
  avisoWhatsapp: boolean;
  /** O servidor tem a Evolution API configurada */
  whatsappDisponivel: boolean;
}

export function FormCanais({ whatsapp, email, avisoWhatsapp, whatsappDisponivel }: Props) {
  const [estado, acao, pendente] = useActionState(salvarCanaisAction, ESTADO_INICIAL);
  return (
    <form action={acao} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-ink">Onde receber os avisos</h2>
        <p className="text-[13px] text-muted-foreground">O sino do painel sempre mostra tudo. Escolha se quer receber também fora dele.</p>
      </div>

      <Interruptor name="avisoEmail" defaultChecked={email} rotulo="Receber por e-mail" />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="whatsapp" className="text-[13px] font-medium text-ink">
          Número de WhatsApp
        </label>
        <input
          id="whatsapp"
          name="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={40}
          defaultValue={whatsapp}
          placeholder="(21) 99999-0000"
          className={CONTROLE}
        />
      </div>

      <Interruptor
        name="avisoWhatsapp"
        defaultChecked={avisoWhatsapp}
        rotulo="Receber por WhatsApp"
        descricao={whatsappDisponivel ? undefined : "Ainda não está ativo neste painel. Sua escolha fica guardada."}
      />

      {estado.erro ? (
        <p role="alert" className="text-[13px] text-negative">
          {estado.erro}
        </p>
      ) : null}
      {estado.ok ? (
        <p role="status" className="text-[13px] text-positive">
          Preferências salvas.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pendente}
        className="inline-flex h-11 w-full items-center justify-center rounded-control bg-brand-fill px-4 text-sm font-medium text-black outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 sm:w-fit"
      >
        {pendente ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}
