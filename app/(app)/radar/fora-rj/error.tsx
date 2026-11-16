"use client";

import { EstadoErro } from "@/components/radar/estados";

export default function ErroForaRj({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <h1 className="text-[22px] font-semibold leading-tight text-ink">Fora do RJ</h1>
      <EstadoErro aoTentar={reset} />
    </div>
  );
}
