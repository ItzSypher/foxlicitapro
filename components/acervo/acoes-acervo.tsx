"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { excluirAcervoAction } from "@/app/(app)/acervo/actions";
import type { DocumentoAcervo } from "@/core/acervo";
import { BOTAO_PRIMARIO } from "@/components/fornecedores/estilo";
import { FolhaAcervo } from "./folha-acervo";

/** Botão "Adicionar" do cabeçalho: abre a folha com o formulário em branco. */
export function BotaoAdicionarAcervo({ rotulo = "Adicionar" }: { rotulo?: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={`${BOTAO_PRIMARIO} shrink-0 gap-2`}>
        <Plus aria-hidden="true" className="size-4" />
        {rotulo}
      </button>
      <FolhaAcervo aberto={aberto} aoMudar={setAberto} documento={null} />
    </>
  );
}

const BOTAO_DISCRETO =
  "inline-flex h-10 items-center gap-1.5 rounded-control px-3 text-sm text-muted-foreground outline-none hover:bg-raised hover:text-ink focus-visible:ring-2 focus-visible:ring-brand";

/** Editar e excluir (com confirmação) de um cartão. Só aparece para quem pode mexer no acervo. */
export function AcoesDocumentoAcervo({ documento }: { documento: DocumentoAcervo }) {
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, iniciar] = useTransition();

  function excluir(): void {
    setErro(null);
    iniciar(async () => {
      const r = await excluirAcervoAction(documento.id);
      if (!r.ok) {
        setErro(r.erro);
        setConfirmando(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {confirmando ? (
        <div role="group" aria-label="Confirmar exclusão" className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink">Excluir este documento? Não dá para desfazer.</span>
          <button
            type="button"
            onClick={excluir}
            disabled={excluindo}
            className="inline-flex h-10 items-center rounded-control bg-negative px-3 text-sm font-medium text-black outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
          >
            {excluindo ? "Excluindo..." : "Sim, excluir"}
          </button>
          <button type="button" onClick={() => setConfirmando(false)} disabled={excluindo} className={BOTAO_DISCRETO}>
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setEditando(true)} className={BOTAO_DISCRETO}>
            <Pencil aria-hidden="true" className="size-4" />
            Editar
            <span className="sr-only"> {documento.titulo}</span>
          </button>
          <button type="button" onClick={() => setConfirmando(true)} className={BOTAO_DISCRETO}>
            <Trash2 aria-hidden="true" className="size-4" />
            Excluir
            <span className="sr-only"> {documento.titulo}</span>
          </button>
        </div>
      )}
      {erro ? (
        <p role="alert" className="text-sm text-negative">
          {erro}
        </p>
      ) : null}
      {editando ? <FolhaAcervo aberto={editando} aoMudar={setEditando} documento={documento} /> : null}
    </div>
  );
}
