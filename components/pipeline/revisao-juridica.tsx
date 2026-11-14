"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { marcarPassoJuridicoAction } from "@/app/(app)/pipeline/actions";
import { PASSOS_JURIDICOS, checklistCompleto, okJuridico, type MarcaJuridica, type PassoJuridicoId } from "@/core/revisao-juridica";
import { cn } from "@/lib/utils";

const dataFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
  hourCycle: "h23",
});

function quando(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : dataFmt.format(d);
}

/**
 * Checklist jurídico do card (aberto numa folha) na etapa "Revisão jurídica". Só quem tem a permissão marca;
 * os demais veem. Sair da etapa para frente exige tudo marcado (o servidor confere).
 */
export function RevisaoJuridica({ itemId, inicial, podeMarcar }: { itemId: string; inicial: MarcaJuridica[]; podeMarcar: boolean }) {
  const [marcas, setMarcas] = useState<MarcaJuridica[]>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const ok = okJuridico(marcas);

  function alternar(passo: PassoJuridicoId, marcar: boolean) {
    setErro(null);
    iniciar(async () => {
      const r = await marcarPassoJuridicoAction(itemId, passo, marcar);
      if (r.ok) setMarcas(r.marcas);
      else setErro(r.erro);
    });
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-1" disabled={ocupado}>
      <legend className="sr-only">Revisão jurídica</legend>
      {PASSOS_JURIDICOS.map((p) => {
        const marca = marcas.find((m) => m.passo === p.id);
        const feito = marca !== undefined;
        return (
          <button
            key={p.id}
            type="button"
            role="checkbox"
            aria-checked={feito}
            disabled={!podeMarcar}
            onClick={() => alternar(p.id, !feito)}
            className="flex min-h-12 items-center gap-3 rounded-control px-2 text-left text-sm text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-default disabled:hover:bg-transparent"
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-sm border",
                feito ? "border-transparent bg-brand-fill text-black" : "border-control bg-raised",
              )}
            >
              {feito ? <Check className="size-4" /> : null}
            </span>
            <span className="min-w-0">
              <span className="block leading-snug">{p.rotulo}</span>
              {marca ? (
                <span className="block text-xs text-muted-foreground">
                  {marca.porNome ?? "Equipe"} · {quando(marca.em)}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
      {checklistCompleto(marcas) && ok ? (
        <p role="status" className="px-2 pt-1 text-[13px] font-medium text-positive">
          Ok jurídico por {ok.porNome ?? "equipe"} em {quando(ok.em)}
        </p>
      ) : (
        <p className="px-2 pt-1 text-xs text-muted-foreground">
          {podeMarcar ? "Marque tudo para liberar a saída desta etapa." : "Só quem tem permissão de revisão jurídica marca."}
        </p>
      )}
      {erro ? (
        <p role="alert" className="px-2 text-xs text-negative">
          {erro}
        </p>
      ) : null}
    </fieldset>
  );
}
