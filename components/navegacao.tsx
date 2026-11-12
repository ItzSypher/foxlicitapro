"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, Columns3, FileText, Radar, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Destino {
  href: string;
  rotulo: string;
  /** Rótulo da barra inferior, que precisa caber em 4 itens numa tela de 320 px */
  rotuloCurto: string;
  icone: LucideIcon;
  /** Outras áreas que mantêm este destino ativo (ex.: a tela de uma licitação conta como Radar) */
  subareas?: ReadonlyArray<string>;
}

const DESTINOS: ReadonlyArray<Destino> = [
  { href: "/radar", rotulo: "Radar", rotuloCurto: "Radar", icone: Radar, subareas: ["/licitacao"] },
  { href: "/pipeline", rotulo: "Pipeline", rotuloCurto: "Pipeline", icone: Columns3 },
  { href: "/propostas", rotulo: "Propostas", rotuloCurto: "Propostas", icone: FileText },
  { href: "/calculadora", rotulo: "Calculadora", rotuloCurto: "Calcular", icone: Calculator },
];

function estaAtivo(destino: Destino, caminho: string): boolean {
  return [destino.href, ...(destino.subareas ?? [])].some(
    (base) => caminho === base || caminho.startsWith(`${base}/`),
  );
}

function ItemLateral({ destino, caminho }: { destino: Destino; caminho: string }) {
  const ativo = estaAtivo(destino, caminho);
  const Icone = destino.icone;
  return (
    <Link
      href={destino.href}
      aria-current={ativo ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-3 rounded-control px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand",
        ativo ? "bg-active font-medium text-brand" : "text-muted-foreground hover:bg-raised hover:text-ink",
      )}
    >
      <Icone className="size-[18px]" aria-hidden="true" />
      {destino.rotulo}
    </Link>
  );
}

function ItemInferior({ destino, caminho }: { destino: Destino; caminho: string }) {
  const ativo = estaAtivo(destino, caminho);
  const Icone = destino.icone;
  return (
    <Link
      href={destino.href}
      aria-current={ativo ? "page" : undefined}
      className={cn(
        "flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-control px-0.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand",
        ativo ? "font-medium text-brand" : "text-muted-foreground",
      )}
    >
      <Icone className="size-5" aria-hidden="true" />
      <span className="max-w-full truncate">{destino.rotuloCurto}</span>
    </Link>
  );
}

function ListaLateral({ caminho }: { caminho: string }) {
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {DESTINOS.map((destino) => (
        <ItemLateral key={destino.href} destino={destino} caminho={caminho} />
      ))}
    </nav>
  );
}

function ListaInferior({ caminho }: { caminho: string }) {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-stretch gap-1 border-t border-border bg-ground px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden"
    >
      {DESTINOS.map((destino) => (
        <ItemInferior key={destino.href} destino={destino} caminho={caminho} />
      ))}
    </nav>
  );
}

function LateralComCaminho() {
  return <ListaLateral caminho={usePathname()} />;
}

function InferiorComCaminho() {
  return <ListaInferior caminho={usePathname()} />;
}

/**
 * Navegação da barra lateral (>= 1024 px).
 * O caminho só existe em tempo de execução: até lá a lista aparece sem item ativo.
 */
export function NavLateral() {
  return (
    <Suspense fallback={<ListaLateral caminho="" />}>
      <LateralComCaminho />
    </Suspense>
  );
}

/** Barra inferior fixa (< 1024 px): 4 destinos com alvos de 48 px, acima da área segura do aparelho. */
export function NavInferior() {
  return (
    <Suspense fallback={<ListaInferior caminho="" />}>
      <InferiorComCaminho />
    </Suspense>
  );
}
