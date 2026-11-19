"use client";

import { MS_DIA } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { usePrazo } from "./prazo";

/** Publicada há menos de 24 h (com 1 h de folga para o relógio do órgão). */
export function ehNova(dataPublicacao: string | null | undefined, agora: number): boolean {
  const idade = agora - Date.parse(dataPublicacao ?? "");
  return !Number.isNaN(idade) && idade >= -3_600_000 && idade < MS_DIA;
}

/** Ponto com um anel que se abre devagar. Sem movimento no aparelho, fica só o ponto. */
function PontoVivo({ className }: { className: string }) {
  return (
    <span aria-hidden="true" className="relative flex size-2 shrink-0">
      <span
        className={cn(
          "absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-[ping_2.4s_cubic-bezier(0,0,0.2,1)_infinite]",
          className,
        )}
      />
      <span className={cn("relative inline-flex size-2 rounded-full", className)} />
    </span>
  );
}

const BASE = "inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs font-medium";

interface Props {
  dataPublicacao: string | null | undefined;
  dataEncerramento: string;
  agoraInicial: number;
  className?: string;
}

/** Selos do card: "Nova" (publicada nas últimas 24 h) e "Fecha hoje" (encerra em menos de 24 h). Sem nenhum dos dois, não renderiza. */
export function SelosVivos({ dataPublicacao, dataEncerramento, agoraInicial, className }: Props) {
  const { menosDe24h } = usePrazo(dataEncerramento, agoraInicial);
  const nova = ehNova(dataPublicacao, agoraInicial);
  if (!nova && !menosDe24h) return null;
  return (
    <span className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {nova ? (
        <span className={cn(BASE, "bg-pill-pos-bg text-pill-pos-fg")}>
          <PontoVivo className="bg-positive" />
          Nova
        </span>
      ) : null}
      {menosDe24h ? (
        <span className={cn(BASE, "bg-pill-warn-bg text-pill-warn-fg")}>
          <PontoVivo className="bg-warning" />
          Fecha hoje
        </span>
      ) : null}
    </span>
  );
}
