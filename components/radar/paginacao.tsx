"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { itensPaginacao } from "@/lib/radar-filtros";
import { cn } from "@/lib/utils";

const BASE_BOTAO =
  "inline-flex h-11 shrink-0 items-center justify-center gap-1 rounded-control border px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-40 md:h-9";

interface Props {
  pagina: number;
  totalPaginas: number;
  inicio: number;
  fim: number;
  total: number;
  onIr: (pagina: number) => void;
}

/** "1–12 de 880" e os controles. No telefone: "Anterior · 2 de 37 · Próxima". */
export function Paginacao({ pagina, totalPaginas, inicio, fim, total, onIr }: Props) {
  const anterior = pagina > 1;
  const proxima = pagina < totalPaginas;

  return (
    <nav
      aria-label="Paginação"
      className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
    >
      <p className="text-center text-[13px] text-muted-foreground md:text-left md:text-sm">
        <span className="font-mono tabular-nums">
          {inicio}–{fim}
        </span>{" "}
        de <span className="font-mono tabular-nums">{total}</span>
      </p>

      {totalPaginas > 1 ? (
        <>
          <div className="flex items-center justify-between gap-2 md:hidden">
            <button
              type="button"
              disabled={!anterior}
              onClick={() => onIr(pagina - 1)}
              className={cn(BASE_BOTAO, "min-w-28 border-border bg-surface text-ink hover:bg-raised")}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Anterior
            </button>
            <span className="font-mono text-sm tabular-nums text-muted-foreground">
              {pagina} de {totalPaginas}
            </span>
            <button
              type="button"
              disabled={!proxima}
              onClick={() => onIr(pagina + 1)}
              className={cn(BASE_BOTAO, "min-w-28 border-border bg-surface text-ink hover:bg-raised")}
            >
              Próxima
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>

          <ul className="hidden items-center gap-1 md:flex">
            <li>
              <button
                type="button"
                disabled={!anterior}
                onClick={() => onIr(pagina - 1)}
                className={cn(BASE_BOTAO, "border-transparent text-ink hover:bg-raised")}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                Anterior
              </button>
            </li>
            {itensPaginacao(pagina, totalPaginas).map((item) =>
              typeof item === "number" ? (
                <li key={item}>
                  <button
                    type="button"
                    aria-current={item === pagina ? "page" : undefined}
                    aria-label={`Página ${item}`}
                    onClick={() => onIr(item)}
                    className={cn(
                      BASE_BOTAO,
                      "min-w-9 px-2 font-mono tabular-nums",
                      item === pagina
                        ? "border-control bg-active font-semibold text-ink"
                        : "border-transparent text-muted-foreground hover:bg-raised hover:text-ink",
                    )}
                  >
                    {item}
                  </button>
                </li>
              ) : (
                <li key={item} aria-hidden="true" className="px-1 text-muted-foreground">
                  …
                </li>
              ),
            )}
            <li>
              <button
                type="button"
                disabled={!proxima}
                onClick={() => onIr(pagina + 1)}
                className={cn(BASE_BOTAO, "border-transparent text-ink hover:bg-raised")}
              >
                Próxima
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </>
      ) : null}
    </nav>
  );
}
