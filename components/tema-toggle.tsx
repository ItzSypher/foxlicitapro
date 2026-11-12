"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function alternarTema() {
  const raiz = document.documentElement;
  const escuro = !raiz.classList.contains("dark");
  raiz.classList.toggle("dark", escuro);
  raiz.style.colorScheme = escuro ? "dark" : "light";
  document.cookie = `tema=${escuro ? "escuro" : "claro"}; path=/; max-age=31536000; samesite=lax`;
}

interface Props {
  /** "icone": só ícone com alvo de 44 px. "completo": ícone e texto na lateral. */
  modo: "icone" | "completo";
  className?: string;
}

export function TemaToggle({ modo, className }: Props) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={alternarTema}
      aria-label="Alternar entre tema claro e escuro"
      className={cn(
        modo === "icone" ? "size-11" : "h-10 w-full justify-start gap-3 px-3 text-sm font-normal text-muted-foreground",
        className,
      )}
    >
      <Sun className="hidden size-[18px] dark:block" aria-hidden="true" />
      <Moon className="size-[18px] dark:hidden" aria-hidden="true" />
      {modo === "completo" ? (
        <span>
          <span className="dark:hidden">Tema escuro</span>
          <span className="hidden dark:inline">Tema claro</span>
        </span>
      ) : null}
    </Button>
  );
}
