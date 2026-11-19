"use client";

import { Fragment, useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { z } from "zod";
import { listarAvisosAction, marcarAvisoLidoAction, marcarTodosLidosAction, type RespostaAvisos } from "@/app/(app)/avisos-actions";
import { ListaEscalonada } from "@/components/ui/movimento";
import { Toast, type DadosToast } from "@/components/ui/toast";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { AvisoPainel } from "@/db/avisos";
import { cn } from "@/lib/utils";
import { IconeAviso } from "./icone-aviso";

const formatoData = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function quando(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? "" : formatoData.format(data);
}

interface Props {
  /** Avisos não lidos na hora em que a página foi montada */
  inicial: number;
  /** "baixo": folha inferior (celular). "lado": folha lateral (barra lateral). */
  folha: "baixo" | "lado";
  className?: string;
}

const INTERVALO_MS = 120_000;

const respostaSchema = z.object({
  naoLidos: z.number().int().min(0),
  itens: z.array(z.object({ id: z.string(), titulo: z.string(), link: z.string().nullable() })),
});

export function SinoAvisos({ inicial, folha, className }: Props) {
  const [aberto, setAberto] = useState(false);
  const [naoLidos, setNaoLidos] = useState(inicial);
  const [itens, setItens] = useState<AvisoPainel[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const [pop, setPop] = useState(0);
  const [toast, setToast] = useState<DadosToast | null>(null);
  const reduzir = useReducedMotion();
  const botao = useRef<HTMLButtonElement>(null);
  const atual = useRef(inicial);
  const ultimaConsulta = useRef(0);
  const fecharToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    atual.current = naoLidos;
  }, [naoLidos]);

  // Consulta leve a cada 2 min, só com a aba visível e só na instância que aparece na tela (há uma na lateral e outra no topo).
  useEffect(() => {
    let ativo = true;
    async function consultar() {
      if (document.visibilityState !== "visible" || botao.current?.offsetParent == null) return;
      ultimaConsulta.current = Date.now();
      try {
        const resposta = await fetch("/api/novidades", { cache: "no-store" });
        if (!resposta.ok) return;
        const dados = respostaSchema.safeParse(await resposta.json());
        if (!ativo || !dados.success) return;
        const novo = dados.data.naoLidos;
        const antes = atual.current;
        atual.current = novo;
        setNaoLidos(novo);
        if (novo > antes) {
          setPop((p) => p + 1);
          const diferenca = novo - antes;
          const recente = dados.data.itens[0];
          setToast({
            id: `${Date.now()}`,
            texto: diferenca === 1 && recente ? recente.titulo : `${diferenca} avisos novos`,
            link: diferenca === 1 && recente ? recente.link : null,
          });
        }
      } catch {
        // Sem rede por um momento: a próxima consulta tenta de novo.
      }
    }
    const timer = window.setInterval(consultar, INTERVALO_MS);
    function aoVoltar() {
      if (document.visibilityState === "visible" && Date.now() - ultimaConsulta.current >= INTERVALO_MS) void consultar();
    }
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      ativo = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, []);

  function aplicar(r: RespostaAvisos) {
    if (r.ok) {
      setItens(r.itens);
      setNaoLidos(r.naoLidos);
      setErro(null);
    } else {
      setErro(r.erro);
    }
  }

  function abrir(valor: boolean) {
    setAberto(valor);
    if (valor) iniciar(async () => aplicar(await listarAvisosAction()));
  }

  function lido(id: string) {
    iniciar(async () => aplicar(await marcarAvisoLidoAction(id)));
  }

  function todosLidos() {
    iniciar(async () => aplicar(await marcarTodosLidosAction()));
  }

  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={() => abrir(true)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={naoLidos > 0 ? `Avisos: ${naoLidos} não lidos` : "Avisos"}
        className={cn(
          "relative inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted-foreground outline-none hover:bg-raised hover:text-ink focus-visible:ring-2 focus-visible:ring-brand",
          className,
        )}
      >
        <Bell className="size-[18px]" aria-hidden="true" />
        {naoLidos > 0 ? (
          <motion.span
            key={pop}
            aria-hidden="true"
            initial={pop === 0 || reduzir ? false : { scale: 1.6 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 14 }}
            className="absolute top-1 right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-fill px-1 text-[10px] font-medium tabular-nums text-black"
          >
            {naoLidos > 99 ? "99+" : naoLidos}
          </motion.span>
        ) : null}
      </button>

      <Toast toast={toast} aoFechar={fecharToast} />

      <Sheet open={aberto} onOpenChange={abrir}>
        <SheetContent
          side={folha === "baixo" ? "bottom" : "right"}
          className="gap-0 data-[side=bottom]:h-auto data-[side=bottom]:max-h-[85dvh] data-[side=bottom]:rounded-t-card data-[side=bottom]:border-t"
        >
          <SheetHeader className="pr-14">
            <SheetTitle>Avisos</SheetTitle>
            <SheetDescription>{naoLidos > 0 ? `${naoLidos} ${naoLidos === 1 ? "não lido" : "não lidos"}` : "Tudo em dia"}</SheetDescription>
          </SheetHeader>

          <div className="flex items-center justify-end px-4 pb-2">
            <button
              type="button"
              onClick={todosLidos}
              disabled={pendente || naoLidos === 0}
              className="inline-flex h-11 items-center gap-2 rounded-control px-3 text-sm text-ink outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-40"
            >
              <CheckCheck className="size-4" aria-hidden="true" />
              Marcar todos como lidos
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {erro ? (
              <p role="alert" className="py-3 text-[13px] text-negative">
                {erro}
              </p>
            ) : null}
            {itens === null && erro === null ? <p className="py-6 text-sm text-muted-foreground">Carregando…</p> : null}
            {itens !== null && itens.length === 0 ? <p className="py-6 text-sm text-muted-foreground">Nenhum aviso por enquanto.</p> : null}
            {itens !== null && itens.length > 0 ? (
              <ListaEscalonada as="ul" className="flex flex-col divide-y divide-border" classeItem="flex items-start gap-3 py-3">
                {itens.map((a) => (
                  <Fragment key={a.id}>
                    <span className={cn("flex shrink-0", a.lido ? "opacity-50" : "")}>
                      <IconeAviso tipo={a.tipo} />
                    </span>
                    <div className="min-w-0 flex-1">
                      {a.link ? (
                        <Link
                          href={a.link}
                          {...(/^https?:\/\//i.test(a.link) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                          onClick={() => {
                            if (!a.lido) lido(a.id);
                            setAberto(false);
                          }}
                          className="block rounded-control outline-none focus-visible:ring-2 focus-visible:ring-brand"
                        >
                          <TextoAviso aviso={a} />
                        </Link>
                      ) : (
                        <TextoAviso aviso={a} />
                      )}
                    </div>
                    {a.lido ? null : (
                      <button
                        type="button"
                        onClick={() => lido(a.id)}
                        disabled={pendente}
                        aria-label={`Marcar como lido: ${a.titulo}`}
                        className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted-foreground outline-none hover:bg-raised hover:text-ink focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40"
                      >
                        <CheckCheck className="size-4" aria-hidden="true" />
                      </button>
                    )}
                  </Fragment>
                ))}
              </ListaEscalonada>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function TextoAviso({ aviso }: { aviso: AvisoPainel }) {
  return (
    <>
      <span className={cn("block text-sm text-ink", aviso.lido ? "" : "font-medium")}>{aviso.titulo}</span>
      {aviso.corpo ? <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{aviso.corpo}</span> : null}
      <span className="mt-1 block text-xs text-faint">{quando(aviso.criadoEm)}</span>
    </>
  );
}
