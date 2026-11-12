"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const SECOES: ReadonlyArray<{ id: string; rotulo: string }> = [
  { id: "resumo", rotulo: "Resumo" },
  { id: "sinais", rotulo: "Sinais" },
  { id: "itens", rotulo: "Itens" },
  { id: "arquivos", rotulo: "Arquivos" },
  { id: "texto", rotulo: "Texto" },
  { id: "nota", rotulo: "Nota" },
];

/** Seção que está sob o topo da janela, para destacar no índice. */
function useSecaoAtiva(): string {
  const [ativa, setAtiva] = useState<string>(SECOES[0].id);

  useEffect(() => {
    const visiveis = new Set<string>();
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) visiveis.add(e.target.id);
          else visiveis.delete(e.target.id);
        }
        const primeira = SECOES.find((s) => visiveis.has(s.id));
        if (primeira) setAtiva(primeira.id);
      },
      { rootMargin: "-120px 0px -55% 0px" },
    );
    for (const s of SECOES) {
      const el = document.getElementById(s.id);
      if (el) observador.observe(el);
    }
    return () => observador.disconnect();
  }, []);

  return ativa;
}

/** Telefone e tablet: chips rolláveis grudados sob a barra superior. */
export function ChipsSecoes() {
  const ativa = useSecaoAtiva();
  return (
    <nav
      aria-label="Seções da licitação"
      className="sticky top-[52px] z-20 -mx-4 overflow-x-auto border-b border-border bg-ground px-4 [scrollbar-width:none] lg:top-0 lg:-mx-8 lg:px-8 xl:hidden"
    >
      <ul className="flex w-max gap-1">
        {SECOES.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={ativa === s.id ? "true" : undefined}
              className={cn(
                "inline-flex h-11 items-center rounded-control px-3 text-sm whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-brand",
                ativa === s.id ? "font-medium text-brand" : "text-muted-foreground hover:text-ink",
              )}
            >
              {s.rotulo}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Desktop largo: índice fixo à direita. */
export function IndiceSecoes() {
  const ativa = useSecaoAtiva();
  return (
    <nav aria-label="Seções da licitação" className="sticky top-8 hidden self-start xl:block">
      <p className="px-3 pb-2 text-xs font-medium text-muted-foreground">Nesta página</p>
      <ul className="flex flex-col border-l border-border">
        {SECOES.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={ativa === s.id ? "true" : undefined}
              className={cn(
                "-ml-px flex h-9 items-center border-l px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand",
                ativa === s.id
                  ? "border-brand font-medium text-brand"
                  : "border-transparent text-muted-foreground hover:text-ink",
              )}
            >
              {s.rotulo}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
