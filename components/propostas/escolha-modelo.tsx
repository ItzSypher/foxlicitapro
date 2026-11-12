"use client";

import { useActionState } from "react";
import { criarRascunhoAction } from "@/app/(app)/propostas/actions";
import { MODELOS, type ModeloId } from "@/core/proposta-modelos";
import { cn } from "@/lib/utils";

type Estado = { ok: false; mensagem: string } | null;

interface Props {
  /** "{cnpj}-{ano}-{sequencial}" ou vazio para proposta em branco */
  compra: string;
  sugerido: ModeloId | null;
}

/** Cada modelo é um botão de envio: toca, cria o rascunho e abre o editor. */
export function EscolhaModelo({ compra, sugerido }: Props) {
  const [estado, enviar, pendente] = useActionState<Estado, FormData>(
    async (_anterior, dados) => criarRascunhoAction(dados),
    null,
  );

  return (
    <form action={enviar} className="flex flex-col gap-3">
      <input type="hidden" name="compra" value={compra} />
      <ul className="grid gap-3 md:grid-cols-2">
        {MODELOS.map((m) => {
          const indicado = m.id === sugerido;
          return (
            <li key={m.id} className="flex">
              <button
                type="submit"
                name="modelo"
                value={m.id}
                disabled={pendente}
                className={cn(
                  "flex min-h-11 w-full flex-col items-start gap-1.5 rounded-card border bg-surface p-4 text-left outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60",
                  indicado ? "border-brand" : "border-border",
                )}
              >
                {indicado && (
                  <span className="rounded-full bg-pill-warn-bg px-2 py-0.5 text-xs font-medium text-pill-warn-fg">
                    Indicado para esta licitação
                  </span>
                )}
                <span className="text-base font-semibold text-ink">{m.nome}</span>
                <span className="text-[13px] text-muted-foreground">{m.quandoUsar}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {pendente && (
        <p role="status" className="text-[13px] text-muted-foreground">
          Criando a proposta…
        </p>
      )}
      {estado && !estado.ok && (
        <p role="alert" className="text-[13px] text-negative">
          {estado.mensagem}
        </p>
      )}
    </form>
  );
}
