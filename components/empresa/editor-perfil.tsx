"use client";

import { REGIOES, ROTULO_REGIAO, type CnaePerfil } from "@/core/perfil";
import type { Frente, Regiao } from "@/core/types";

export const CLASSE_CAMPO =
  "h-11 w-full rounded-control border border-control bg-raised px-3 text-base text-ink outline-none placeholder:text-faint focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-60";

const ROTULO_FRENTE: Record<Frente, string> = { servicos: "Serviços", produtos: "Produtos" };

interface PropsCnaes {
  cnaes: CnaePerfil[];
  onChange: (cnaes: CnaePerfil[]) => void;
  desabilitado?: boolean;
}

/** Lista de CNAEs da empresa com a frente (serviços ou produtos) editável em cada um. */
export function EditorCnaes({ cnaes, onChange, desabilitado = false }: PropsCnaes) {
  if (cnaes.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma atividade cadastrada.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {cnaes.map((c, i) => (
        <li key={c.codigo} className="flex flex-col gap-2 rounded-control border border-border bg-surface p-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] tabular-nums text-ink">
              {c.codigo}
              {c.principal ? <span className="ml-2 text-xs text-brand">principal</span> : null}
            </p>
            <p className="text-[13px] break-words text-muted-foreground">{c.descricao}</p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground max-sm:w-full">
            <span>Frente</span>
            <select
              value={c.frente}
              disabled={desabilitado}
              onChange={(e) => {
                const frente: Frente = e.target.value === "produtos" ? "produtos" : "servicos";
                onChange(cnaes.map((x, j) => (j === i ? { ...x, frente } : x)));
              }}
              className="h-11 min-w-0 flex-1 rounded-control border border-control bg-raised px-2 text-base sm:flex-none text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
            >
              {(Object.keys(ROTULO_FRENTE) as Frente[]).map((f) => (
                <option key={f} value={f}>
                  {ROTULO_FRENTE[f]}
                </option>
              ))}
            </select>
          </label>
        </li>
      ))}
    </ul>
  );
}

interface PropsRegioes {
  regioes: Regiao[];
  onChange: (regioes: Regiao[]) => void;
  desabilitado?: boolean;
}

/** Onde a empresa atende. Serviço fora destas regiões não é recomendado. */
export function SeletorRegioes({ regioes, onChange, desabilitado = false }: PropsRegioes) {
  return (
    <div className="flex flex-col gap-1">
      {REGIOES.map((r) => (
        <label key={r} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
          <input
            type="checkbox"
            checked={regioes.includes(r)}
            disabled={desabilitado}
            onChange={(e) => onChange(e.target.checked ? [...regioes, r] : regioes.filter((x) => x !== r))}
            className="size-5 accent-[var(--color-brand-fill)]"
          />
          {ROTULO_REGIAO[r]}
        </label>
      ))}
    </div>
  );
}
