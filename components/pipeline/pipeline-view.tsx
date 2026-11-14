"use client";

import { useCallback, useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { definirResponsavelAction, moverEtapa, removerDoPipeline } from "@/app/(app)/pipeline/actions";
import { cn } from "@/lib/utils";
import { BlocoErro } from "./bloco-erro";
import { Coluna } from "./coluna";
import { linhaDeNumeros } from "./formato";
import { useColunas } from "./midia";
import { ETAPAS, ehMeu, montarResumo, type EtapaId, type ItemPipeline, type PessoaPipeline } from "./tipos";

type Acao =
  | { tipo: "mover"; id: string; etapa: EtapaId }
  | { tipo: "remover"; id: string }
  | { tipo: "responsavel"; id: string; responsavelId: string | null; nome: string | null };

function reduzir(estado: ItemPipeline[], acao: Acao): ItemPipeline[] {
  if (acao.tipo === "remover") return estado.filter((i) => i.id !== acao.id);
  if (acao.tipo === "responsavel") {
    return estado.map((i) =>
      i.id === acao.id ? { ...i, responsavelId: acao.responsavelId, responsavelNome: acao.nome } : i,
    );
  }
  const maior = estado
    .filter((i) => i.etapa === acao.etapa && i.id !== acao.id)
    .reduce((m, i) => Math.max(m, i.ordem), 0);
  return estado.map((i) => (i.id === acao.id ? { ...i, etapa: acao.etapa, ordem: maior + 1 } : i));
}

interface Props {
  /** null quando a leitura do banco falhou */
  itens: ItemPipeline[] | null;
  etapaInicial: EtapaId;
  agoraInicial: number;
  usuarioId: string;
  /** Pessoas ativas que podem assumir um item */
  pessoas: PessoaPipeline[];
  /** Quem só consulta não vê os controles de mover, remover, responsável e notas */
  podeEditar: boolean;
  /** Pode marcar o checklist da revisão jurídica */
  podeRevisar: boolean;
}

export function PipelineView({ itens: itensServidor, etapaInicial, agoraInicial, usuarioId, pessoas, podeEditar, podeRevisar }: Props) {
  if (itensServidor === null) {
    return (
      <div className="flex flex-col gap-4 lg:gap-6">
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Pipeline</h1>
        <BlocoErro />
      </div>
    );
  }
  return (
    <Quadro
      itensServidor={itensServidor}
      etapaInicial={etapaInicial}
      agoraInicial={agoraInicial}
      usuarioId={usuarioId}
      pessoas={pessoas}
      podeEditar={podeEditar}
      podeRevisar={podeRevisar}
    />
  );
}

function Quadro({
  itensServidor,
  etapaInicial,
  agoraInicial,
  usuarioId,
  pessoas,
  podeEditar,
  podeRevisar,
}: {
  itensServidor: ItemPipeline[];
  etapaInicial: EtapaId;
  agoraInicial: number;
  usuarioId: string;
  pessoas: PessoaPipeline[];
  podeEditar: boolean;
  podeRevisar: boolean;
}) {
  const [todos, aplicar] = useOptimistic(itensServidor, reduzir);
  const [soMeus, setSoMeus] = useState(false);
  const itens = useMemo(() => (soMeus ? todos.filter((i) => ehMeu(i, usuarioId)) : todos), [todos, soMeus, usuarioId]);
  const [, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<EtapaId>(etapaInicial);
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<EtapaId | null>(null);
  const colunas = useColunas();
  const trilho = useRef<HTMLDivElement | null>(null);
  const tablist = useRef<HTMLDivElement | null>(null);
  const abaInicial = useRef(etapaInicial);
  /** Etapa para a qual um toque numa aba está rolando: a rolagem não deve trocar a aba no caminho. */
  const destino = useRef<EtapaId | null>(null);
  const pausa = useRef<number | undefined>(undefined);
  const limpeza = useRef<number | undefined>(undefined);

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
    const atual = todos.find((i) => i.id === id);
    if (!atual || atual.etapa === etapa) return;
    setErro(null);
    iniciar(async () => {
      aplicar({ tipo: "mover", id, etapa });
      const r = await moverEtapa(id, etapa);
      if (!r.ok) setErro(r.erro);
    });
  }

  function trocarResponsavel(id: string, responsavelId: string | null) {
    const nome = pessoas.find((p) => p.id === responsavelId)?.nome ?? null;
    setErro(null);
    iniciar(async () => {
      aplicar({ tipo: "responsavel", id, responsavelId, nome });
      const r = await definirResponsavelAction(id, responsavelId);
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

  /** Posição de rolagem do trilho em que a coluna da etapa fica inteira na vista. */
  function posicaoDa(id: EtapaId): number {
    const quadro = trilho.current;
    const indice = ETAPAS.findIndex((e) => e.id === id);
    const coluna = quadro?.children.item(indice);
    const primeira = quadro?.children.item(0);
    if (!(coluna instanceof HTMLElement) || !(primeira instanceof HTMLElement)) return 0;
    return coluna.offsetLeft - primeira.offsetLeft;
  }

  function tocarAba(id: EtapaId) {
    escolherAba(id);
    destino.current = id;
    window.clearTimeout(limpeza.current);
    limpeza.current = window.setTimeout(() => {
      destino.current = null;
    }, 700);
    trilho.current?.scrollTo({ left: posicaoDa(id), behavior: "smooth" });
  }

  /** Deslizar entre etapas no celular: quando a rolagem assenta, a aba acompanha a coluna à vista. */
  function aoRolar() {
    if (colunas) return;
    window.clearTimeout(pausa.current);
    pausa.current = window.setTimeout(() => {
      const quadro = trilho.current;
      if (!quadro) return;
      const passo = posicaoDa(ETAPAS[1].id);
      const indice = passo > 0 ? Math.round(quadro.scrollLeft / passo) : 0;
      const etapa = ETAPAS[Math.min(Math.max(indice, 0), ETAPAS.length - 1)];
      if (destino.current !== null) {
        if (destino.current === etapa.id) destino.current = null;
        return;
      }
      escolherAba(etapa.id);
    }, 100);
  }

  const ligarTrilho = useCallback((no: HTMLDivElement | null) => {
    trilho.current = no;
    if (!no) return;
    const indice = ETAPAS.findIndex((e) => e.id === abaInicial.current);
    const coluna = no.children.item(indice);
    const primeira = no.children.item(0);
    if (coluna instanceof HTMLElement && primeira instanceof HTMLElement) {
      no.scrollTo({ left: coluna.offsetLeft - primeira.offsetLeft, behavior: "instant" });
    }
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(pausa.current);
      window.clearTimeout(limpeza.current);
    },
    [],
  );

  // Mantém a aba ativa à vista na fileira de segmentos.
  useEffect(() => {
    const fileira = tablist.current;
    const botao = fileira?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!fileira || !botao) return;
    fileira.scrollTo({ left: botao.offsetLeft - (fileira.clientWidth - botao.offsetWidth) / 2, behavior: "smooth" });
  }, [aba]);

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
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[22px] font-semibold leading-tight text-ink">Pipeline</h1>
          <p className="font-mono text-[13px] tabular-nums text-muted-foreground">{linhaDeNumeros(resumo)}</p>
        </div>
        <button
          type="button"
          aria-pressed={soMeus}
          onClick={() => setSoMeus((v) => !v)}
          className={cn(
            "inline-flex h-11 shrink-0 items-center rounded-control border px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand",
            soMeus ? "border-brand bg-active font-medium text-ink" : "border-control text-muted-foreground hover:bg-active hover:text-ink",
          )}
        >
          Só os meus
        </button>
      </div>

      {erro ? (
        <p
          role="alert"
          className="rounded-control border border-border bg-pill-neg-bg px-3 py-2 text-sm text-pill-neg-fg"
        >
          {erro}
        </p>
      ) : null}

      {todos.length === 0 ? (
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
            ref={tablist}
            role="tablist"
            aria-label="Etapas"
            className="sem-barra relative -mx-4 flex gap-1 overflow-x-auto px-4 md:hidden"
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
                  onClick={() => tocarAba(e.id)}
                  className={cn(
                    "flex h-11 shrink-0 items-center gap-2 rounded-control px-3 text-sm whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-brand",
                    ativa ? "bg-active font-medium text-ink" : "text-muted-foreground",
                  )}
                >
                  {e.rotulo}
                  <span className="font-mono text-xs tabular-nums">{resumo.porEtapa[e.id].quantidade}</span>
                </button>
              );
            })}
          </div>

          <div
            ref={ligarTrilho}
            onScroll={aoRolar}
            className="sem-barra relative flex min-w-0 snap-x snap-mandatory items-start gap-3 overflow-x-auto md:h-[calc(100dvh-17rem)] md:snap-none md:items-stretch md:pb-2 lg:h-[calc(100dvh-13rem)]"
          >
            {ETAPAS.map((e) => (
              <Coluna
                key={e.id}
                etapa={e.id}
                rotulo={e.rotulo}
                itens={porEtapa.get(e.id) ?? []}
                resumo={resumo.porEtapa[e.id]}
                ativaNoTelefone={aba === e.id}
                colunas={colunas}
                agoraInicial={agoraInicial}
                pessoas={pessoas}
                aoResponsavel={trocarResponsavel}
                podeEditar={podeEditar}
                podeRevisar={podeRevisar}
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
        </>
      )}
    </div>
  );
}
