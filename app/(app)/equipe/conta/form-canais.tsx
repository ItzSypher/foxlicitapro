"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Interruptor } from "@/components/ui/interruptor";
import { salvarCanaisAction, type EstadoCanais } from "../actions";

const ESTADO_INICIAL: EstadoCanais = { erro: null, ok: false };

interface Props {
  email: boolean;
}

export function FormCanais({ email }: Props) {
  const [estado, acao, pendente] = useActionState(salvarCanaisAction, ESTADO_INICIAL);
  return (
    <form action={acao} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-ink">Onde receber os avisos</h2>
        <p className="text-[13px] text-muted-foreground">O sino do painel sempre mostra tudo. Escolha se quer receber também por e-mail.</p>
      </div>

      <Interruptor name="avisoEmail" defaultChecked={email} rotulo="Receber por e-mail" />

      <p className="text-[13px] text-muted-foreground">
        O WhatsApp agora é ligado na tela Alertas.{" "}
        <Link href="/alertas" className="font-medium text-ink underline underline-offset-2">
          Configurar na tela Alertas
        </Link>
      </p>

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
