"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PilulaStatus, dataHoraCurta } from "@/components/propostas/status";
import { podeRevisar } from "@/core/revisao";
import type { ResumoProposta } from "@/db/propostas";
import { formatarMoeda } from "@/lib/formato";
import { cn } from "@/lib/utils";

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

const BOTAO_PRIMARIO =
  "inline-flex h-11 items-center justify-center gap-2 rounded-control bg-brand-fill px-4 text-sm font-medium text-black outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ground";

type Aba = "revisar" | "minhas" | "todas";

const ROTULO_ABA: Record<Aba, string> = {
  revisar: "Para revisar",
  minhas: "Minhas",
  todas: "Todas",
};

const ORDEM_ABAS: ReadonlyArray<Aba> = ["revisar", "minhas", "todas"];

const VAZIO_ABA: Record<Aba, string> = {
  revisar: "Nada esperando a sua revisão.",
  minhas: "Você ainda não criou propostas.",
  todas: "Nenhuma proposta ainda.",
};

export function ListaPropostas({ propostas, usuarioId }: { propostas: ResumoProposta[]; usuarioId: string }) {
  const porAba = useMemo(() => {
    const revisar = propostas.filter((p) =>
      podeRevisar(p.status, { usuarioId, criadoPor: p.criadoPor, autor: p.autor }),
    );
    const minhas = propostas.filter((p) => p.criadoPor === usuarioId);
    return { revisar, minhas, todas: propostas } satisfies Record<Aba, ResumoProposta[]>;
  }, [propostas, usuarioId]);

  const [aba, setAba] = useState<Aba>(() => (porAba.revisar.length > 0 ? "revisar" : "todas"));
  const [busca, setBusca] = useState("");

  const base = porAba[aba];
  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    if (termo === "") return base;
    return base.filter((p) => normalizar(`${p.titulo} ${p.orgao}`).includes(termo));
  }, [busca, base]);

  if (propostas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-card border border-dashed border-control px-6 py-12 text-center">
        <p className="text-sm text-ink">Nenhuma proposta ainda.</p>
        <Link href="/radar" className={BOTAO_PRIMARIO}>
          Escolha uma licitação no Radar
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Filtro de propostas" className="flex border-b border-border">
        {ORDEM_ABAS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            onClick={() => setAba(id)}
            className={cn(
              "-mb-px inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 border-b-2 border-transparent px-2 text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand",
              "aria-selected:border-brand aria-selected:font-semibold aria-selected:text-ink",
            )}
          >
            <span className="truncate">{ROTULO_ABA[id]}</span>
            <span className="text-xs tabular-nums text-muted-foreground">{porAba[id].length}</span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por título ou órgão"
          aria-label="Buscar propostas"
          className="h-11 w-full rounded-control border border-control bg-raised pr-3 pl-9 text-base text-ink outline-none placeholder:text-faint focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40"
        />
      </div>

      {filtradas.length === 0 ? (
        <p className="rounded-card border border-border px-4 py-5 text-sm text-muted-foreground">
          {busca.trim() === "" ? VAZIO_ABA[aba] : "Nada encontrado para essa busca."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] tabular-nums text-muted-foreground" aria-live="polite">
            {filtradas.length === 1 ? "1 proposta" : `${filtradas.length} propostas`}
          </p>
          <div className="overflow-hidden rounded-card border border-border">
          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_128px_104px_104px] gap-x-4 border-b border-border px-4 py-2 text-xs text-muted-foreground md:grid">
            <span>Proposta</span>
            <span>Órgão</span>
            <span className="text-right">Total</span>
            <span>Status</span>
            <span className="text-right">Atualizada</span>
          </div>
          <ul className="divide-y divide-border">
            {filtradas.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/propostas/${p.id}`}
                  prefetch={false}
                  className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_128px_104px_104px] md:gap-x-4"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-ink md:col-start-1">{p.titulo}</span>
                  <span className="justify-self-end md:order-4 md:col-start-4 md:justify-self-start">
                    <PilulaStatus status={p.status} />
                  </span>
                  <span className="col-span-2 flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground md:contents">
                    <span className="min-w-0 flex-1 truncate md:order-2 md:col-start-2 md:flex-none">
                      {p.orgao || "Sem órgão"}
                      {p.autor === "assistente" ? " · assistente" : p.criadoPorNome ? ` · ${p.criadoPorNome}` : ""}
                    </span>
                    <span className="tabular-nums text-ink md:order-3 md:col-start-3 md:text-right">
                      {formatarMoeda(p.total)}
                    </span>
                    <span className="text-xs tabular-nums text-faint md:order-5 md:col-start-5 md:text-right">
                      {dataHoraCurta(p.atualizadoEm)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export function BotaoNovaProposta() {
  return (
    <Link href="/propostas/nova" prefetch={false} className={BOTAO_PRIMARIO}>
      <Plus aria-hidden className="size-4" />
      Nova proposta
    </Link>
  );
}
