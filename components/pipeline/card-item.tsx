"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink } from "lucide-react";
import { salvarNotas } from "@/app/(app)/pipeline/actions";
import { resumirObjeto } from "@/core/objeto";
import type { Faixa } from "@/core/types";
import { restanteMs } from "@/lib/formato";
import { useAgora } from "@/lib/relogio";
import { cn } from "@/lib/utils";
import { formatarReais, textoFecha } from "./formato";
import { MenuAcoes } from "./menu-acoes";
import { SeletorEtapa } from "./seletor-etapa";
import type { EtapaId, ItemPipeline } from "./tipos";

const COR_FAIXA: Record<Faixa, string> = {
  go: "text-positive",
  atencao: "text-warning",
  nogo: "text-negative",
};

const BOTAO_SECUNDARIO =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-control border border-control px-3 text-sm text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand";

function Prazo({ encerramentoIso, agoraInicial }: { encerramentoIso: string; agoraInicial: number }) {
  const fim = Date.parse(encerramentoIso);
  const agora = useAgora(Number.isNaN(fim) ? null : fim, agoraInicial);
  const texto = textoFecha(restanteMs(encerramentoIso, agora));
  return (
    <span
      className={cn(
        "font-mono text-xs tabular-nums",
        texto === null ? "text-muted-foreground" : "text-ink",
      )}
    >
      {texto ?? "Encerrada"}
    </span>
  );
}

function Notas({ id, inicial, aoAbrir }: { id: string; inicial: string; aoAbrir: (aberto: boolean) => void }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState(inicial);
  const [base, setBase] = useState(inicial);
  const [carimbo, setCarimbo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  useEffect(() => {
    if (!carimbo) return;
    const t = setTimeout(() => setCarimbo(false), 2000);
    return () => clearTimeout(t);
  }, [carimbo]);

  function alternar() {
    const novo = !aberto;
    setAberto(novo);
    aoAbrir(novo);
  }

  function salvar() {
    if (texto === base) return;
    setErro(null);
    iniciar(async () => {
      const r = await salvarNotas(id, texto);
      if (r.ok) {
        setBase(texto);
        setCarimbo(true);
      } else {
        setErro(r.erro);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={alternar}
          aria-expanded={aberto}
          className="inline-flex h-11 items-center gap-1 rounded-control text-[13px] text-muted-foreground outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand lg:h-8"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn("size-4 transition-transform", aberto ? "rotate-180" : "")}
          />
          {base.trim() === "" ? "Notas" : "Notas (com texto)"}
        </button>
        {carimbo ? (
          <span role="status" className="text-xs text-faint">
            Salvo
          </span>
        ) : null}
      </div>
      {aberto ? (
        <>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={salvar}
            rows={4}
            maxLength={5000}
            aria-label="Notas do item"
            className="w-full resize-y rounded-control border border-control bg-ground p-2 font-mono text-[13px] leading-snug text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand"
          />
          {erro ? (
            <p role="alert" className="text-xs text-negative">
              {erro}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

interface Props {
  dado: ItemPipeline;
  agoraInicial: number;
  arrastavel: boolean;
  arrastando: boolean;
  aoIniciarArraste: (id: string) => void;
  aoTerminarArraste: () => void;
  aoMover: (id: string, etapa: EtapaId) => void;
  aoRemover: (id: string) => void;
}

export function CardItem({
  dado,
  agoraInicial,
  arrastavel,
  arrastando,
  aoIniciarArraste,
  aoTerminarArraste,
  aoMover,
  aoRemover,
}: Props) {
  const { item } = dado;
  const [confirmando, setConfirmando] = useState(false);
  const [notasAbertas, setNotasAbertas] = useState(false);
  const titulo = useMemo(() => resumirObjeto(item.objeto), [item.objeto]);
  const tituloCurto = titulo.length > 90 ? `${titulo.slice(0, 89)}…` : titulo;
  const pncp = item.linkPncp;

  return (
    <li
      draggable={arrastavel && !notasAbertas && !confirmando}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", dado.id);
        e.dataTransfer.effectAllowed = "move";
        aoIniciarArraste(dado.id);
      }}
      onDragEnd={aoTerminarArraste}
      className={cn(
        "flex flex-col gap-2 rounded-card border border-border bg-surface p-3",
        arrastavel && !notasAbertas && !confirmando ? "cursor-grab active:cursor-grabbing" : "",
        arrastando ? "opacity-40" : "",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-mono text-base font-medium tabular-nums",
              COR_FAIXA[item.score.faixa],
            )}
          >
            {item.score.total}
          </span>
          <Prazo encerramentoIso={item.dataEncerramento} agoraInicial={agoraInicial} />
        </span>
        <span className="flex items-center gap-1">
          <Link
            href={`/licitacao/${item.orgaoCnpj}/${item.anoCompra}/${item.sequencialCompra}`}
            className="inline-flex h-11 items-center rounded-control px-2 text-[13px] font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand lg:h-8"
          >
            Abrir
          </Link>
          <MenuAcoes
            etapa={dado.etapa}
            itemId={dado.id}
            linkPncp={pncp}
            aoMover={(etapa) => aoMover(dado.id, etapa)}
            aoPedirRemocao={() => setConfirmando(true)}
          />
        </span>
      </div>

      <p className="line-clamp-3 text-sm font-medium leading-snug text-ink">{titulo}</p>

      <p className="text-[13px] leading-snug text-muted-foreground">
        {item.municipio} ·{" "}
        <span className="font-mono tabular-nums">
          {item.valorEstimado === null ? "—" : formatarReais(item.valorEstimado)}
        </span>
      </p>

      <Notas id={dado.id} inicial={dado.notas} aoAbrir={setNotasAbertas} />

      {confirmando ? (
        <div role="group" aria-label="Confirmar remoção" className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="text-[13px] leading-snug text-ink">
            Remover “{tituloCurto}” do pipeline?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => aoRemover(dado.id)}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-control bg-negative px-3 text-sm font-medium text-ground outline-none focus-visible:ring-2 focus-visible:ring-brand lg:h-9"
            >
              Remover
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-control border border-control px-3 text-sm text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand lg:h-9"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 lg:hidden">
          <SeletorEtapa valor={dado.etapa} aoMudar={(etapa) => aoMover(dado.id, etapa)} />
          <div className="grid grid-cols-3 gap-2">
            <Link href={`/calculadora?item=${encodeURIComponent(dado.id)}`} className={BOTAO_SECUNDARIO}>
              Cotar
            </Link>
            <a href={pncp} target="_blank" rel="noopener noreferrer" className={BOTAO_SECUNDARIO}>
              PNCP
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className={cn(BOTAO_SECUNDARIO, "text-negative")}
            >
              Remover
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
