"use client";

import { useMemo, useOptimistic, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { moverEtapa, removerDoPipeline } from "@/app/(app)/pipeline/actions";
import { cn } from "@/lib/utils";
import { BlocoErro } from "./bloco-erro";
import { Coluna } from "./coluna";
import { linhaDeNumeros } from "./formato";
import { ETAPAS, montarResumo, type EtapaId, type ItemPipeline } from "./tipos";

type Acao = { tipo: "mover"; id: string; etapa: EtapaId } | { tipo: "remover"; id: string };

function reduzir(estado: ItemPipeline[], acao: Acao): ItemPipeline[] {
  if (acao.tipo === "remover") return estado.filter((i) => i.id !== acao.id);
  const maior = estado
    .filter((i) => i.etapa === acao.etapa && i.id !== acao.id)
    .reduce((m, i) => Math.max(m, i.ordem), 0);
  return estado.map((i) => (i.id === acao.id ? { ...i, etapa: acao.etapa, ordem: maior + 1 } : i));
}

const CONSULTA_DESKTOP = "(min-width: 1024px)";

function assinarDesktop(aviso: () => void): () => void {
  const m = window.matchMedia(CONSULTA_DESKTOP);
  m.addEventListener("change", aviso);
  return () => m.removeEventListener("change", aviso);
}

function useDesktop(): boolean {
  return useSyncExternalStore(
    assinarDesktop,
    () => window.matchMedia(CONSULTA_DESKTOP).matches,
    () => false,
  );
}

interface Props {
  /** null quando a leitura do banco falhou */
  itens: ItemPipeline[] | null;
  etapaInicial: EtapaId;
  agoraInicial: number;
}

export function PipelineView({ itens: itensServidor, etapaInicial, agoraInicial }: Props) {
  if (itensServidor === null) {
    return (
      <div className="flex flex-col gap-4 lg:gap-6">
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Pipeline</h1>
        <BlocoErro />
      </div>
    );
  }
  return <Quadro itensServidor={itensServidor} etapaInicial={etapaInicial} agoraInicial={agoraInicial} />;
}

function Quadro({
  itensServidor,
  etapaInicial,
  agoraInicial,
}: {
  itensServidor: ItemPipeline[];
  etapaInicial: EtapaId;
  agoraInicial: number;
}) {
  const [itens, aplicar] = useOptimistic(itensServidor, reduzir);
  const [, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<EtapaId>(etapaInicial);
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<EtapaId | null>(null);
  const desktop = useDesktop();

  const resumo = useMemo(
    () => montarResumo(itens.map((i) => ({ etapa: i.etapa, quantidade: 1, valor: i.item.valorEstimado }))),
    [itens],
  );

  const porEtapa = useMemo(() => {
    const mapa = new Map<EtapaId, ItemPipeline[]>(ETAPAS.map((e) => [e.id, []]));
    for (const i of itens) mapa.get(i.etapa)?.push(i);
    for (const lista of mapa.values()) lista.sort((a, b) => a.ordem - b.ordem);
    return mapa;
  }, [itens]);

  function mover(id: string, etapa: EtapaId) {
    const atual = itens.find((i) => i.id === id);
    if (!atual || atual.etapa === etapa) return;
    setErro(null);
    iniciar(async () => {
      aplicar({ tipo: "mover", id, etapa });
      const r = await moverEtapa(id, etapa);
      if (!r.ok) setErro(r.erro);
    });
  }

  function remover(id: string) {
    setErro(null);
    iniciar(async () => {
      aplicar({ tipo: "remover", id });
      const r = await removerDoPipeline(id);
      if (!r.ok) setErro(r.erro);
    });
  }

  function escolherAba(id: EtapaId) {
    setAba(id);
    window.history.replaceState(null, "", `?etapa=${id}`);
  }

  function limparArraste() {
    setArrastandoId(null);
    setAlvo(null);
  }

  function soltar(id: string | null, etapa: EtapaId) {
    limparArraste();
    if (id !== null) mover(id, etapa);
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Pipeline</h1>
        <p className="font-mono text-[13px] tabular-nums text-muted-foreground">{linhaDeNumeros(resumo)}</p>
      </div>

      {erro ? (
        <p
          role="alert"
          className="rounded-control border border-border bg-pill-neg-bg px-3 py-2 text-sm text-pill-neg-fg"
        >
          {erro}
        </p>
      ) : null}

      {itens.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-control px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Seu pipeline está vazio. Salve oportunidades do Radar para acompanhá-las aqui.
          </p>
          <Link
            href="/radar"
            className="inline-flex h-11 items-center rounded-control bg-brand px-4 text-sm font-medium text-black outline-none focus-visible:ring-2 focus-visible:ring-ink md:h-9"
          >
            Ir para o Radar
          </Link>
        </div>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="Etapas"
            className="sem-barra -mx-4 flex gap-1 overflow-x-auto px-4 lg:hidden"
          >
            {ETAPAS.map((e) => {
              const ativa = aba === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  role="tab"
                  aria-selected={ativa}
                  aria-controls={`coluna-${e.id}`}
                  onClick={() => escolherAba(e.id)}
                  className={cn(
                    "flex h-11 shrink-0 items-center gap-2 rounded-control px-3 text-sm whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-brand",
                    ativa ? "bg-active text-ink" : "text-muted-foreground",
                  )}
                >
                  {e.rotulo}
                  <span className="font-mono text-xs tabular-nums">{resumo.porEtapa[e.id].quantidade}</span>
                </button>
              );
            })}
          </div>

          <div className="min-w-0 lg:h-[calc(100dvh-13rem)] lg:overflow-x-auto lg:pb-2">
            <div className="flex flex-col lg:h-full lg:flex-row lg:gap-3">
              {ETAPAS.map((e) => (
                <Coluna
                  key={e.id}
                  etapa={e.id}
                  rotulo={e.rotulo}
                  itens={porEtapa.get(e.id) ?? []}
                  resumo={resumo.porEtapa[e.id]}
                  ativaNoTelefone={aba === e.id}
                  agoraInicial={agoraInicial}
                  desktop={desktop}
                  arrastandoId={arrastandoId}
                  alvo={alvo === e.id}
                  aoEntrarNoAlvo={setAlvo}
                  aoSairDoAlvo={() => setAlvo(null)}
                  aoSoltar={soltar}
                  aoIniciarArraste={setArrastandoId}
                  aoTerminarArraste={limparArraste}
                  aoMover={mover}
                  aoRemover={remover}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
