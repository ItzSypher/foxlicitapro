"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { montarComAssistenteAction } from "@/app/(app)/propostas/assistente-actions";

const SECUNDARIO =
  "inline-flex h-11 items-center justify-center gap-2 rounded-control border border-control bg-transparent px-4 text-sm font-medium whitespace-nowrap text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand md:h-9";

/** "Montar com o assistente": a análise leva até 1 minuto; ao terminar, abre a proposta criada. */
export function BotaoAssistente({ compra }: { compra: string }) {
  const router = useRouter();
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function montar() {
    setErro(null);
    setLendo(true);
    try {
      const r = await montarComAssistenteAction(compra);
      if (r.ok) {
        router.push(`/propostas/${r.propostaId}`);
        return;
      }
      setErro(r.erro);
    } catch {
      setErro("Não foi possível montar a proposta agora.");
    }
    setLendo(false);
  }

  if (lendo) {
    return (
      <p role="status" className="inline-flex h-11 items-center gap-2 text-sm text-muted-foreground md:h-9">
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        Lendo o edital e os itens…
      </p>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <button type="button" onClick={montar} className={SECUNDARIO}>
        <Image src="/raposa.svg" alt="" width={249} height={254} unoptimized className="h-[18px] w-auto shrink-0" />
        {erro ? "Tentar de novo" : "Montar com o assistente"}
      </button>
      {erro ? (
        <p role="alert" className="text-xs text-negative">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
