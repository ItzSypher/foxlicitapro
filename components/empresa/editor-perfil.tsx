"use client";

import { Interruptor } from "@/components/ui/interruptor";
import { Seletor, type OpcaoSeletor } from "@/components/ui/seletor";
import { REGIOES, ROTULO_REGIAO, type CnaePerfil } from "@/core/perfil";
import type { Frente, Regiao } from "@/core/types";

export const CLASSE_CAMPO =
  "h-11 w-full rounded-control border border-control bg-raised px-3 text-base text-ink outline-none placeholder:text-faint focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-60";

const OPCOES_FRENTE: ReadonlyArray<OpcaoSeletor<Frente>> = [
  { valor: "servicos", rotulo: "Serviços" },
  { valor: "produtos", rotulo: "Produtos" },
];

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
          <Seletor
            rotulo="Frente"
            posicaoRotulo="lado"
            valor={c.frente}
            desabilitado={desabilitado}
            opcoes={OPCOES_FRENTE}
            aoMudar={(frente) => onChange(cnaes.map((x, j) => (j === i ? { ...x, frente } : x)))}
            className="shrink-0 max-sm:w-full sm:w-auto"
          />
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
        <Interruptor
          key={r}
          checked={regioes.includes(r)}
          disabled={desabilitado}
          onChange={(e) => onChange(e.target.checked ? [...regioes, r] : regioes.filter((x) => x !== r))}
          rotulo={ROTULO_REGIAO[r]}
        />
      ))}
    </div>
  );
}
