"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { anexarPdfAssinadoAction } from "@/app/(app)/atestados/actions";

/** Envia o PDF assinado fora do sistema (gov.br). Até 4 MB; entra no acervo junto do atestado. */
export function AnexarPdf({ id, temArquivo }: { id: string; temArquivo: boolean }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [aviso, setAviso] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [enviando, iniciar] = useTransition();

  function enviar(): void {
    const arquivo = entrada.current?.files?.[0];
    if (!arquivo) {
      setAviso({ tom: "erro", texto: "Escolha o arquivo PDF." });
      return;
    }
    const dados = new FormData();
    dados.set("arquivo", arquivo);
    setAviso(null);
    iniciar(async () => {
      const r = await anexarPdfAssinadoAction(id, dados);
      if (!r.ok) {
        setAviso({ tom: "erro", texto: r.erro });
        return;
      }
      if (entrada.current) entrada.current.value = "";
      setAviso({ tom: "ok", texto: "PDF guardado no atestado e no acervo." });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="at-pdf" className="text-[13px] font-medium text-ink">
        {temArquivo ? "Trocar o PDF assinado" : "Anexar PDF assinado fora do sistema (gov.br)"}
      </label>
      <input
        id="at-pdf"
        ref={entrada}
        type="file"
        accept="application/pdf"
        disabled={enviando}
        className="text-sm text-ink file:mr-3 file:h-10 file:cursor-pointer file:rounded-xl file:border file:border-border file:bg-surface file:px-3 file:text-sm"
      />
      <p className="text-[13px] text-muted-foreground">Só PDF, até 4 MB.</p>
      <div>
        <button
          type="button"
          onClick={enviar}
          disabled={enviando}
          className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border border-border px-4 text-[13px] font-medium text-ink outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-brand/60 disabled:opacity-60"
        >
          {enviando ? "Enviando…" : "Guardar PDF"}
        </button>
      </div>
      <p role={aviso?.tom === "erro" ? "alert" : "status"} className={aviso?.tom === "erro" ? "min-h-5 text-[13px] text-negative" : "min-h-5 text-[13px] text-positive"}>
        {aviso?.texto ?? ""}
      </p>
    </div>
  );
}
