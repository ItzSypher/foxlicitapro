"use client";

import { cn } from "@/lib/utils";

export const TEXTO_VAZIO = "Clique para preencher";

/** Contorno tracejado no hover e no foco; só existe na tela de edição, nunca na impressão. */
const MOLDURA =
  "group relative -mx-1 -my-0.5 min-w-0 rounded-sm border-b border-dashed border-[#f57e11]/35 outline-1 outline-offset-1 outline-transparent outline-dashed hover:border-transparent hover:outline-[#f57e11] focus-within:border-transparent focus-within:outline-[#f57e11] print:border-transparent print:outline-none";

const ESPACO = "px-1 py-0.5";

/** Rótulo discreto do campo, visível só enquanto o campo está em foco. */
function RotuloFoco({ rotulo }: { rotulo: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -top-3 left-1 z-10 hidden rounded-sm bg-[#f57e11] px-1 text-[11px] leading-4 font-medium text-black group-focus-within:block print:hidden"
    >
      {rotulo}
    </span>
  );
}

interface CampoInlineProps {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  /** false: mostra só o texto, sem campo (leitura) */
  editavel: boolean;
  /** Uma linha lógica: não aceita quebra manual, mas o texto continua quebrando na tela */
  linhaUnica?: boolean;
  maxLength?: number;
  inputMode?: "text" | "numeric" | "decimal";
  /** "herdar" segue o alinhamento do elemento de fora */
  alinhar?: "esquerda" | "direita" | "herdar";
  className?: string;
}

/**
 * Texto do documento que vira campo ao tocar. Tem a aparência do texto ao redor e cresce com o conteúdo:
 * uma cópia invisível do texto define a altura e a área de digitação ocupa a mesma célula.
 */
export function CampoInline({
  rotulo,
  valor,
  aoMudar,
  editavel,
  linhaUnica = false,
  maxLength = 2000,
  inputMode,
  alinhar = "herdar",
  className,
}: CampoInlineProps) {
  const alinhamento = alinhar === "direita" ? "text-right" : alinhar === "esquerda" ? "text-left" : "[text-align:inherit]";

  if (!editavel) {
    return <span className={cn("block min-w-0 break-words whitespace-pre-line", alinhamento, className)}>{valor}</span>;
  }

  return (
    <span className={cn(MOLDURA, "grid", className)}>
      <span aria-hidden className={cn("invisible col-start-1 row-start-1 break-words whitespace-pre-wrap", ESPACO, alinhamento)}>
        {valor === "" ? TEXTO_VAZIO : valor}{" "}
      </span>
      <textarea
        value={valor}
        rows={1}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete="off"
        aria-label={rotulo}
        placeholder={TEXTO_VAZIO}
        onChange={(e) => aoMudar(linhaUnica ? e.target.value.replace(/\s*[\r\n]+\s*/g, " ") : e.target.value)}
        onKeyDown={(e) => {
          if (linhaUnica && e.key === "Enter") e.preventDefault();
        }}
        className={cn(
          "col-start-1 row-start-1 block h-full w-full min-w-0 resize-none overflow-hidden rounded-sm border-0 bg-transparent outline-none placeholder:text-[#c2570a]",
          ESPACO,
          alinhamento,
        )}
      />
      <RotuloFoco rotulo={rotulo} />
    </span>
  );
}

interface CampoDataProps {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
}

/** Data da proposta como campo de data do aparelho, com a mesma moldura dos demais campos. */
export function CampoData({ rotulo, valor, aoMudar }: CampoDataProps) {
  return (
    <span className={cn(MOLDURA, "inline-block")}>
      <input
        type="date"
        value={valor}
        aria-label={rotulo}
        onChange={(e) => aoMudar(e.target.value)}
        className={cn("block rounded-sm border-0 bg-transparent tabular-nums outline-none", ESPACO)}
      />
      <RotuloFoco rotulo={rotulo} />
    </span>
  );
}
