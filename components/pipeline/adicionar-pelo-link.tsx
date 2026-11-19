"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Link2, XCircle } from "lucide-react";
import { adicionarPelosLinksAction } from "@/app/(app)/pipeline/actions";
import type { ResultadoDoTexto } from "@/lib/adicionar-pelo-link";
import { cn } from "@/lib/utils";

/** Botão do topo do Pipeline: cola um ou vários links do PNCP (um por linha) e põe cada licitação na etapa Radar. */
export function AdicionarPeloLink() {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ResultadoDoTexto[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const idCampo = useId();
  const idPainel = useId();

  function enviar() {
    setErro(null);
    setResultados(null);
    iniciar(async () => {
      const r = await adicionarPelosLinksAction(texto);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setResultados(r.resultados);
      // Se algo falhou, o texto fica no campo para corrigir e tentar de novo.
      if (r.resultados.every((x) => x.ok)) setTexto("");
    });
  }

  return (
    <div data-tour="pipeline-link" className="flex min-w-0 flex-col gap-3">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={idPainel}
        onClick={() => setAberto((v) => !v)}
        className="inline-flex h-11 w-full items-center justify-center gap-2 self-start rounded-control border border-control bg-transparent px-4 text-sm font-medium whitespace-nowrap text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand sm:w-auto md:h-9"
      >
        <Link2 aria-hidden="true" className="size-4 shrink-0" />
        Adicionar pelo link
      </button>

      {aberto ? (
        <div id={idPainel} className="flex min-w-0 flex-col gap-3 rounded-card border border-border bg-surface p-3 sm:p-4">
          <label htmlFor={idCampo} className="text-sm font-medium text-ink">
            Links das licitações no PNCP (um por linha)
          </label>
          <textarea
            id={idCampo}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="https://pncp.gov.br/app/editais/00000000000000/2025/123"
            className="min-h-24 w-full min-w-0 resize-y rounded-control border border-control bg-ground px-3 py-2 text-base text-ink outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-brand md:text-sm"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={enviar}
              disabled={pendente || texto.trim() === ""}
              className="inline-flex h-11 w-full items-center justify-center rounded-control bg-brand px-4 text-sm font-medium text-black outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-60 sm:w-auto md:h-9"
            >
              {pendente ? "Adicionando…" : "Adicionar ao Pipeline"}
            </button>
            <p className="text-[13px] text-muted-foreground">Aceita o link do PNCP, o número de controle ou o link desta página da licitação.</p>
          </div>

          {erro ? (
            <p role="alert" className="rounded-control border border-border bg-pill-neg-bg px-3 py-2 text-sm text-pill-neg-fg">
              {erro}
            </p>
          ) : null}

          {resultados ? (
            <ul aria-live="polite" className="flex min-w-0 flex-col gap-2">
              {resultados.map((r, i) => (
                <li key={`${r.entrada}-${i}`} className="flex min-w-0 items-start gap-2 text-sm">
                  {r.ok ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-positive" />
                  ) : (
                    <XCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-negative" />
                  )}
                  <div className={cn("min-w-0 flex-1", r.ok ? "text-ink" : "text-negative")}>
                    {r.ok ? (
                      <>
                        <Link
                          href={r.href}
                          className="font-medium break-words underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
                        >
                          {r.titulo}
                        </Link>
                        <p className="text-[13px] text-muted-foreground">
                          {r.jaEstava ? `Já estava no Pipeline, em ${r.rotuloEtapa}.` : `Adicionada em ${r.rotuloEtapa}.`}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium break-all">{r.entrada}</p>
                        <p className="text-[13px]">{r.erro}</p>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
