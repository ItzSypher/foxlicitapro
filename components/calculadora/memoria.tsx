"use client";

import { useState, useSyncExternalStore } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { CalculoPrecificacao } from "@/core/precificacao";
import type { Frente } from "@/core/types";
import { cn } from "@/lib/utils";
import { LINK_PGMEI, formatarValorMemoria, impostoEmPalavras } from "./texto";

const CONSULTA_DESKTOP = "(min-width: 1024px)";

function assinarDesktop(aviso: () => void): () => void {
  const lista = window.matchMedia(CONSULTA_DESKTOP);
  lista.addEventListener("change", aviso);
  return () => lista.removeEventListener("change", aviso);
}

function lerDesktop(): boolean {
  return window.matchMedia(CONSULTA_DESKTOP).matches;
}

function lerServidor(): boolean {
  return false;
}

interface Props {
  calculo: CalculoPrecificacao;
  frente: Frente;
  vendas: number;
}

export function Memoria({ calculo, frente, vendas }: Props) {
  const desktop = useSyncExternalStore(assinarDesktop, lerDesktop, lerServidor);
  const [escolha, setEscolha] = useState<boolean | null>(null);
  const aberto = escolha ?? desktop;
  const frases = impostoEmPalavras(calculo, frente, vendas);

  return (
    <section aria-label="Como chegamos nesse número" className="rounded-card border border-border bg-surface">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls="memoria-calculo"
        onClick={() => setEscolha(!aberto)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-card px-4 py-3 text-left text-sm font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        Como chegamos nesse número
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground", aberto && "rotate-180")} aria-hidden />
      </button>

      <div id="memoria-calculo" hidden={!aberto} className="flex flex-col gap-4 border-t border-border p-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-medium text-muted-foreground">Imposto em palavras</h3>
          <p className="text-sm leading-relaxed text-ink">{frases.join(" ")}</p>
          {calculo.regime === "mei" && (
            <a
              href={LINK_PGMEI}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-8 items-center gap-1.5 self-start text-[13px] text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
            >
              Confira o valor do DAS no PGMEI
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
        </div>

        <table className="w-full border-collapse text-left text-[13px]">
          <caption className="sr-only">Memória de cálculo</caption>
          <thead className="sr-only sm:not-sr-only">
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">
                Etapa
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Conta
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Valor
              </th>
            </tr>
          </thead>
          <tbody className="block sm:table-row-group">
            {calculo.memoria.map((linha, i) => (
              <tr
                key={`${linha.rotulo}-${i}`}
                className="grid grid-cols-[1fr_auto] gap-x-3 border-b border-border py-2 last:border-b-0 sm:table-row"
              >
                <th
                  scope="row"
                  className="col-start-1 row-start-1 font-normal text-ink sm:table-cell sm:py-2 sm:pr-3 sm:align-top"
                >
                  {linha.rotulo}
                </th>
                <td className="col-span-2 row-start-2 text-muted-foreground sm:table-cell sm:py-2 sm:pr-3 sm:align-top">
                  {linha.formula}
                </td>
                <td className="col-start-2 row-start-1 text-right font-mono tabular-nums text-ink sm:table-cell sm:py-2 sm:align-top">
                  {formatarValorMemoria(linha.rotulo, linha.valor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
