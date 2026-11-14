"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Mail, MessageCircle, Share2 } from "lucide-react";
import { gerarLinkAction, revogarLinkAction } from "@/app/(app)/propostas/actions";
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CONTROLE } from "@/components/propostas/campos";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Emitente } from "@/core/proposta-emitente";
import { podeGerarLink } from "@/core/revisao";
import type { StatusPropostaEquipe } from "@/core/types-equipe";

export interface LinkPublico {
  token: string;
  /** ISO 8601 */
  expira: string;
}

interface Props {
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
  propostaId: string;
  titulo: string;
  orgao: string;
  objeto: string;
  status: StatusPropostaEquipe;
  link: LinkPublico | null;
  aoMudarLink: (link: LinkPublico | null, status?: StatusPropostaEquipe) => void;
  /** Grava as edições pendentes antes de gerar o link */
  aoSalvar: () => Promise<boolean>;
  emitente: Emitente;
}

const dataFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function dia(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dataFmt.format(d);
}

export function FolhaEnviar({ aberto, aoMudar, propostaId, titulo, orgao, objeto, status, link, aoMudarLink, aoSalvar, emitente }: Props) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const origem = typeof window === "undefined" ? "" : window.location.origin;
  const url = link ? `${origem}/p/${link.token}` : "";
  const podeCompartilhar = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const assunto = `Proposta comercial - ${emitente.razaoSocial}`;
  const referencia = objeto.trim() !== "" ? objeto.trim() : orgao.trim();
  const validade = link ? dia(link.expira) : "";
  const mensagemZap = `Olá! Segue a proposta comercial da ${emitente.razaoSocial}${orgao.trim() !== "" ? ` para ${orgao.trim()}` : ""}: ${url}`;
  const corpoEmail = [
    "Prezados,",
    "",
    `Segue o link da proposta comercial${referencia !== "" ? ` referente a ${referencia}` : ""}:`,
    url,
    "",
    `O link fica disponível até ${validade}.`,
    "",
    "Atenciosamente,",
    emitente.responsavel,
    emitente.razaoSocial,
    `CNPJ ${emitente.cnpj}`,
    emitente.telefone,
  ]
    .filter((linha) => linha !== "")
    .join("\n");

  function gerar() {
    setErro(null);
    iniciar(async () => {
      const salvo = await aoSalvar();
      if (!salvo) {
        setErro("Não foi possível salvar as alterações. Tente de novo.");
        return;
      }
      const r = await gerarLinkAction(propostaId);
      if (r.ok) aoMudarLink({ token: r.token, expira: r.expira }, r.status);
      else setErro(r.mensagem);
    });
  }

  function revogar() {
    setErro(null);
    iniciar(async () => {
      const r = await revogarLinkAction(propostaId);
      if (r.ok) aoMudarLink(null);
      else setErro(r.mensagem ?? "Não foi possível revogar agora.");
    });
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErro("Não deu para copiar. Selecione o link e copie à mão.");
    }
  }

  async function compartilhar() {
    try {
      await navigator.share({ title: titulo, text: mensagemZap, url });
    } catch {
      // o usuário fechou a folha de compartilhamento
    }
  }

  const bloqueada = !podeGerarLink(status);

  return (
    <Sheet open={aberto} onOpenChange={aoMudar}>
      <SheetContent side="right" className="gap-0">
        <SheetHeader className="pr-14">
          <SheetTitle>Enviar proposta</SheetTitle>
          <SheetDescription>O destinatário abre o link e baixa o PDF. Não precisa de senha.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {bloqueada && !link && (
            <p className="rounded-card border border-border bg-raised px-3 py-2.5 text-[13px] text-muted-foreground">
              A proposta precisa ser aprovada na revisão para gerar o link.
            </p>
          )}

          {!link ? (
            <button type="button" onClick={gerar} disabled={pendente || bloqueada} className={BOTAO_PRIMARIO}>
              {pendente ? "Gerando…" : "Gerar link"}
            </button>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="link-publico" className="text-[13px] font-medium text-ink">
                  Link da proposta
                </label>
                <input
                  id="link-publico"
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  className={`${CONTROLE} text-sm`}
                />
                <p className="text-[13px] text-muted-foreground">Válido por 15 dias, até {validade}.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={copiar} className={BOTAO_SECUNDARIO}>
                  {copiado ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
                  {copiado ? "Copiado" : "Copiar"}
                </button>
                {podeCompartilhar && (
                  <button type="button" onClick={compartilhar} className={BOTAO_SECUNDARIO}>
                    <Share2 aria-hidden className="size-4" />
                    Compartilhar
                  </button>
                )}
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(mensagemZap)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={BOTAO_SECUNDARIO}
                >
                  <MessageCircle aria-hidden className="size-4" />
                  WhatsApp
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpoEmail)}`}
                  className={BOTAO_SECUNDARIO}
                >
                  <Mail aria-hidden className="size-4" />
                  E-mail
                </a>
              </div>

              <button
                type="button"
                onClick={revogar}
                disabled={pendente}
                className="inline-flex h-11 items-center justify-center rounded-control px-3 text-sm font-medium text-negative underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
              >
                {pendente ? "Revogando…" : "Revogar link"}
              </button>
            </>
          )}

          {erro && (
            <p role="alert" className="text-[13px] text-negative">
              {erro}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
