import Link from "next/link";

export default function LicitacaoNaoEncontrada() {
  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <h1 className="text-[22px] leading-tight font-semibold text-ink">Licitação não encontrada</h1>
      <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-control px-6 py-12 text-center">
        <p className="text-sm text-ink">Essa contratação não existe no PNCP ou o endereço está errado.</p>
        <Link
          href="/radar"
          className="inline-flex h-11 items-center rounded-control px-3 text-sm font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
        >
          Voltar ao Radar
        </Link>
      </div>
    </div>
  );
}
