"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EllipsisVertical } from "lucide-react";
import { SeletorEtapa } from "./seletor-etapa";
import type { EtapaId } from "./tipos";

const LARGURA_MENU = 224;

const ITEM =
  "flex h-9 w-full items-center rounded-control px-3 text-left text-sm text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand";

/** Menu de três pontos (desktop). Posição fixa para não ser cortado pela rolagem da coluna. */
export function MenuAcoes({
  etapa,
  itemId,
  linkPncp,
  aoMover,
  aoPedirRemocao,
}: {
  etapa: EtapaId;
  itemId: string;
  linkPncp: string;
  aoMover: (etapa: EtapaId) => void;
  aoPedirRemocao: () => void;
}) {
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
    if (!aberto) return;
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
  }, [aberto]);

  return (
    <div className="hidden lg:block">
      <button
        ref={botao}
        type="button"
        onClick={alternar}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label="Ações do item"
        className="inline-flex size-8 items-center justify-center rounded-control text-muted-foreground outline-none hover:bg-active hover:text-ink focus-visible:ring-2 focus-visible:ring-brand"
      >
        <EllipsisVertical aria-hidden="true" className="size-4" />
      </button>
      {aberto ? (
        <div
          ref={menu}
          role="menu"
          style={{ position: "fixed", top: pos.top, left: pos.left, width: LARGURA_MENU }}
          className="z-50 flex flex-col gap-1 rounded-card border border-control bg-raised p-1"
        >
          <SeletorEtapa
            valor={etapa}
            aoMudar={(nova) => {
              setAberto(false);
              aoMover(nova);
            }}
          />
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
        </div>
      ) : null}
    </div>
  );
}
