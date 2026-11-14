import { Marca } from "@/components/marca";

/**
 * Raposa centralizada que respira (só transform e opacity; parada com prefers-reduced-motion).
 * Serve de preloader na troca de rota; `rotulo` é lido por leitores de tela.
 */
export function Preloader({ rotulo = "Carregando" }: { rotulo?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[calc(100dvh-10rem)] items-center justify-center"
    >
      <Marca className="raposa-respira size-16" />
      <span className="sr-only">{rotulo}</span>
    </div>
  );
}
