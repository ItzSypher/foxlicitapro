"use client";

import { useState } from "react";
import { Plus, SlidersHorizontal } from "lucide-react";
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
  contarFiltrosAtivos,
  type FiltroModalidade,
  type Filtros,
  type Ordem,
  type Visao,
} from "@/lib/radar-filtros";
import { FONTES, type Fonte } from "@/core/fonte";
import { ordenarUfsParaFiltro } from "@/core/ufs";
import { Interruptor } from "@/components/ui/interruptor";
import { Segmentado } from "@/components/ui/segmentado";
import { Seletor, type OpcaoSeletor } from "@/components/ui/seletor";
import { cn } from "@/lib/utils";
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

/** Chip de marcar e desmarcar (multi-escolha). */
function Chip({ ativo, aoAlternar, children }: { ativo: boolean; aoAlternar: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={aoAlternar}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand lg:h-8",
        ativo ? "border-transparent bg-brand-fill font-medium text-black" : "border-control bg-raised text-muted-foreground hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function ContagemDoChip({ ativo, valor }: { ativo: boolean; valor: number }) {
  return <span className={cn("text-xs tabular-nums", ativo ? "text-black/70" : "text-faint")}>{valor}</span>;
}

function alternar<T>(lista: ReadonlyArray<T>, item: T): T[] {
  return lista.includes(item) ? lista.filter((x) => x !== item) : [...lista, item];
}

function lerReais(texto: string): number | null {
  const digitos = texto.replace(/\D/g, "");
  return digitos === "" ? null : Number(digitos);
}

const CLASSE_CAMPO_VALOR =
  "h-11 w-full min-w-0 rounded-control border border-control bg-raised px-3 text-base text-ink outline-none placeholder:text-faint focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40 lg:h-9";

/** Dois campos de valor em reais; o filtro vale ao sair do campo, para não navegar a cada dígito. */
function FaixaDeValor({
  min,
  max,
  aoMudar,
}: {
  min: number | null;
  max: number | null;
  aoMudar: (min: number | null, max: number | null) => void;
}) {
  const [textoMin, setTextoMin] = useState(min === null ? "" : String(min));
  const [textoMax, setTextoMax] = useState(max === null ? "" : String(max));
  const [ultimo, setUltimo] = useState({ min, max });
  if (ultimo.min !== min || ultimo.max !== max) {
    // A URL mudou por fora (Limpar): os campos seguem.
    setUltimo({ min, max });
    setTextoMin(min === null ? "" : String(min));
    setTextoMax(max === null ? "" : String(max));
  }
  const aplicar = () => aoMudar(lerReais(textoMin), lerReais(textoMax));
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Mínimo (R$)
        <input
          inputMode="numeric"
          value={textoMin}
          placeholder="0"
          onChange={(e) => setTextoMin(e.target.value)}
          onBlur={aplicar}
          onKeyDown={(e) => {
            if (e.key === "Enter") aplicar();
          }}
          className={CLASSE_CAMPO_VALOR}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Máximo (R$)
        <input
          inputMode="numeric"
          value={textoMax}
          placeholder="sem limite"
          onChange={(e) => setTextoMax(e.target.value)}
          onBlur={aplicar}
          onKeyDown={(e) => {
            if (e.key === "Enter") aplicar();
          }}
          className={CLASSE_CAMPO_VALOR}
        />
      </label>
    </div>
  );
}

interface Props {
  filtros: Filtros;
  /** UFs das áreas da empresa (as que entram na busca diária) */
  ufsAtendidas: ReadonlyArray<string>;
  /** UF sendo adicionada às áreas agora, para travar o chip */
  ufEmAdicao: string | null;
  /** Erro curto da última tentativa de adicionar um estado */
  erroUf: string | null;
  onAdicionarUf: (uf: string) => void;
  contagensUf: Record<string, number>;
  contagensFonte: Record<string, number>;
  /** "Tudo do meu ramo" valendo agora (URL ou padrão do perfil) */
  tudoDoRamo: boolean;
  visao: Visao;
  /** Quantas oportunidades o filtro atual mostra (rótulo do botão do painel). */
  totalResultados: number;
  /** Na aba "Para você" a ordem é a da recomendação: esconde o seletor de ordem */
  semOrdem?: boolean;
  onUfs: (valor: string[]) => void;
  onModalidade: (valor: FiltroModalidade) => void;
  onOrdem: (valor: Ordem) => void;
  onVisao: (valor: Visao) => void;
  onValor: (min: number | null, max: number | null) => void;
  onFontes: (valor: Fonte[]) => void;
  onTudoDoRamo: (valor: boolean) => void;
  onLimparPainel: () => void;
}

/**
 * Uma linha só: chips de UF rolando na horizontal e o botão "Filtros". A folha tem seções curtas
 * (estado, valor, modalidade, fonte, tudo do ramo, ordem, visualização). A partir de 1024 px
 * modalidade, ordem e visualização também ficam na linha.
 */
export function BarraFiltros({
  filtros,
  ufsAtendidas,
  ufEmAdicao,
  erroUf,
  onAdicionarUf,
  contagensUf,
  contagensFonte,
  tudoDoRamo,
  visao,
  totalResultados,
  semOrdem = false,
  onUfs,
  onModalidade,
  onOrdem,
  onVisao,
  onValor,
  onFontes,
  onTudoDoRamo,
  onLimparPainel,
}: Props) {
  const [painelAberto, setPainelAberto] = useState(false);
  const ativos = contarFiltrosAtivos(filtros, !semOrdem);
  // Linha do topo: só os estados atendidos e os escolhidos. O painel lista os 27.
  const todasUfs = ordenarUfsParaFiltro(ufsAtendidas);
  const ufsDaLinha = todasUfs.filter((uf) => ufsAtendidas.includes(uf) || filtros.ufs.includes(uf));

  return (
    <div className="flex items-center gap-2 lg:gap-3">
      <div role="group" aria-label="Estado" data-tour="radar-estados" className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overscroll-x-contain py-0.5">
        <Chip ativo={filtros.ufs.length === 0} aoAlternar={() => onUfs([])}>
          Todos
        </Chip>
        {ufsDaLinha.map((uf) => (
          <Chip key={uf} ativo={filtros.ufs.includes(uf)} aoAlternar={() => onUfs(alternar(filtros.ufs, uf))}>
            {uf}
            <ContagemDoChip ativo={filtros.ufs.includes(uf)} valor={contagensUf[uf] ?? 0} />
          </Chip>
        ))}
        <Chip ativo={false} aoAlternar={() => setPainelAberto(true)}>
          <Plus className="size-3.5" aria-hidden="true" />
          Estados
        </Chip>
      </div>

      <Button type="button" variant="outline" onClick={() => setPainelAberto(true)} className="h-11 shrink-0 gap-2 px-3 lg:h-9">
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
              Estado, valor, modalidade, fonte, ordem e visualização das oportunidades.
            </SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-4">
            <GrupoDoPainel titulo="Estados">
              <p className="text-xs text-muted-foreground">Toque para filtrar. Estados com + entram na busca diária.</p>
              <div role="group" aria-label="Estados" className="flex flex-wrap gap-2">
                <Chip ativo={filtros.ufs.length === 0} aoAlternar={() => onUfs([])}>
                  Todos
                </Chip>
                {todasUfs.map((uf) => {
                  const atendida = ufsAtendidas.includes(uf);
                  const marcada = filtros.ufs.includes(uf);
                  if (atendida || marcada) {
                    return (
                      <Chip key={uf} ativo={marcada} aoAlternar={() => onUfs(alternar(filtros.ufs, uf))}>
                        {uf}
                        <ContagemDoChip ativo={marcada} valor={contagensUf[uf] ?? 0} />
                      </Chip>
                    );
                  }
                  return (
                    <button
                      key={uf}
                      type="button"
                      disabled={ufEmAdicao !== null}
                      aria-label={`Adicionar ${uf} à busca diária`}
                      onClick={() => onAdicionarUf(uf)}
                      className={cn(
                        "inline-flex h-10 shrink-0 items-center gap-1 rounded-full border border-dashed border-control px-3 text-sm whitespace-nowrap text-faint outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60 lg:h-8",
                        ufEmAdicao === uf && "motion-safe:animate-pulse",
                      )}
                    >
                      {uf}
                      <Plus className="size-3.5" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
              {erroUf ? (
                <p role="alert" className="text-xs text-negative">
                  {erroUf}
                </p>
              ) : null}
            </GrupoDoPainel>

            <GrupoDoPainel titulo="Faixa de valor">
              <FaixaDeValor min={filtros.valorMin} max={filtros.valorMax} aoMudar={onValor} />
            </GrupoDoPainel>

            <GrupoDoPainel titulo="Modalidade">
              <Segmentado
                rotulo="Modalidade"
                valor={filtros.modalidade}
                aoMudar={onModalidade}
                opcoes={OPCOES_MODALIDADE.map((o) => ({ valor: o.valor, rotulo: o.rotulo }))}
                larguraTotal
              />
            </GrupoDoPainel>

            <GrupoDoPainel titulo="Fonte">
              <div className="flex flex-wrap gap-2">
                {FONTES.filter((f) => (contagensFonte[f] ?? 0) > 0 || filtros.fontes.includes(f)).map((f) => (
                  <Chip key={f} ativo={filtros.fontes.includes(f)} aoAlternar={() => onFontes(alternar(filtros.fontes, f))}>
                    {f}
                    <ContagemDoChip ativo={filtros.fontes.includes(f)} valor={contagensFonte[f] ?? 0} />
                  </Chip>
                ))}
              </div>
            </GrupoDoPainel>

            <Interruptor
              rotulo="Tudo do meu ramo"
              descricao="Mostra toda oportunidade que casa com as suas atividades ou palavras-chave, mesmo com nota baixa."
              checked={tudoDoRamo}
              onChange={(e) => onTudoDoRamo(e.target.checked)}
            />

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
