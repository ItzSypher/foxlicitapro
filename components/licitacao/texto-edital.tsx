"use client";

import { useState } from "react";
import { Secao } from "./secao";

const LIMITE = 700;

function TextoLongo({ rotulo, texto }: { rotulo: string; texto: string }) {
  const [aberto, setAberto] = useState(false);
  const longo = texto.length > LIMITE;
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-medium text-muted-foreground">{rotulo}</h3>
      <p className="text-sm leading-relaxed wrap-break-word whitespace-pre-line text-ink">
        {longo && !aberto ? `${texto.slice(0, LIMITE).trimEnd()}…` : texto}
      </p>
      {longo ? (
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="inline-flex h-11 w-fit items-center rounded-control px-1 text-sm font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
        >
          {aberto ? "Ver menos" : "Ver mais"}
        </button>
      ) : null}
    </div>
  );
}

/** Objeto original completo e informação complementar, com "ver mais" quando longos. */
export function TextoEdital({ objeto, informacaoComplementar }: { objeto: string; informacaoComplementar: string | null }) {
  return (
    <Secao id="texto" titulo="Texto do edital">
      <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
        <TextoLongo rotulo="Objeto" texto={objeto || "Não informado."} />
        {informacaoComplementar ? (
          <TextoLongo rotulo="Informação complementar" texto={informacaoComplementar} />
        ) : null}
      </div>
    </Secao>
  );
}
