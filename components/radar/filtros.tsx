"use client";

import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  MODALIDADES,
  ORDENS,
  REGIOES,
  contarFiltrosAtivos,
  type FiltroModalidade,
  type FiltroRegiao,
  type Filtros,
  type Ordem,
  type Visao,
} from "@/lib/radar-filtros";
import { cn } from "@/lib/utils";
import { AlternadorVisao } from "./alternador-visao";

function Chip({
  ativo,
  onClick,
  children,
  className,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-control border px-3 text-sm whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand lg:h-9",
        ativo
          ? "border-control bg-active font-medium text-ink"
          : "border-border bg-surface text-muted-foreground hover:bg-raised hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Seletor<T extends string>({
  rotulo,
  prefixo,
  valor,
  opcoes,
  onMudar,
}: {
  rotulo: string;
  prefixo: string;
  valor: T;
  opcoes: ReadonlyArray<{ id: T; rotulo: string }>;
  onMudar: (valor: T) => void;
}) {
  return (
    <label className="relative inline-flex shrink-0 items-center">
      <span className="sr-only">{rotulo}</span>
      <select
        value={valor}
        onChange={(evento) => {
          const escolhida = opcoes.find((opcao) => opcao.id === evento.target.value);
          if (escolhida) onMudar(escolhida.id);
        }}
        className="h-9 cursor-pointer appearance-none rounded-control border border-border bg-surface pr-8 pl-3 text-sm text-ink outline-none transition-colors hover:bg-raised focus-visible:ring-2 focus-visible:ring-brand"
      >
        {opcoes.map((opcao) => (
          <option key={opcao.id} value={opcao.id}>
            {prefixo}
            {opcao.rotulo}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 size-4 text-muted-foreground"
        aria-hidden="true"
      />
    </label>
  );
}

function GrupoDoPainel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-ink">{titulo}</h3>
      {children}
    </div>
  );
}

interface Props {
  filtros: Filtros;
  contagens: Record<FiltroRegiao, number>;
  visao: Visao;
  /** Quantas oportunidades o filtro atual mostra (rótulo do botão do painel). */
  totalResultados: number;
  /** Na aba "Para você" a ordem é a da recomendação: esconde o seletor de ordem */
  semOrdem?: boolean;
  onRegiao: (valor: FiltroRegiao) => void;
  onModalidade: (valor: FiltroModalidade) => void;
  onOrdem: (valor: Ordem) => void;
  onVisao: (valor: Visao) => void;
  onLimparPainel: () => void;
}

/**
 * Uma linha só. Telefone e tablet: chips de região rolando na horizontal e botão "Filtros"
 * (painel de baixo com modalidade, ordem e visualização). A partir de 1024 px: tudo inline.
 */
export function BarraFiltros({
  filtros,
  contagens,
  visao,
  totalResultados,
  semOrdem = false,
  onRegiao,
  onModalidade,
  onOrdem,
  onVisao,
  onLimparPainel,
}: Props) {
  const [painelAberto, setPainelAberto] = useState(false);
  const ativos = contarFiltrosAtivos(filtros, !semOrdem);

  return (
    <div className="flex items-center gap-2 lg:gap-3">
      <div
        role="group"
        aria-label="Região"
        className="sem-barra -ml-4 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pl-4 lg:ml-0 lg:pl-0"
      >
        {REGIOES.map((regiao) => (
          <Chip key={regiao.id} ativo={filtros.regiao === regiao.id} onClick={() => onRegiao(regiao.id)}>
            {regiao.rotulo}
            <span className="font-mono text-xs tabular-nums">{contagens[regiao.id]}</span>
          </Chip>
        ))}
        <span aria-hidden="true" className="w-2 shrink-0 lg:hidden" />
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => setPainelAberto(true)}
        className="h-11 shrink-0 gap-2 px-3 lg:hidden"
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        Filtros
        {ativos > 0 ? (
          <span
            aria-label={`${ativos} ${ativos === 1 ? "filtro ativo" : "filtros ativos"}`}
            className="inline-flex size-5 items-center justify-center rounded-full bg-brand font-mono text-xs font-medium text-black"
          >
            {ativos}
          </span>
        ) : null}
      </Button>

      <div className="hidden shrink-0 items-center gap-3 lg:flex">
        <span aria-hidden="true" className="h-5 w-px bg-border" />
        <Seletor
          rotulo="Modalidade"
          prefixo="Modalidade: "
          valor={filtros.modalidade}
          opcoes={MODALIDADES}
          onMudar={onModalidade}
        />
        {semOrdem ? null : (
          <Seletor
            rotulo="Ordenar por"
            prefixo="Ordenar: "
            valor={filtros.ordem}
            opcoes={ORDENS}
            onMudar={onOrdem}
          />
        )}
        <AlternadorVisao visao={visao} onEscolher={onVisao} />
      </div>

      <Sheet open={painelAberto} onOpenChange={setPainelAberto}>
        <SheetContent
          side="bottom"
          className="max-h-[88dvh] gap-0 rounded-t-sheet border-t border-border data-[side=bottom]:h-auto"
        >
          <SheetHeader className="border-b border-border p-4 pr-14">
            <SheetTitle>Filtros</SheetTitle>
            <SheetDescription className="sr-only">
              Modalidade, ordem e visualização das oportunidades.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-6 overflow-y-auto p-4">
            <GrupoDoPainel titulo="Modalidade">
              <div role="group" aria-label="Modalidade" className="flex flex-wrap gap-2">
                {MODALIDADES.map((modalidade) => (
                  <Chip
                    key={modalidade.id}
                    ativo={filtros.modalidade === modalidade.id}
                    onClick={() => onModalidade(modalidade.id)}
                  >
                    {modalidade.rotulo}
                  </Chip>
                ))}
              </div>
            </GrupoDoPainel>

            {semOrdem ? null : (
              <GrupoDoPainel titulo="Ordenar por">
                <div role="group" aria-label="Ordenar por" className="flex flex-wrap gap-2">
                  {ORDENS.map((ordem) => (
                    <Chip key={ordem.id} ativo={filtros.ordem === ordem.id} onClick={() => onOrdem(ordem.id)}>
                      {ordem.rotulo}
                    </Chip>
                  ))}
                </div>
              </GrupoDoPainel>
            )}

            <GrupoDoPainel titulo="Visualização">
              <AlternadorVisao visao={visao} onEscolher={onVisao} className="w-full" />
            </GrupoDoPainel>
          </div>

          <SheetFooter className="mt-0 flex-row gap-2 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {ativos > 0 ? (
              <Button type="button" variant="outline" onClick={onLimparPainel} className="h-12 px-4">
                Limpar
              </Button>
            ) : null}
            <Button type="button" onClick={() => setPainelAberto(false)} className="h-12 flex-1 text-sm">
              Ver {totalResultados} {totalResultados === 1 ? "oportunidade" : "oportunidades"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
