"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** A partir deste tamanho o texto pode passar de 3 linhas no celular e ganha "ver mais". */
const LIMITE_CARACTERES = 90;

interface Props {
  texto: string;
  /** Elemento do título (h1, SheetTitle...). Recebe `className` e o texto como filho. */
  como: React.ElementType<{ className?: string; children?: React.ReactNode }>;
  className?: string;
}

/** Título limitado a 3 linhas, com botão "ver mais" / "ver menos" quando o texto é longo. */
export function TextoRecolhivel({ texto, como: Elemento, className }: Props) {
  const [aberto, setAberto] = useState(false);
  const longo = texto.length > LIMITE_CARACTERES;
  return (
    <>
      <Elemento className={cn(className, longo && !aberto && "line-clamp-3")}>{texto}</Elemento>
      {longo ? (
        <button
          type="button"
          onClick={() => setAberto((atual) => !atual)}
          aria-expanded={aberto}
          className="inline-flex min-h-8 w-fit items-center self-start rounded-control text-xs font-medium text-brand outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {aberto ? "ver menos" : "ver mais"}
        </button>
      ) : null}
    </>
  );
}
