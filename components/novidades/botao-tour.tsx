"use client";

import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EVENTO_ABRIR_TOUR } from "@/lib/novidades";
import { cn } from "@/lib/utils";

/** Abre o tour do sistema (quem escuta o evento é o componente Novidades). */
export function BotaoTour({ className, aoAbrir }: { className?: string; aoAbrir?: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => {
        aoAbrir?.();
        // Dá tempo de fechar uma folha aberta antes de abrir o tour.
        window.setTimeout(() => window.dispatchEvent(new Event(EVENTO_ABRIR_TOUR)), aoAbrir ? 200 : 0);
      }}
      className={cn("h-10 w-full justify-start gap-3 px-3 text-sm font-normal text-muted-foreground", className)}
    >
      <Compass className="size-[18px]" aria-hidden="true" />
      Tour do sistema
    </Button>
  );
}
