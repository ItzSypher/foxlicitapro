"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
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
import { Segmentado } from "@/components/ui/segmentado";
import { Seletor, type OpcaoSeletor } from "@/components/ui/seletor";
import { AlternadorVisao } from "./alternador-visao";

const OPCOES_MODALIDADE: ReadonlyArray<OpcaoSeletor<FiltroModalidade>> = MODALIDADES.map((m) => ({ valor: m.id, rotulo: m.rotulo }));
const OPCOES_ORDEM: ReadonlyArray<OpcaoSeletor<Ordem>> = ORDENS.map((o) => ({ valor: o.id, rotulo: o.rotulo }));

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
      <Segmentado
        rotulo="Região"
        valor={filtros.regiao}
        aoMudar={onRegiao}
        opcoes={REGIOES.map((r) => ({ valor: r.id, rotulo: r.rotulo, contagem: contagens[r.id] }))}
        rolavel
        className="min-w-0"
      />
      <div className="min-w-0 flex-1" aria-hidden="true" />

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
            className="inline-flex size-5 items-center justify-center rounded-full bg-brand text-xs font-medium text-black"
          >
            {ativos}
          </span>
        ) : null}
      </Button>

      <div className="hidden shrink-0 items-center gap-3 lg:flex">
        <span aria-hidden="true" className="h-5 w-px bg-border" />
        <Seletor
          rotulo="Modalidade"
          posicaoRotulo="lado"
          valor={filtros.modalidade}
          opcoes={OPCOES_MODALIDADE}
          aoMudar={onModalidade}
          className="w-auto shrink-0"
        />
        {semOrdem ? null : (
          <Seletor
            rotulo="Ordenar por"
            posicaoRotulo="lado"
            valor={filtros.ordem}
            opcoes={OPCOES_ORDEM}
            aoMudar={onOrdem}
            className="w-auto shrink-0"
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

          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-4">
            <GrupoDoPainel titulo="Modalidade">
              <Segmentado
                rotulo="Modalidade"
                valor={filtros.modalidade}
                aoMudar={onModalidade}
                opcoes={OPCOES_MODALIDADE.map((o) => ({ valor: o.valor, rotulo: o.rotulo }))}
                larguraTotal
              />
            </GrupoDoPainel>

            {semOrdem ? null : (
              <GrupoDoPainel titulo="Ordenar por">
                <Seletor
                  rotulo="Ordenar por"
                  posicaoRotulo="oculto"
                  valor={filtros.ordem}
                  opcoes={OPCOES_ORDEM}
                  aoMudar={onOrdem}
                />
            </GrupoDoPainel>
            )}

            <GrupoDoPainel titulo="Visualização">
              <AlternadorVisao visao={visao} onEscolher={onVisao} larguraTotal />
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
