"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function BlocoErro({ aoTentar }: { aoTentar?: () => void }) {
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
      <p className="text-sm text-ink">Não foi possível carregar o pipeline agora.</p>
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
