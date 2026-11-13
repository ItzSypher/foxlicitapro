"use client";

import { useState } from "react";
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CONTROLE } from "@/components/propostas/campos";
import { TAMANHO_MAXIMO_NOTA, estaAprovada, podeRevisar, type AcaoRevisao } from "@/core/revisao";
import type { AutorProposta, StatusPropostaEquipe } from "@/core/types-equipe";
import type { AcessosProposta } from "@/components/propostas/editor";
import { cn } from "@/lib/utils";

interface Props {
  status: StatusPropostaEquipe;
  autor: AutorProposta;
  criadoPor: string | null;
  usuarioId: string;
  acessos: AcessosProposta;
  pendencias: number;
  pendente: boolean;
  aoAgir: (acao: AcaoRevisao, nota?: string) => void;
}

/** Botões do fluxo de revisão conforme o status e quem está olhando. */
export function PainelRevisao({ status, autor, criadoPor, usuarioId, acessos, pendencias, pendente, aoAgir }: Props) {
  const [devolvendo, setDevolvendo] = useState(false);
  const [nota, setNota] = useState("");
  const revisor = podeRevisar(status, { usuarioId, criadoPor, autor });
  const largo = "w-full sm:w-auto sm:self-start";

  if (status === "rascunho" || status === "devolvida") {
    if (!acessos.editar) return <p className="text-[13px] text-muted-foreground">Você pode consultar esta proposta.</p>;
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
          {acessos.editar ? (
            <button type="button" onClick={() => aoAgir("retirar")} disabled={pendente} className={cn(BOTAO_SECUNDARIO, largo)}>
              Retirar da revisão
            </button>
          ) : null}
        </div>
      );
    }
    if (!acessos.aprovar && !acessos.devolver) {
      return <p className="text-[13px] text-muted-foreground">Aguardando revisão de quem pode aprovar.</p>;
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
            {acessos.aprovar ? (
              <button type="button" onClick={() => aoAgir("aprovar")} disabled={pendente} className={cn(BOTAO_PRIMARIO, "w-full sm:w-auto")}>
                Aprovar
              </button>
            ) : null}
            {acessos.devolver ? (
              <button type="button" onClick={() => setDevolvendo(true)} disabled={pendente} className={cn(BOTAO_SECUNDARIO, "w-full sm:w-auto")}>
                Devolver
              </button>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  if (estaAprovada(status)) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-muted-foreground">
          {acessos.editar ? "Aprovada. Use Enviar para gerar o link." : "Aprovada."}
        </p>
        {acessos.aprovar ? (
          <button type="button" onClick={() => aoAgir("reabrir")} disabled={pendente} className={cn(BOTAO_SECUNDARIO, largo)}>
            Voltar para rascunho
          </button>
        ) : null}
      </div>
    );
  }

  return null;
}
