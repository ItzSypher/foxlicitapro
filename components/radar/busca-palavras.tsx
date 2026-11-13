"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Search, X } from "lucide-react";
import { adicionarPalavraAction, removerPalavraAction } from "@/app/(app)/radar/palavras-actions";
import { normalizarBusca } from "@/lib/radar-filtros";
import { cn } from "@/lib/utils";

interface Props {
  /** Texto do campo de busca */
  busca: string;
  aoBuscar: (texto: string) => void;
  /** Palavras-chave guardadas pela pessoa */
  salvas: string[];
  aoMudarSalvas: (lista: string[]) => void;
  /** Palavras-chave marcadas (OU entre elas) */
  selecionadas: string[];
  aoAlternar: (termo: string) => void;
  /** Chamada quando uma palavra marcada é apagada */
  aoRemoverMarcada: (termo: string) => void;
}

/** Busca fixa no topo e palavras-chave como chips que rolam na horizontal. Alvos de toque de 44 px. */
export function BuscaPalavras({
  busca,
  aoBuscar,
  salvas,
  aoMudarSalvas,
  selecionadas,
  aoAlternar,
  aoRemoverMarcada,
}: Props) {
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const termoDigitado = normalizarBusca(busca);
  const podeSalvar = termoDigitado !== "" && !salvas.includes(termoDigitado);

  function salvarDigitado() {
    setErro(null);
    iniciar(async () => {
      const r = await adicionarPalavraAction(busca);
      if (r.ok) {
        aoMudarSalvas(r.palavras);
        aoBuscar("");
        if (!selecionadas.includes(termoDigitado)) aoAlternar(termoDigitado);
      } else {
        setErro(r.erro);
      }
    });
  }

  function remover(termo: string) {
    setErro(null);
    iniciar(async () => {
      const r = await removerPalavraAction(termo);
      if (r.ok) {
        aoMudarSalvas(r.palavras);
        if (selecionadas.includes(termo)) aoRemoverMarcada(termo);
        if (r.palavras.length === 0) setEditando(false);
      } else {
        setErro(r.erro);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="sticky top-[52px] z-10 -mx-4 flex items-center gap-2 bg-ground px-4 py-2 lg:static lg:mx-0 lg:px-0 lg:py-0">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => aoBuscar(e.target.value)}
            maxLength={100}
            placeholder="Buscar por objeto, órgão ou município"
            aria-label="Buscar oportunidades"
            autoComplete="off"
            className="h-11 w-full rounded-control border border-control bg-raised pr-10 pl-9 text-base text-ink outline-none placeholder:text-faint focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40 lg:h-9 lg:text-sm"
          />
          {busca !== "" ? (
            <button
              type="button"
              onClick={() => aoBuscar("")}
              aria-label="Limpar a busca"
              className="absolute top-0 right-0 inline-flex size-11 items-center justify-center rounded-control text-muted-foreground outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand lg:size-9"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          ) : null}
        </div>
        {podeSalvar ? (
          <button
            type="button"
            onClick={salvarDigitado}
            disabled={pendente}
            aria-label={`Guardar ${termoDigitado} como palavra-chave`}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-control border border-control bg-transparent px-3 text-sm text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 lg:h-9"
          >
            <Plus aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Guardar</span>
          </button>
        ) : null}
      </div>

      {salvas.length > 0 ? (
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Palavras-chave"
            className="sem-barra -ml-4 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pl-4 lg:ml-0 lg:pl-0"
          >
            {salvas.map((termo) => {
              const ativa = selecionadas.includes(termo);
              return (
                <button
                  key={termo}
                  type="button"
                  aria-pressed={editando ? undefined : ativa}
                  aria-label={editando ? `Apagar a palavra-chave ${termo}` : undefined}
                  onClick={() => (editando ? remover(termo) : aoAlternar(termo))}
                  disabled={pendente && editando}
                  className={cn(
                    "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-control border px-3 text-sm whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand lg:h-9",
                    editando
                      ? "border-negative text-negative hover:bg-active"
                      : ativa
                        ? "border-brand bg-active font-medium text-ink"
                        : "border-border bg-surface text-muted-foreground hover:bg-raised hover:text-ink",
                  )}
                >
                  {termo}
                  {editando ? <X aria-hidden="true" className="size-4" /> : null}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setEditando((v) => !v)}
            aria-label={editando ? "Concluir edição das palavras-chave" : "Editar palavras-chave"}
            aria-pressed={editando}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted-foreground outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand lg:size-9"
          >
            <Pencil aria-hidden="true" className="size-4" />
          </button>
        </div>
      ) : null}

      {erro ? (
        <p role="alert" className="text-[13px] text-negative">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
