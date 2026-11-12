"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

export function EstadoVazio({
  frase,
  onLimpar,
  rotuloAcao = "Ver todo o RJ",
}: {
  frase: string;
  onLimpar?: () => void;
  rotuloAcao?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-control px-6 py-12 text-center">
      <p className="text-sm text-muted-foreground">{frase}</p>
      {onLimpar ? (
        <button
          type="button"
          onClick={onLimpar}
          className="inline-flex h-11 items-center rounded-control px-3 text-sm font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand md:h-9"
        >
          {rotuloAcao}
        </button>
      ) : null}
    </div>
  );
}

export function EstadoErro({ aoTentar }: { aoTentar?: () => void }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  function tentarDeNovo() {
    if (aoTentar) {
      aoTentar();
      return;
    }
    iniciar(() => router.refresh());
  }

  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-card border border-dashed border-control px-6 py-12 text-center"
    >
      <p className="text-sm text-ink">Não foi possível carregar as oportunidades agora.</p>
      <button
        type="button"
        onClick={tentarDeNovo}
        disabled={pendente}
        className="inline-flex h-11 items-center rounded-control px-3 text-sm font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 md:h-9"
      >
        {pendente ? "Tentando…" : "Tentar de novo"}
      </button>
    </div>
  );
}

export function AvisoFalhaParcial({ texto }: { texto: string }) {
  return (
    <p
      role="status"
      className="rounded-control border border-border bg-pill-warn-bg px-3 py-2 text-sm text-pill-warn-fg"
    >
      {texto}
    </p>
  );
}

/** Esqueleto no formato do card: barras planas, sem brilho animado. */
export function CardEsqueleto() {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-[188px] flex-col gap-3 rounded-card border border-border bg-surface p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-7 w-10" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <Skeleton className="h-3.5 w-2/3" />
      <Skeleton className="mt-auto h-1.5 w-full" />
    </div>
  );
}
