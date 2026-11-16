"use client";

import type { ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";

/**
 * Diálogo central no computador e folha de baixo no celular.
 * O foco fica preso dentro, Esc fecha e o leitor de tela recebe o título e a descrição.
 */
export function Dialogo({
  aberto,
  aoMudar,
  children,
  className,
  focoInicial,
}: {
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
  children: ReactNode;
  className?: string;
  focoInicial?: React.RefObject<HTMLElement | null>;
}) {
  return (
    <Dialog.Root open={aberto} onOpenChange={aoMudar}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none" />
        <Dialog.Popup
          initialFocus={focoInicial}
          className={cn(
            "fixed z-50 flex max-h-[88dvh] flex-col overflow-hidden border border-border bg-surface text-ink shadow-lg outline-none transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none",
            "inset-x-0 bottom-0 rounded-t-sheet border-b-0 pb-[env(safe-area-inset-bottom)]",
            "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[min(34rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-sheet sm:border-b sm:pb-0",
            className,
          )}
        >
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
