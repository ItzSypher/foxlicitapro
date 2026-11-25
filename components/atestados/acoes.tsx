"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cancelarAtestadoAction, gerarLinkAction } from "@/app/(app)/atestados/actions";
import { podeCancelar, podeGerarLink, type StatusAtestado } from "@/core/atestados";

const BOTAO =
  "inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border border-border px-3 text-[13px] font-medium text-ink outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-brand/60 disabled:cursor-not-allowed disabled:opacity-60";

interface Props {
  id: string;
  status: StatusAtestado;
  /** Link já existente e dentro do prazo */
  linkInicial: { url: string; whatsapp: string } | null;
  podeEditar: boolean;
  /** Mostra o botão Ver (na lista; na própria tela do atestado não) */
  mostrarVer?: boolean;
}

/** Copiar link, enviar pelo WhatsApp, ver, imprimir e cancelar. O link é gerado sob demanda. */
export function AcoesAtestado({ id, status, linkInicial, podeEditar, mostrarVer = true }: Props) {
  const router = useRouter();
  const [link, setLink] = useState(linkInicial);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  function gerar(): void {
    setAviso(null);
    iniciar(async () => {
      const r = await gerarLinkAction(id);
      if (!r.ok) {
        setAviso(r.erro);
        return;
      }
      setLink({ url: r.url, whatsapp: r.whatsapp });
      router.refresh();
    });
  }

  async function copiar(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setAviso("Link copiado.");
    } catch {
      setAviso(`Copie manualmente: ${url}`);
    }
  }

  function cancelar(): void {
    if (!window.confirm("Cancelar este atestado? O link enviado ao cliente deixa de valer.")) return;
    setAviso(null);
    iniciar(async () => {
      const r = await cancelarAtestadoAction(id);
      if (!r.ok) {
        setAviso(r.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        {mostrarVer ? (
          <Link href={`/atestados/${id}`} className={BOTAO}>
            Ver
          </Link>
        ) : null}
        {podeEditar && podeGerarLink(status) ? (
          link ? (
            <>
              <button type="button" onClick={() => void copiar(link.url)} className={BOTAO}>
                Copiar link
              </button>
              <a href={link.whatsapp} target="_blank" rel="noopener noreferrer" className={BOTAO}>
                Enviar pelo WhatsApp
              </a>
            </>
          ) : (
            <button type="button" onClick={gerar} disabled={ocupado} className={BOTAO}>
              {ocupado ? "Gerando…" : "Gerar link para o cliente"}
            </button>
          )
        ) : null}
        {status !== "cancelado" ? (
          <Link href={`/atestados/${id}/imprimir`} className={BOTAO}>
            Imprimir
          </Link>
        ) : null}
        {podeEditar && podeCancelar(status) ? (
          <button type="button" onClick={cancelar} disabled={ocupado} className={`${BOTAO} text-negative`}>
            Cancelar
          </button>
        ) : null}
      </div>
      <p role="status" className="min-h-4 text-xs break-all text-muted-foreground">
        {aviso ?? ""}
      </p>
    </div>
  );
}
