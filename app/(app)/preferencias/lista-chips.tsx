"use client";

import { useId, useState } from "react";
import { Plus, X } from "lucide-react";

interface Props {
  titulo: string;
  /** Uma linha que explica para que serve a lista */
  ajuda: string;
  valores: ReadonlyArray<string>;
  onChange: (proximos: string[]) => void;
  somenteLeitura: boolean;
  placeholder: string;
  /** "email" valida o formato antes de adicionar */
  tipo?: "texto" | "email";
  vazio: string;
}

const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Minúsculas, sem acento e sem espaços sobrando: só para evitar repetidos na tela. O servidor normaliza de novo. */
function simplificar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Lista de "chips": adiciona com Enter (ou pelo botão) e remove com o X. */
export function ListaChips({ titulo, ajuda, valores, onChange, somenteLeitura, placeholder, tipo = "texto", vazio }: Props) {
  const idCampo = useId();
  const idAjuda = useId();
  const [rascunho, setRascunho] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function adicionar() {
    const limpo = simplificar(rascunho);
    if (limpo === "") return;
    if (tipo === "email" && !FORMATO_EMAIL.test(limpo)) {
      setErro("Esse e-mail não parece certo. Confira e tente de novo.");
      return;
    }
    setErro(null);
    setRascunho("");
    if (valores.some((v) => simplificar(v) === limpo)) return;
    onChange([...valores, limpo]);
  }

  function remover(valor: string) {
    onChange(valores.filter((v) => v !== valor));
  }

  return (
    <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
      <h2 id={`${idCampo}-titulo`} className="text-base font-semibold text-ink">
        {titulo}
      </h2>
      <p id={idAjuda} className="text-[13px] text-muted-foreground">
        {ajuda}
      </p>

      {valores.length > 0 ? (
        <ul aria-labelledby={`${idCampo}-titulo`} className="flex flex-wrap gap-2">
          {valores.map((valor) => (
            <li
              key={valor}
              className="inline-flex max-w-full min-w-0 items-center rounded-full bg-pill-neutral-bg text-sm text-pill-neutral-fg"
            >
              <span className={somenteLeitura ? "min-h-9 px-3 py-2 break-all" : "min-h-11 py-2.5 pl-3 break-all"}>
                {valor}
              </span>
              {somenteLeitura ? null : (
                <button
                  type="button"
                  onClick={() => remover(valor)}
                  aria-label={`Remover ${valor}`}
                  className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{vazio}</p>
      )}

      {somenteLeitura ? null : (
        <div className="mt-1 flex flex-col gap-1.5">
          <label htmlFor={idCampo} className="sr-only">
            {`Adicionar em ${titulo}`}
          </label>
          <div className="flex gap-2">
            <input
              id={idCampo}
              type={tipo === "email" ? "email" : "text"}
              inputMode={tipo === "email" ? "email" : "text"}
              autoComplete="off"
              enterKeyHint="done"
              value={rascunho}
              placeholder={placeholder}
              aria-describedby={idAjuda}
              aria-invalid={erro !== null}
              onChange={(evento) => {
                setRascunho(evento.target.value);
                setErro(null);
              }}
              onKeyDown={(evento) => {
                if (evento.key !== "Enter") return;
                evento.preventDefault();
                adicionar();
              }}
              className="h-11 min-w-0 flex-1 rounded-control border border-control bg-ground px-3 text-base text-ink outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-brand aria-invalid:border-negative md:text-sm"
            />
            <button
              type="button"
              onClick={adicionar}
              className="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-control border border-control px-3 text-sm font-medium text-ink outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Plus className="size-4" aria-hidden="true" />
              Adicionar
            </button>
          </div>
          {erro ? (
            <p role="alert" className="text-[13px] text-negative">
              {erro}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
