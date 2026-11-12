"use client";

import { useState } from "react";
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CONTROLE } from "@/components/propostas/campos";
import { TAMANHO_MAXIMO_NOTA, estaAprovada, podeRevisar, type AcaoRevisao } from "@/core/revisao";
import type { AutorProposta, StatusPropostaEquipe } from "@/core/types-equipe";
import { cn } from "@/lib/utils";

interface Props {
  status: StatusPropostaEquipe;
  autor: AutorProposta;
  criadoPor: string | null;
  usuarioId: string;
  pendencias: number;
  pendente: boolean;
  aoAgir: (acao: AcaoRevisao, nota?: string) => void;
}

/** Botões do fluxo de revisão conforme o status e quem está olhando. */
export function PainelRevisao({ status, autor, criadoPor, usuarioId, pendencias, pendente, aoAgir }: Props) {
  const [devolvendo, setDevolvendo] = useState(false);
  const [nota, setNota] = useState("");
  const revisor = podeRevisar(status, { usuarioId, criadoPor, autor });
  const largo = "w-full sm:w-auto sm:self-start";

  if (status === "rascunho" || status === "devolvida") {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => aoAgir("enviar")}
          disabled={pendencias > 0 || pendente}
          className={cn(BOTAO_PRIMARIO, largo)}
        >
          {status === "devolvida" ? "Reenviar para revisão" : "Enviar para revisão"}
        </button>
        {pendencias > 0 ? (
          <p className="text-[13px] text-muted-foreground">Resolva as pendências para enviar.</p>
        ) : null}
      </div>
    );
  }

  if (status === "em_revisao") {
    if (!revisor) {
      return (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-muted-foreground">Quem criou a proposta não a revisa. Ela aguarda outra pessoa.</p>
          <button type="button" onClick={() => aoAgir("retirar")} disabled={pendente} className={cn(BOTAO_SECUNDARIO, largo)}>
            Retirar da revisão
          </button>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-3">
        {devolvendo ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="nota-devolucao" className="text-[13px] font-medium text-ink">
              O que precisa mudar
            </label>
            <textarea
              id="nota-devolucao"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={3}
              maxLength={TAMANHO_MAXIMO_NOTA}
              className={cn(CONTROLE, "h-auto min-h-11 resize-y py-2.5 leading-snug")}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => aoAgir("devolver", nota)}
                disabled={nota.trim() === "" || pendente}
                className={cn(BOTAO_PRIMARIO, "w-full sm:w-auto")}
              >
                Devolver proposta
              </button>
              <button type="button" onClick={() => setDevolvendo(false)} className={cn(BOTAO_SECUNDARIO, "w-full sm:w-auto")}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => aoAgir("aprovar")} disabled={pendente} className={cn(BOTAO_PRIMARIO, "w-full sm:w-auto")}>
              Aprovar
            </button>
            <button type="button" onClick={() => setDevolvendo(true)} disabled={pendente} className={cn(BOTAO_SECUNDARIO, "w-full sm:w-auto")}>
              Devolver
            </button>
          </div>
        )}
      </div>
    );
  }

  if (estaAprovada(status)) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-muted-foreground">Aprovada. Use Enviar para gerar o link.</p>
        <button type="button" onClick={() => aoAgir("reabrir")} disabled={pendente} className={cn(BOTAO_SECUNDARIO, largo)}>
          Voltar para rascunho
        </button>
      </div>
    );
  }

  return null;
}
