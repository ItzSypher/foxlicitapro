"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { gerarCodigoAction } from "./actions";

const BOTAO =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-control bg-brand-fill px-4 text-sm font-medium text-black outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 sm:w-fit";
const BOTAO_SECUNDARIO =
  "inline-flex h-11 w-full items-center justify-center rounded-control border border-border bg-surface px-4 text-sm font-medium text-ink outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 sm:w-fit";

interface Gerado {
  codigo: string;
  link: string;
}

export function LigarWhatsapp() {
  const router = useRouter();
  const [gerado, setGerado] = useState<Gerado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function gerar() {
    setErro(null);
    iniciar(async () => {
      const r = await gerarCodigoAction();
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setGerado({ codigo: r.codigo, link: r.link });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {gerado ? (
        <>
          <p className="text-[13px] text-muted-foreground">Seu código de ativação:</p>
          <p className="font-mono text-3xl font-semibold tracking-widest text-ink">{gerado.codigo}</p>
          <a href={gerado.link} target="_blank" rel="noopener noreferrer" className={BOTAO}>
            <MessageCircle className="size-4" aria-hidden />
            Abrir WhatsApp
          </a>
          <p className="text-[13px] text-muted-foreground">
            O código vale 30 minutos. Envie a mensagem como ela abrir, sem mudar o texto.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => router.refresh()} className={BOTAO_SECUNDARIO}>
              Já enviei
            </button>
            <button type="button" onClick={gerar} disabled={pendente} className={BOTAO_SECUNDARIO}>
              {pendente ? "Gerando…" : "Gerar outro código"}
            </button>
          </div>
        </>
      ) : (
        <button type="button" onClick={gerar} disabled={pendente} className={BOTAO}>
          <MessageCircle className="size-4" aria-hidden />
          {pendente ? "Gerando…" : "Ligar WhatsApp"}
        </button>
      )}
      {erro ? (
        <p role="alert" className="text-[13px] text-negative">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
