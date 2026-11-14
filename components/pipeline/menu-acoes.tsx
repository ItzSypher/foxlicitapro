"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, EllipsisVertical } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { CLASSE_FOLHA, useColunas } from "./midia";
import { SeletorEtapa } from "./seletor-etapa";
import { ETAPAS, type EtapaId } from "./tipos";

const LARGURA_MENU = 224;

const ITEM =
  "flex h-9 w-full items-center rounded-control px-3 text-left text-sm text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand";

const ITEM_FOLHA =
  "flex h-12 w-full items-center gap-3 rounded-control px-3 text-left text-sm text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-default disabled:text-muted-foreground disabled:hover:bg-transparent";

const ROTULO_SECAO = "px-3 pt-2 pb-1 text-xs font-medium tracking-[0.08em] text-faint uppercase";

/**
 * Menu de ações do card. No celular abre uma folha embaixo com as etapas e os atalhos (nada depende de
 * arrastar); a partir de md, um menu de três pontos com posição fixa para não ser cortado pela rolagem da coluna.
 */
export function MenuAcoes({
  etapa,
  itemId,
  linkPncp,
  titulo,
  podeEditar,
  aoMover,
  aoPedirRemocao,
}: {
  etapa: EtapaId;
  itemId: string;
  linkPncp: string;
  titulo: string;
  podeEditar: boolean;
  aoMover: (etapa: EtapaId) => void;
  aoPedirRemocao: () => void;
}) {
  const colunas = useColunas();
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  function alternar() {
    if (aberto) {
      setAberto(false);
      return;
    }
    const r = botao.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ top: r.bottom + 4, left: Math.max(8, r.right - LARGURA_MENU) });
    setAberto(true);
  }

  useEffect(() => {
    if (!aberto || !colunas) return;
    const fechar = () => setAberto(false);
    const fora = (e: PointerEvent) => {
      const alvo = e.target;
      if (!(alvo instanceof Node)) return;
      if (menu.current?.contains(alvo) || botao.current?.contains(alvo)) return;
      setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAberto(false);
      botao.current?.focus();
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    window.addEventListener("resize", fechar);
    document.addEventListener("scroll", fechar, true);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("resize", fechar);
      document.removeEventListener("scroll", fechar, true);
    };
  }, [aberto, colunas]);

  const botaoGatilho = (
    <button
      ref={botao}
      type="button"
      onClick={alternar}
      aria-haspopup={colunas ? "menu" : "dialog"}
      aria-expanded={aberto}
      aria-label="Ações do item"
      className="inline-flex size-11 items-center justify-center rounded-control text-muted-foreground outline-none hover:bg-active hover:text-ink focus-visible:ring-2 focus-visible:ring-brand md:size-8"
    >
      <EllipsisVertical aria-hidden="true" className="size-5 md:size-4" />
    </button>
  );

  if (!colunas) {
    const cotar = `/calculadora?item=${encodeURIComponent(itemId)}`;
    return (
      <>
        {botaoGatilho}
        <Sheet open={aberto} onOpenChange={setAberto}>
          <SheetContent side="bottom" className={CLASSE_FOLHA}>
            <SheetHeader className="pr-14">
              <SheetTitle>Ações do item</SheetTitle>
              <SheetDescription className="line-clamp-2">{titulo}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-0.5 px-2 pb-3">
              {podeEditar ? (
                <>
                  <p className={ROTULO_SECAO}>Mover para</p>
                  {ETAPAS.map((e) => {
                    const atual = e.id === etapa;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        disabled={atual}
                        aria-current={atual ? "true" : undefined}
                        onClick={() => {
                          setAberto(false);
                          aoMover(e.id);
                        }}
                        className={cn(ITEM_FOLHA, atual ? "bg-active" : "")}
                      >
                        <span className="flex-1">{e.rotulo}</span>
                        {atual ? (
                          <>
                            <Check aria-hidden="true" className="size-4 text-ink" />
                            <span className="sr-only">Etapa atual</span>
                          </>
                        ) : null}
                      </button>
                    );
                  })}
                </>
              ) : null}
              <p className={ROTULO_SECAO}>Atalhos</p>
              <Link href={cotar} onClick={() => setAberto(false)} className={ITEM_FOLHA}>
                Cotar
              </Link>
              <a
                href={linkPncp}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setAberto(false)}
                className={ITEM_FOLHA}
              >
                PNCP
              </a>
              {podeEditar ? (
                <button
                  type="button"
                  onClick={() => {
                    setAberto(false);
                    aoPedirRemocao();
                  }}
                  className={cn(ITEM_FOLHA, "text-negative")}
                >
                  Remover
                </button>
              ) : null}
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <div>
      {botaoGatilho}
      {aberto ? (
        <div
          ref={menu}
          role="menu"
          style={{ position: "fixed", top: pos.top, left: pos.left, width: LARGURA_MENU }}
          className="z-50 flex flex-col gap-1 rounded-card border border-control bg-raised p-1"
        >
          {podeEditar ? (
            <SeletorEtapa
              valor={etapa}
              aoMudar={(nova) => {
                setAberto(false);
                aoMover(nova);
              }}
            />
          ) : null}
          <Link role="menuitem" href={`/calculadora?item=${encodeURIComponent(itemId)}`} className={ITEM}>
            Cotar
          </Link>
          <a
            role="menuitem"
            href={linkPncp}
            target="_blank"
            rel="noopener noreferrer"
            className={ITEM}
          >
            PNCP
          </a>
          {podeEditar ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAberto(false);
                aoPedirRemocao();
              }}
              className={`${ITEM} text-negative`}
            >
              Remover
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
