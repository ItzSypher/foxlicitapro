"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { ROTULO_ETAPA, TODAS_AS_UFS, contarPorUf, ufsDoFiltro, type EtapaId } from "@/components/pipeline/tipos";
import { normalizarTexto } from "@/core/texto-busca";
import type { VereditoConselheiro } from "@/lib/conselheiro/esquema";
import { formatarMoedaCurta, plural } from "@/lib/formato";
import { Segmentado } from "@/components/ui/segmentado";
import { cn } from "@/lib/utils";
import { SeloConselheiro } from "./selo-conselheiro";

/** O mínimo de um item do Pipeline para a lista da tela do conselheiro. */
export interface ItemDaLista {
  id: string;
  titulo: string;
  orgao: string;
  municipio: string;
  uf: string;
  valorEstimado: number | null;
  etapa: EtapaId;
  /** Veredito da análise mais recente; null sem análise */
  veredito: VereditoConselheiro | null;
}

const CONTROLE =
  "h-11 w-full rounded-control border-0 bg-raised px-3 pl-9 text-base text-ink placeholder:text-faint outline-none focus-visible:ring-2 focus-visible:ring-brand";

function hrefDoItem(id: string): string {
  return `/conselheiro?item=${encodeURIComponent(id)}`;
}

/** Itens que passam pela busca (todas as palavras em objeto, órgão ou município, sem acento) e pela UF. */
function filtrarItens(itens: readonly ItemDaLista[], busca: string, uf: string): ItemDaLista[] {
  const termos = normalizarTexto(busca).split(" ").filter((t) => t !== "");
  return itens.filter((i) => {
    if (uf !== TODAS_AS_UFS && i.uf.trim().toUpperCase() !== uf) return false;
    if (termos.length === 0) return true;
    const palheiro = normalizarTexto(`${i.titulo} ${i.orgao} ${i.municipio}`);
    return termos.every((t) => palheiro.includes(t));
  });
}

export function ListaItensConselheiro({
  itens,
  ufsDasAreas,
  selecionado,
  className,
}: {
  itens: readonly ItemDaLista[];
  /** UFs das áreas da empresa; as dos itens entram também */
  ufsDasAreas: readonly string[];
  selecionado: string | null;
  className?: string;
}) {
  const [busca, setBusca] = useState("");
  const [uf, setUf] = useState<string>(TODAS_AS_UFS);
  const visiveis = useMemo(() => filtrarItens(itens, busca, uf), [itens, busca, uf]);
  const opcoes = useMemo(() => {
    const contagem = contarPorUf(itens.map((i) => ({ item: { uf: i.uf } })));
    return [
      { valor: TODAS_AS_UFS, rotulo: "Todas", contagem: itens.length },
      ...ufsDoFiltro(ufsDasAreas, itens.map((i) => ({ item: { uf: i.uf } }))).map((u) => ({ valor: u, rotulo: u, contagem: contagem[u] ?? 0 })),
    ];
  }, [itens, ufsDasAreas]);

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div role="search" className="relative">
        <label htmlFor="busca-conselheiro" className="sr-only">
          Buscar item do Pipeline
        </label>
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
        <input
          id="busca-conselheiro"
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por objeto, órgão ou município"
          autoComplete="off"
          className={CONTROLE}
        />
      </div>

      <Segmentado
        rotulo="Estado"
        valor={uf}
        aoMudar={setUf}
        rolavel
        opcoes={opcoes}
      />

      <p className="text-[13px] text-muted-foreground" aria-live="polite">
        {visiveis.length} {plural(visiveis.length, "item", "itens")}
      </p>

      {itens.length === 0 ? (
        <p className="rounded-card bg-surface px-4 py-5 text-sm text-muted-foreground">
          Nenhum item ativo no Pipeline. Salve oportunidades do Radar para pedir a opinião do conselheiro.
        </p>
      ) : visiveis.length === 0 ? (
        <p className="rounded-card bg-surface px-4 py-5 text-sm text-muted-foreground">Nenhum item para essa busca.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-rule overflow-hidden rounded-card bg-surface">
          {visiveis.map((i) => {
            const ativo = i.id === selecionado;
            return (
              <li key={i.id}>
                <Link
                  href={hrefDoItem(i.id)}
                  aria-current={ativo ? "true" : undefined}
                  className={cn(
                    "flex min-h-14 min-w-0 flex-col justify-center gap-1 px-4 py-3 outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand",
                    ativo ? "bg-active" : "",
                  )}
                >
                  <span className="line-clamp-2 text-sm font-medium text-ink wrap-break-word">{i.titulo}</span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    {i.orgao} · {i.municipio}/{i.uf}
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>{ROTULO_ETAPA[i.etapa]}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{i.valorEstimado === null ? "Sem valor" : formatarMoedaCurta(i.valorEstimado)}</span>
                    {i.veredito !== null ? <SeloConselheiro veredito={i.veredito} /> : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
