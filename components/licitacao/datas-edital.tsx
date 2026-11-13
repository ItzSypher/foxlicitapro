"use client";

import { montarLinhaDoTempo, textoFaltam, type DatasDoDetalhe } from "@/core/datas-edital";
import { MS_DIA } from "@/lib/formato";
import { useAgora } from "@/lib/relogio";
import { cn } from "@/lib/utils";
import { Colapsavel } from "./colapsavel";

/**
 * Datas como no PNCP, em linha do tempo vertical. Sem dado, a linha não aparece.
 * O fim das propostas é também a disputa e mostra quanto falta.
 */
export function DatasEdital({ datas, agoraInicial }: { datas: DatasDoDetalhe; agoraInicial: number }) {
  const fim = datas.dataEncerramento === null ? Number.NaN : Date.parse(datas.dataEncerramento);
  const agora = useAgora(Number.isNaN(fim) ? null : fim, agoraInicial);
  const eventos = montarLinhaDoTempo(datas, agora);
  const faltam = datas.dataEncerramento === null ? null : textoFaltam(datas.dataEncerramento, agora);
  const urgente = !Number.isNaN(fim) && fim - agora > 0 && fim - agora < MS_DIA;

  const resumo = faltam === null ? null : <span className={cn(urgente ? "font-medium text-negative" : "")}>{faltam === "encerrado" ? "Disputa encerrada" : `Disputa: ${faltam}`}</span>;

  return (
    <Colapsavel id="datas" titulo="Datas" aberta resumo={resumo}>
      {eventos.length === 0 ? (
        <p className="text-sm text-muted-foreground">O PNCP não informou datas para esta contratação.</p>
      ) : (
        <ol className="flex flex-col">
          {eventos.map((e, i) => {
            const ultimo = i === eventos.length - 1;
            const proximo = !e.passou && eventos.slice(0, i).every((a) => a.passou);
            return (
              <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
                {ultimo ? null : <span aria-hidden="true" className="absolute top-4 bottom-0 left-[5px] w-px bg-border" />}
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative mt-1 size-[11px] shrink-0 rounded-full border-2",
                    e.passou ? "border-faint bg-faint" : proximo ? "border-brand bg-brand" : "border-control bg-surface",
                  )}
                />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-xs text-muted-foreground">{e.rotulo}</p>
                  <p className="font-mono text-sm tabular-nums text-ink">{e.texto}</p>
                  {e.disputa && faltam !== null ? (
                    <p className={cn("text-[13px]", urgente ? "font-medium text-negative" : e.passou ? "text-muted-foreground" : "text-brand")}>
                      {faltam === "encerrado" ? "Recebimento encerrado" : faltam.charAt(0).toUpperCase() + faltam.slice(1)}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Colapsavel>
  );
}
