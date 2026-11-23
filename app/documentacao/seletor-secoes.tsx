"use client";

import { useEffect, useState } from "react";
import { Cog, Compass, ListChecks, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const ABAS = [
  { id: "visao-geral", rotulo: "Visão geral", icone: Compass },
  { id: "logica", rotulo: "Lógica", icone: Cog },
  { id: "operacao", rotulo: "Operação", icone: ListChecks },
  { id: "tecnica", rotulo: "Técnica", icone: Lock },
] as const;

function prefereMenosMovimento(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Seletor fixo no topo: rola até a seção e marca a que está à vista. */
export function SeletorSecoes() {
  const [ativa, definirAtiva] = useState<string>(ABAS[0].id);

  useEffect(() => {
    const secoes = ABAS.map((a) => document.getElementById(a.id)).filter((el): el is HTMLElement => el !== null);
    const observador = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visivel) definirAtiva(visivel.target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    secoes.forEach((s) => observador.observe(s));
    return () => observador.disconnect();
  }, []);

  function irPara(evento: React.MouseEvent<HTMLAnchorElement>, id: string) {
    const alvo = document.getElementById(id);
    if (!alvo) return;
    evento.preventDefault();
    alvo.scrollIntoView({ behavior: prefereMenosMovimento() ? "auto" : "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
    definirAtiva(id);
  }

  return (
    <nav aria-label="Seções da documentação" className="sticky top-0 z-20 border-b border-border bg-ground/90 backdrop-blur">
      <ul className="mx-auto flex w-full max-w-5xl gap-1.5 overflow-x-auto px-4 py-2.5 sm:px-6">
        {ABAS.map((aba) => {
          const Icone = aba.icone;
          const marcada = ativa === aba.id;
          return (
            <li key={aba.id} className="shrink-0">
              <a
                href={`#${aba.id}`}
                onClick={(e) => irPara(e, aba.id)}
                aria-current={marcada ? "true" : undefined}
                className={cn(
                  "flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  marcada ? "bg-active font-medium text-ink" : "text-muted-foreground hover:bg-raised hover:text-ink",
                )}
              >
                <Icone className="size-4" aria-hidden="true" />
                {aba.rotulo}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
