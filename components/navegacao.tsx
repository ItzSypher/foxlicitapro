"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calculator,
  Columns3,
  Ellipsis,
  FileText,
  Radar,
  SlidersHorizontal,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { BotaoSair } from "@/components/botao-sair";
import { TemaToggle } from "@/components/tema-toggle";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Papel } from "@/core/types-equipe";
import { rotuloPapel } from "@/lib/papel";
import { cn } from "@/lib/utils";

interface Destino {
  href: string;
  rotulo: string;
  /** Rótulo da barra inferior, que precisa caber em 5 itens numa tela de 320 px */
  rotuloCurto: string;
  icone: LucideIcon;
  /** Outras áreas que mantêm este destino ativo (ex.: a tela de uma licitação conta como Radar) */
  subareas?: ReadonlyArray<string>;
  /** Só aparece para este papel */
  somentePara?: Papel;
}

const PRINCIPAIS: ReadonlyArray<Destino> = [
  { href: "/radar", rotulo: "Radar", rotuloCurto: "Radar", icone: Radar, subareas: ["/licitacao"] },
  { href: "/pipeline", rotulo: "Pipeline", rotuloCurto: "Pipeline", icone: Columns3 },
  { href: "/propostas", rotulo: "Propostas", rotuloCurto: "Propostas", icone: FileText },
  { href: "/calculadora", rotulo: "Calculadora", rotuloCurto: "Calcular", icone: Calculator },
];

const SECUNDARIOS: ReadonlyArray<Destino> = [
  { href: "/preferencias", rotulo: "Preferências", rotuloCurto: "Preferências", icone: SlidersHorizontal },
  { href: "/equipe", rotulo: "Equipe", rotuloCurto: "Equipe", icone: Users, somentePara: "dono" },
];

/** Páginas que ficam atrás do botão "Mais" no celular. */
const AREAS_MAIS: ReadonlyArray<string> = ["/preferencias", "/equipe"];

export interface UsuarioNav {
  nome: string;
  papel: Papel;
}

export interface DadosNav {
  /** null enquanto a sessão carrega: o item "Equipe" fica escondido */
  usuario: UsuarioNav | null;
  /** Propostas esperando por esta pessoa */
  pendentes: number;
}

function estaAtivo(destino: Destino, caminho: string): boolean {
  return [destino.href, ...(destino.subareas ?? [])].some(
    (base) => caminho === base || caminho.startsWith(`${base}/`),
  );
}

function visiveis(lista: ReadonlyArray<Destino>, usuario: UsuarioNav | null): Destino[] {
  return lista.filter((d) => d.somentePara === undefined || d.somentePara === usuario?.papel);
}

function Selo({ quantidade, className }: { quantidade: number; className?: string }) {
  if (quantidade <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-fill px-1.5 font-mono text-[11px] font-medium tabular-nums text-black",
        className,
      )}
    >
      <span aria-hidden="true">{quantidade > 99 ? "99+" : quantidade}</span>
      <span className="sr-only">{quantidade} esperando você</span>
    </span>
  );
}

function pendentesDe(destino: Destino, dados: DadosNav): number {
  return destino.href === "/propostas" ? dados.pendentes : 0;
}

function ItemLateral({ destino, caminho, selo }: { destino: Destino; caminho: string; selo: number }) {
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
      <span className="flex-1">{destino.rotulo}</span>
      <Selo quantidade={selo} />
    </Link>
  );
}

const ITEM_INFERIOR =
  "relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-control px-0.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand";

function ItemInferior({ destino, caminho, selo }: { destino: Destino; caminho: string; selo: number }) {
  const ativo = estaAtivo(destino, caminho);
  const Icone = destino.icone;
  return (
    <Link
      href={destino.href}
      aria-current={ativo ? "page" : undefined}
      className={cn(ITEM_INFERIOR, ativo ? "font-medium text-brand" : "text-muted-foreground")}
    >
      <span className="relative">
        <Icone className="size-5" aria-hidden="true" />
        <Selo quantidade={selo} className="absolute -top-2 left-3 h-4 min-w-4 px-1 text-[10px]" />
      </span>
      <span className="max-w-full truncate">{destino.rotuloCurto}</span>
    </Link>
  );
}

function ListaLateral({ caminho, dados }: { caminho: string; dados: DadosNav }) {
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {PRINCIPAIS.map((d) => (
        <ItemLateral key={d.href} destino={d} caminho={caminho} selo={pendentesDe(d, dados)} />
      ))}
      <div className="my-2 border-t border-border" role="presentation" />
      {visiveis(SECUNDARIOS, dados.usuario).map((d) => (
        <ItemLateral key={d.href} destino={d} caminho={caminho} selo={0} />
      ))}
    </nav>
  );
}

function MenuMais({ caminho, dados }: { caminho: string; dados: DadosNav }) {
  const [aberto, setAberto] = useState(false);
  const ativo = AREAS_MAIS.some((base) => caminho === base || caminho.startsWith(`${base}/`)) || caminho.startsWith("/equipe");
  const { usuario } = dados;
  const itens: Destino[] = [
    ...visiveis(SECUNDARIOS, usuario),
    { href: "/equipe/conta", rotulo: "Minha conta", rotuloCurto: "Conta", icone: UserRound },
  ];
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        className={cn(ITEM_INFERIOR, ativo ? "font-medium text-brand" : "text-muted-foreground")}
      >
        <Ellipsis className="size-5" aria-hidden="true" />
        <span className="max-w-full truncate">Mais</span>
      </button>
      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent side="right" className="gap-0">
          <SheetHeader className="pr-14">
            <SheetTitle>{usuario ? usuario.nome : "Menu"}</SheetTitle>
            <SheetDescription>{usuario ? rotuloPapel(usuario.papel) : "FoxLicita Pro"}</SheetDescription>
          </SheetHeader>
          <nav aria-label="Mais opções" className="flex flex-col gap-1 px-4 pb-4">
            {itens.map((d) => {
              const Icone = d.icone;
              return (
                <Link
                  key={d.href}
                  href={d.href}
                  onClick={() => setAberto(false)}
                  className="flex h-12 items-center gap-3 rounded-control px-3 text-sm text-ink outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <Icone className="size-[18px]" aria-hidden="true" />
                  {d.rotulo}
                </Link>
              );
            })}
            <TemaToggle modo="completo" className="h-12 text-ink" />
            <BotaoSair modo="completo" className="h-12 text-ink" />
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}

function ListaInferior({ caminho, dados }: { caminho: string; dados: DadosNav }) {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-stretch gap-1 border-t border-border bg-ground px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:hidden"
    >
      {PRINCIPAIS.map((d) => (
        <ItemInferior key={d.href} destino={d} caminho={caminho} selo={pendentesDe(d, dados)} />
      ))}
      <MenuMais caminho={caminho} dados={dados} />
    </nav>
  );
}

function LateralComCaminho({ dados }: { dados: DadosNav }) {
  return <ListaLateral caminho={usePathname()} dados={dados} />;
}

function InferiorComCaminho({ dados }: { dados: DadosNav }) {
  return <ListaInferior caminho={usePathname()} dados={dados} />;
}

/**
 * Navegação da barra lateral (>= 1024 px).
 * O caminho só existe em tempo de execução: até lá a lista aparece sem item ativo.
 */
export function NavLateral({ dados }: { dados: DadosNav }) {
  return (
    <Suspense fallback={<ListaLateral caminho="" dados={dados} />}>
      <LateralComCaminho dados={dados} />
    </Suspense>
  );
}

/** Barra inferior fixa (< 1024 px): 4 destinos e "Mais", com alvos de 48 px, acima da área segura do aparelho. */
export function NavInferior({ dados }: { dados: DadosNav }) {
  return (
    <Suspense fallback={<ListaInferior caminho="" dados={dados} />}>
      <InferiorComCaminho dados={dados} />
    </Suspense>
  );
}
