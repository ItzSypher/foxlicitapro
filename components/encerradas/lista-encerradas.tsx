"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { moverEtapa, removerDoPipeline } from "@/app/(app)/pipeline/actions";
import { formatarReais } from "@/components/pipeline/formato";
import type { LinkDaOportunidade } from "@/core/link-oportunidade";
import { cn } from "@/lib/utils";

/** Item já preparado no servidor: só texto e números, sem dados do pipeline que a lista não usa. */
export interface ItemEncerrado {
  id: string;
  titulo: string;
  orgao: string;
  municipio: string;
  uf: string;
  valorEstimado: number | null;
  /** "No radar", "Proposta pronta"… */
  etapaRotulo: string;
  /** "encerrou há 3 dias" */
  encerrouTexto: string;
  responsavelNome: string | null;
  /** Página da licitação, a mesma do card do pipeline, ou o link externo quando não há chave do PNCP; null sem endereço */
  link: LinkDaOportunidade | null;
}

const BOTAO =
  "inline-flex h-11 items-center justify-center rounded-control px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 lg:h-9";

export function ListaEncerradas({ itens, podeEditar }: { itens: ItemEncerrado[]; podeEditar: boolean }) {
  const [visiveis, remover] = useOptimistic(itens, (estado: ItemEncerrado[], id: string) =>
    estado.filter((i) => i.id !== id),
  );
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function moverParaDisputa(id: string) {
    setErro(null);
    iniciar(async () => {
      remover(id);
      const r = await moverEtapa(id, "disputa");
      if (!r.ok) setErro(r.erro);
    });
  }

  function removerItem(id: string) {
    setErro(null);
    setConfirmando(null);
    iniciar(async () => {
      remover(id);
      const r = await removerDoPipeline(id);
      if (!r.ok) setErro(r.erro);
    });
  }

  return (
    <>
      {erro ? (
        <p role="alert" className="rounded-control border border-border bg-pill-neg-bg px-3 py-2 text-sm text-pill-neg-fg">
          {erro}
        </p>
      ) : null}

      {visiveis.length === 0 ? (
        <div className="rounded-card border border-dashed border-control px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma licitação encerrada.</p>
        </div>
      ) : (
        <ul className="flex min-w-0 flex-col gap-3">
          {visiveis.map((i) => (
            <li key={i.id} className="flex min-w-0 flex-col gap-2.5 rounded-card border border-border bg-surface p-3 sm:p-4">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <p className="min-w-0 text-sm leading-snug font-medium break-words text-ink">{i.titulo}</p>
                {i.link === null ? null : (
                  <Link
                    href={i.link.href}
                    {...(i.link.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="inline-flex h-11 shrink-0 items-center rounded-control px-2 text-[13px] font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand lg:h-8"
                  >
                    Abrir
                  </Link>
                )}
              </div>

              <p className="text-[13px] leading-snug break-words text-muted-foreground">{i.orgao}</p>

              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-snug text-muted-foreground">
                <span className="inline-flex h-5 shrink-0 items-center rounded-control border border-border px-1.5 text-[11px] leading-none font-medium whitespace-nowrap">
                  {i.uf}
                </span>
                <span className="min-w-0 break-words">
                  {i.municipio} ·{" "}
                  <span className="tabular-nums">
                    {i.valorEstimado === null ? "—" : formatarReais(i.valorEstimado)}
                  </span>
                </span>
              </p>

              <p className="text-[13px] leading-snug text-muted-foreground">
                Estava em <span className="text-ink">{i.etapaRotulo}</span> · {i.encerrouTexto}
              </p>
              <p className="text-[13px] leading-snug text-muted-foreground">
                Responsável: <span className="text-ink">{i.responsavelNome ?? "ninguém"}</span>
              </p>

              {podeEditar ? (
                confirmando === i.id ? (
                  <div role="group" aria-label="Confirmar remoção" className="flex flex-col gap-2 border-t border-border pt-3">
                    <p className="text-[13px] leading-snug text-ink">Remover “{i.titulo}” do pipeline?</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => removerItem(i.id)}
                        disabled={pendente}
                        className={cn(BOTAO, "flex-1 bg-negative font-medium text-ground")}
                      >
                        Remover
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmando(null)}
                        className={cn(BOTAO, "flex-1 border border-control text-ink hover:bg-active")}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => moverParaDisputa(i.id)}
                      disabled={pendente}
                      className={cn(BOTAO, "border border-control text-ink hover:bg-active")}
                    >
                      Mover para Em disputa
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmando(i.id)}
                      disabled={pendente}
                      className={cn(BOTAO, "text-muted-foreground hover:bg-raised hover:text-ink")}
                    >
                      Remover
                    </button>
                  </div>
                )
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
