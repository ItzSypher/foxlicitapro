"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { BOTAO_PRIMARIO, CONTROLE, CampoArea, CampoLinha, Secao } from "@/components/propostas/campos";
import { itemParaDados, itemVazio, type ItemFormulario } from "@/components/propostas/estado";
import { totalItemCentavos } from "@/core/proposta";
import { formatarMoeda } from "@/lib/formato";
import { cn } from "@/lib/utils";

const BOTAO_MOVER =
  "inline-flex h-11 items-center justify-center gap-1 rounded-control border border-control bg-raised px-2 text-sm font-medium text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-40";

interface Props {
  itens: ItemFormulario[];
  aoMudar: (itens: ItemFormulario[]) => void;
}

function resumo(item: ItemFormulario): string {
  return item.descricao.trim() === "" ? "Sem descrição" : item.descricao.trim();
}

export function SecaoItens({ itens, aoMudar }: Props) {
  /** Itens recolhidos. Com muitos itens, a tela começa recolhida para não virar uma rolagem sem fim. */
  const [recolhidos, setRecolhidos] = useState<Set<number>>(() =>
    itens.length > 3 ? new Set(itens.map((i) => i.chave)) : new Set(),
  );

  function alternar(chave: number) {
    setRecolhidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });
  }

  function mudar(chave: number, parte: Partial<ItemFormulario>) {
    aoMudar(itens.map((i) => (i.chave === chave ? { ...i, ...parte } : i)));
  }

  function mover(indice: number, delta: -1 | 1) {
    const alvo = indice + delta;
    if (alvo < 0 || alvo >= itens.length) return;
    const copia = [...itens];
    [copia[indice], copia[alvo]] = [copia[alvo], copia[indice]];
    aoMudar(copia);
  }

  function remover(chave: number) {
    aoMudar(itens.filter((i) => i.chave !== chave));
  }

  function adicionar() {
    const chave = itens.reduce((max, i) => Math.max(max, i.chave), 0) + 1;
    aoMudar([...itens, itemVazio(chave)]);
  }

  return (
    <Secao id="secao-itens" titulo={`Itens (${itens.length})`}>
      {itens.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item. Adicione o primeiro.</p>}
      <ul className="flex flex-col gap-2">
        {itens.map((item, indice) => {
          const fechado = recolhidos.has(item.chave);
          const totalLinha = totalItemCentavos(itemParaDados(item, indice + 1)) / 100;
          const idBase = `item-${item.chave}`;
          return (
            <li key={item.chave} className="rounded-card border border-border bg-ground">
              <button
                type="button"
                onClick={() => alternar(item.chave)}
                aria-expanded={!fechado}
                aria-controls={`${idBase}-corpo`}
                className="flex min-h-14 w-full items-center gap-3 rounded-card px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="font-mono text-sm tabular-nums text-muted-foreground">{indice + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{resumo(item)}</span>
                  <span className="block font-mono text-xs tabular-nums text-muted-foreground">
                    {formatarMoeda(totalLinha)}
                  </span>
                </span>
                <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-muted-foreground transition-transform", !fechado && "rotate-180")} />
              </button>

              {!fechado && (
                <div id={`${idBase}-corpo`} className="flex flex-col gap-3 border-t border-border p-3">
                  <CampoArea
                    id={`${idBase}-descricao`}
                    rotulo="Descrição"
                    valor={item.descricao}
                    onMudar={(v) => mudar(item.chave, { descricao: v })}
                    linhas={2}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <CampoLinha
                      id={`${idBase}-unidade`}
                      rotulo="Unidade"
                      valor={item.unidade}
                      onMudar={(v) => mudar(item.chave, { unidade: v })}
                      maxLength={20}
                    />
                    <CampoLinha
                      id={`${idBase}-quantidade`}
                      rotulo="Quantidade"
                      valor={item.quantidade}
                      onMudar={(v) => mudar(item.chave, { quantidade: v })}
                      inputMode="decimal"
                      maxLength={14}
                    />
                  </div>
                  <CampoLinha
                    id={`${idBase}-marca`}
                    rotulo="Marca e modelo"
                    valor={item.marcaModelo}
                    onMudar={(v) => mudar(item.chave, { marcaModelo: v })}
                  />
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <label htmlFor={`${idBase}-valor`} className="text-[13px] font-medium text-ink">
                        Valor unitário
                      </label>
                      {item.referencia !== null && (
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          ref. {formatarMoeda(item.referencia)}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-sm text-faint">
                        R$
                      </span>
                      <input
                        id={`${idBase}-valor`}
                        type="text"
                        inputMode="decimal"
                        enterKeyHint="next"
                        autoComplete="off"
                        value={item.valorUnitario}
                        placeholder="0,00"
                        onChange={(e) => mudar(item.chave, { valorUnitario: e.target.value })}
                        className={cn(CONTROLE, "pl-10 font-mono tabular-nums")}
                      />
                    </div>
                    <p className="flex justify-between text-[13px] text-muted-foreground">
                      <span>Total do item</span>
                      <span className="font-mono tabular-nums text-ink">{formatarMoeda(totalLinha)}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => mover(indice, -1)} disabled={indice === 0} className={BOTAO_MOVER}>
                      <ChevronUp aria-hidden className="size-4" />
                      Subir
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(indice, 1)}
                      disabled={indice === itens.length - 1}
                      className={BOTAO_MOVER}
                    >
                      <ChevronDown aria-hidden className="size-4" />
                      Descer
                    </button>
                    <button type="button" onClick={() => remover(item.chave)} className={cn(BOTAO_MOVER, "text-negative")}>
                      <Trash2 aria-hidden className="size-4" />
                      Remover
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={adicionar} className={cn(BOTAO_PRIMARIO, "w-full sm:w-auto sm:self-start")}>
        <Plus aria-hidden className="size-4" />
        Adicionar item
      </button>
    </Secao>
  );
}
