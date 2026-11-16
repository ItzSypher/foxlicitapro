"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowRight, ChevronLeft, ChevronRight, Compass, X } from "lucide-react";
import { Dialogo } from "@/components/novidades/dialogo";
import type { Papel } from "@/core/types-equipe";
import {
  EVENTO_ABRIR_TOUR,
  NOVIDADES,
  VERSAO_NOVIDADES,
  chaveNovidadesVistas,
  chaveProgressoTour,
  jaViuNovidades,
  passoSalvo,
  passosDoTour,
  podeFazerTour,
  type PassoTour,
} from "@/lib/novidades";
import { cn } from "@/lib/utils";

const EVENTO_VISTAS = "foxlicita:novidades-vistas";

const BOTAO_BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none";
const BOTAO_PRINCIPAL = cn(BOTAO_BASE, "bg-brand-fill font-semibold text-black hover:opacity-90");
const BOTAO_SECUNDARIO = cn(BOTAO_BASE, "border border-border text-ink hover:bg-raised");
const LINK_TELA =
  "inline-flex min-h-11 items-center gap-1.5 rounded-control px-3 text-sm font-medium text-ink underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand";

function lerArmazenado(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: string | null) {
  try {
    if (valor === null) window.localStorage.removeItem(chave);
    else window.localStorage.setItem(chave, valor);
  } catch {
    // Armazenamento bloqueado: o progresso só não fica lembrado.
  }
}

function assinarVistas(aviso: () => void): () => void {
  window.addEventListener("storage", aviso);
  window.addEventListener(EVENTO_VISTAS, aviso);
  return () => {
    window.removeEventListener("storage", aviso);
    window.removeEventListener(EVENTO_VISTAS, aviso);
  };
}

/**
 * Popup "Novidades" (uma vez por pessoa e por versão) e tour do sistema.
 * O que já foi visto e o passo do tour ficam guardados no aparelho, por usuário.
 */
export function Novidades({ usuarioId, papel }: { usuarioId: string; papel: Papel }) {
  const chaveVistas = chaveNovidadesVistas(usuarioId);
  const chaveTour = chaveProgressoTour(usuarioId);
  // No servidor, conta como visto: o popup só aparece depois que a página carrega no navegador.
  const salvo = useSyncExternalStore(
    assinarVistas,
    () => lerArmazenado(chaveVistas),
    () => VERSAO_NOVIDADES,
  );
  const [fechouAgora, setFechouAgora] = useState(false);
  const [tourAberto, setTourAberto] = useState(false);
  const [passo, setPasso] = useState(0);
  const gestor = podeFazerTour(papel);
  const passos = passosDoTour(papel);

  const popupAberto = !fechouAgora && !jaViuNovidades(salvo);

  function fecharPopup() {
    setFechouAgora(true);
    gravar(chaveVistas, VERSAO_NOVIDADES);
    window.dispatchEvent(new Event(EVENTO_VISTAS));
  }

  function abrirTour() {
    if (!gestor) return;
    setPasso(passoSalvo(lerArmazenado(chaveTour), passos.length));
    setTourAberto(true);
  }

  // A barra lateral e o menu "Mais" pedem a abertura por um evento de janela.
  useEffect(() => {
    window.addEventListener(EVENTO_ABRIR_TOUR, abrirTour);
    return () => window.removeEventListener(EVENTO_ABRIR_TOUR, abrirTour);
  });

  function irPara(novo: number) {
    setPasso(novo);
    gravar(chaveTour, String(novo));
  }

  function encerrarTour() {
    gravar(chaveTour, null);
    setTourAberto(false);
  }

  return (
    <>
      <PopupNovidades
        aberto={popupAberto}
        gestor={gestor}
        aoFechar={fecharPopup}
        aoFazerTour={() => {
          fecharPopup();
          gravar(chaveTour, null);
          setPasso(0);
          setTourAberto(true);
        }}
      />
      {gestor ? (
        <Tour aberto={tourAberto} passos={passos} passo={passo} aoIrPara={irPara} aoFechar={() => setTourAberto(false)} aoEncerrar={encerrarTour} />
      ) : null}
    </>
  );
}

function PopupNovidades({
  aberto,
  gestor,
  aoFechar,
  aoFazerTour,
}: {
  aberto: boolean;
  gestor: boolean;
  aoFechar: () => void;
  aoFazerTour: () => void;
}) {
  const principal = useRef<HTMLButtonElement>(null);
  return (
    <Dialogo aberto={aberto} aoMudar={(v) => (v ? undefined : aoFechar())} focoInicial={principal}>
      <div className="flex flex-col gap-1 px-5 pt-5 pb-3">
        <Dialog.Title className="font-heading text-lg leading-tight font-semibold text-ink">Novidades no FoxLicita Pro</Dialog.Title>
        <Dialog.Description className="text-sm text-muted-foreground">
          Veja o que mudou desde a última vez que você entrou.
        </Dialog.Description>
      </div>

      <ul className="min-h-0 flex-1 divide-y divide-rule overflow-y-auto border-y border-rule px-5">
        {NOVIDADES.map((n) => (
          <li key={n.id} className="flex min-w-0 flex-col py-3">
            <p className="text-sm font-semibold text-ink">{n.titulo}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{n.descricao}</p>
            <Link
              href={n.href}
              onClick={aoFechar}
              className="mt-1 inline-flex min-h-8 items-center gap-1 self-start rounded-control text-[13px] font-medium text-ink underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
            >
              {n.rotuloLink}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:justify-end">
        {gestor ? (
          <>
            <button type="button" onClick={aoFechar} className={BOTAO_SECUNDARIO}>
              Fechar
            </button>
            <button type="button" ref={principal} onClick={aoFazerTour} className={BOTAO_PRINCIPAL}>
              <Compass className="size-4" aria-hidden="true" />
              Fazer o tour
            </button>
          </>
        ) : (
          <button type="button" ref={principal} onClick={aoFechar} className={BOTAO_PRINCIPAL}>
            Entendi
          </button>
        )}
      </div>
    </Dialogo>
  );
}

function Tour({
  aberto,
  passos,
  passo,
  aoIrPara,
  aoFechar,
  aoEncerrar,
}: {
  aberto: boolean;
  passos: PassoTour[];
  passo: number;
  aoIrPara: (passo: number) => void;
  aoFechar: () => void;
  aoEncerrar: () => void;
}) {
  const proximo = useRef<HTMLButtonElement>(null);
  const indice = Math.min(passo, passos.length - 1);
  const atual = passos[indice];
  const ultimo = indice >= passos.length - 1;
  return (
    <Dialogo aberto={aberto} aoMudar={(v) => (v ? undefined : aoFechar())} focoInicial={proximo}>
      <Dialog.Close
        aria-label="Fechar o tour e continuar depois"
        className="absolute top-2 right-2 flex size-11 items-center justify-center rounded-control text-muted-foreground outline-none hover:bg-raised hover:text-ink focus-visible:ring-2 focus-visible:ring-brand"
      >
        <X className="size-5" aria-hidden="true" />
      </Dialog.Close>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-8 pb-4">
        <p aria-hidden="true" className="text-5xl leading-none font-semibold tabular-nums text-ink">
          {indice + 1}
          <span className="text-2xl font-normal text-muted-foreground"> / {passos.length}</span>
        </p>
        <Dialog.Title className="mt-5 font-heading text-xl leading-tight font-semibold text-ink">{atual.titulo}</Dialog.Title>
        <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">{atual.texto}</Dialog.Description>
        {atual.href ? (
          <div className="mt-4 -ml-3 flex flex-col items-start gap-1">
            <Link href={atual.href} onClick={aoFechar} className={LINK_TELA}>
              Abrir esta tela
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            {atual.extra ? (
              <Link href={atual.extra.href} onClick={aoFechar} className={LINK_TELA}>
                {atual.extra.rotulo}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-rule px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="w-16">
            <p aria-live="polite" className="sr-only">
              {indice + 1} de {passos.length}
            </p>
          </div>
          <div aria-hidden="true" className="flex items-center gap-1.5">
            {passos.map((p, i) => (
              <span
                key={p.id}
                className={cn(
                  "size-1.5 rounded-full transition-colors motion-reduce:transition-none",
                  i === indice ? "bg-ink" : i < indice ? "bg-ink/40" : "bg-control",
                )}
              />
            ))}
          </div>
          {ultimo ? (
            <span className="w-16" />
          ) : (
            <button
              type="button"
              onClick={aoEncerrar}
              className="min-h-11 w-16 rounded-control text-right text-xs text-muted-foreground outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand"
            >
              Pular tour
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => aoIrPara(indice - 1)}
            disabled={indice === 0}
            className={cn(BOTAO_SECUNDARIO, "flex-1 disabled:pointer-events-none disabled:opacity-40")}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Voltar
          </button>
          {ultimo ? (
            <button type="button" ref={proximo} onClick={aoEncerrar} className={cn(BOTAO_PRINCIPAL, "flex-1")}>
              Concluir
            </button>
          ) : (
            <button type="button" ref={proximo} onClick={() => aoIrPara(indice + 1)} className={cn(BOTAO_PRINCIPAL, "flex-1")}>
              Próximo
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </Dialogo>
  );
}
