"use client";

import { useState } from "react";
import { LIMITE_FOCO_CARACTERES, LIMITE_FOCO_TERMOS, normalizarFoco } from "@/core/perfil";
import { CLASSE_CAMPO } from "./editor-perfil";

/** Termos que um MEI de TI costuma oferecer; um toque adiciona ao foco. */
const SUGESTOES = [
  "site institucional",
  "redesign",
  "desenvolvimento de sistema",
  "software",
  "aplicativo",
  "material de escritório",
  "suprimentos de informática",
  "equipamentos de informática",
] as const;

interface Props {
  foco: string[];
  onChange: (foco: string[]) => void;
}

/** Termos que o dono mais quer vender, como chips que se adicionam e se removem. */
export function EditorFoco({ foco, onChange }: Props) {
  const [texto, setTexto] = useState("");
  const cheio = foco.length >= LIMITE_FOCO_TERMOS;

  const jaTem = new Set(foco.map((t) => t.toLowerCase()));
  const sugestoes = SUGESTOES.filter((s) => !jaTem.has(s));

  function adicionar() {
    if (texto.trim() === "") return;
    onChange(normalizarFoco([...foco, texto]));
    setTexto("");
  }

  return (
    <section id="foco" data-tour="empresa-foco" className="flex scroll-mt-20 flex-col gap-2 rounded-card border border-border bg-surface p-4">
      <label htmlFor="foco-termo" className="text-base font-semibold text-ink">
        Foco da empresa
      </label>
      <p className="text-[13px] text-muted-foreground">O que você mais quer vender. Licitações com estes termos ganham nota máxima de ramo.</p>
      {foco.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {foco.map((termo) => (
            <li key={termo} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-border bg-ground pr-1 pl-3 text-sm text-ink">
              <span className="break-words">{termo}</span>
              <button
                type="button"
                aria-label={`Remover ${termo}`}
                onClick={() => onChange(foco.filter((t) => t !== termo))}
                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {sugestoes.length > 0 && !cheio ? (
        <ul aria-label="Sugestões" className="flex flex-wrap gap-2">
          {sugestoes.map((sugestao) => (
            <li key={sugestao}>
              <button
                type="button"
                onClick={() => onChange(normalizarFoco([...foco, sugestao]))}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-dashed border-border px-3 text-[13px] text-muted-foreground outline-none hover:border-brand hover:text-ink focus-visible:ring-2 focus-visible:ring-brand md:min-h-8"
              >
                + {sugestao}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <input
          id="foco-termo"
          value={texto}
          maxLength={LIMITE_FOCO_CARACTERES}
          disabled={cheio}
          placeholder={cheio ? `Limite de ${LIMITE_FOCO_TERMOS} termos` : "Ex.: site institucional"}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar();
            }
          }}
          className={CLASSE_CAMPO}
        />
        <button
          type="button"
          onClick={adicionar}
          disabled={cheio || texto.trim() === ""}
          className="h-11 shrink-0 cursor-pointer rounded-control border border-border px-4 text-sm font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
        >
          Adicionar
        </button>
      </div>
    </section>
  );
}
