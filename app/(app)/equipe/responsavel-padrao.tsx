"use client";

import { useState, useTransition } from "react";
import { CONTROLE } from "@/components/propostas/campos";
import { definirResponsavelPadraoAction } from "./actions";

interface Props {
  pessoas: ReadonlyArray<{ id: string; nome: string }>;
  atual: string | null;
}

export function ResponsavelPadrao({ pessoas, atual }: Props) {
  const [valor, setValor] = useState(atual ?? "");
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  function salvar() {
    setMensagem(null);
    iniciar(async () => {
      const r = await definirResponsavelPadraoAction(valor);
      setMensagem(r.ok ? { ok: true, texto: "Responsável padrão salvo." } : { ok: false, texto: r.erro });
    });
  }

  return (
    <section aria-labelledby="titulo-responsavel" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 id="titulo-responsavel" className="text-base font-semibold text-ink">
          Responsável padrão
        </h2>
        <p className="text-[13px] text-muted-foreground">
          Quem fica com o item quando alguém toca &quot;Atribuir a ...&quot; nos alertas do WhatsApp. Sem escolha, o item fica com quem tocou.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="responsavel-padrao" className="sr-only">
          Responsável padrão
        </label>
        <select id="responsavel-padrao" value={valor} onChange={(e) => setValor(e.target.value)} className={`${CONTROLE} sm:max-w-xs`}>
          <option value="">Quem tocar o botão</option>
          {pessoas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pendente || valor === (atual ?? "")}
          onClick={salvar}
          className="inline-flex h-11 w-full items-center justify-center rounded-control bg-brand-fill px-4 text-sm font-medium text-black outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 sm:w-fit"
        >
          {pendente ? "Salvando…" : "Salvar"}
        </button>
      </div>
      {mensagem ? (
        <p role={mensagem.ok ? "status" : "alert"} className={`text-[13px] ${mensagem.ok ? "text-positive" : "text-negative"}`}>
          {mensagem.texto}
        </p>
      ) : null}
    </section>
  );
}
