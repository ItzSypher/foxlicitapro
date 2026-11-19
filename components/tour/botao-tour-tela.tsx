"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EVENTO_TOUR_TELA, rotaDoCaminho } from "./logica";

/** "Ver tour desta tela": só aparece nas telas que têm roteiro. */
export function BotaoTourTela({ caminho, className, aoAbrir }: { caminho: string; className?: string; aoAbrir?: () => void }) {
  if (rotaDoCaminho(caminho) === null) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => {
        aoAbrir?.();
        // Dá tempo de fechar uma folha aberta antes de abrir o tour.
        window.setTimeout(() => window.dispatchEvent(new Event(EVENTO_TOUR_TELA)), aoAbrir ? 250 : 0);
      }}
      className={cn("h-10 w-full justify-start gap-3 px-3 text-sm font-normal text-muted-foreground", className)}
    >
      <CircleHelp className="size-[18px]" aria-hidden="true" />
      Ver tour desta tela
    </Button>
  );
}

function ComCaminho({ className }: { className?: string }) {
  return <BotaoTourTela caminho={usePathname()} className={className} />;
}

/** Versão que lê o caminho sozinha, para a barra lateral. */
export function BotaoTourTelaAuto({ className }: { className?: string }) {
  return (
    <Suspense fallback={null}>
      <ComCaminho className={className} />
    </Suspense>
  );
}
