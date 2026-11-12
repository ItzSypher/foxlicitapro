"use client";

export default function ErroPropostas({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <h1 className="text-[22px] font-semibold leading-tight text-ink">Propostas</h1>
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-card border border-dashed border-control px-6 py-12 text-center"
      >
        <p className="text-sm text-ink">Não foi possível abrir as propostas agora.</p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center rounded-control px-3 text-sm font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
        >
          Tentar de novo
        </button>
      </div>
    </div>
  );
}
