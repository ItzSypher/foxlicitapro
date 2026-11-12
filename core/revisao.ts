import type { AutorProposta, StatusPropostaEquipe } from "@/core/types-equipe";

/**
 * Regras do fluxo de revisão de propostas (funções puras, sem banco).
 * rascunho/devolvida -> enviar -> em_revisao -> aprovar | devolver.
 * "pronta" é o nome antigo de "aprovada": dados antigos continuam valendo.
 */

export type AcaoRevisao = "enviar" | "aprovar" | "devolver" | "retirar" | "reabrir";

export interface ContextoRevisao {
  /** Quem está agindo */
  usuarioId: string;
  /** Quem criou a proposta (null para propostas antigas ou de pessoa removida) */
  criadoPor: string | null;
  autor: AutorProposta;
  nota?: string;
  /** Quantidade de pendências de preenchimento; só importa ao enviar */
  pendencias?: number;
}

export type ResultadoTransicao = { ok: true; status: StatusPropostaEquipe } | { ok: false; erro: string };

export const TAMANHO_MAXIMO_NOTA = 1000;

export const ROTULO_STATUS: Record<StatusPropostaEquipe, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  aprovada: "Aprovada",
  devolvida: "Devolvida",
  pronta: "Pronta",
  enviada: "Enviada",
};

export function ehStatusEquipe(valor: string): valor is StatusPropostaEquipe {
  return Object.hasOwn(ROTULO_STATUS, valor);
}

/** Aprovada ou, nos dados antigos, pronta. */
export function estaAprovada(status: StatusPropostaEquipe): boolean {
  return status === "aprovada" || status === "pronta";
}

/** O link público só sai depois da aprovação (ou de um envio anterior). */
export function podeGerarLink(status: StatusPropostaEquipe): boolean {
  return estaAprovada(status) || status === "enviada";
}

/** Em revisão a proposta fica travada para o autor não mexer no que o revisor está lendo. */
export function podeEditar(status: StatusPropostaEquipe): boolean {
  return status !== "em_revisao";
}

/** Quem não é o autor revisa; se a proposta é do assistente (ou sem autor conhecido), qualquer um revisa. */
export function podeRevisar(
  status: StatusPropostaEquipe,
  p: { usuarioId: string; criadoPor: string | null; autor: AutorProposta },
): boolean {
  if (status !== "em_revisao") return false;
  return p.autor === "assistente" || p.criadoPor === null || p.criadoPor !== p.usuarioId;
}

/** Status depois de salvar uma edição: o que já foi aprovado precisa de nova revisão. */
export function statusAposEdicao(status: StatusPropostaEquipe, dadosValidos: boolean): StatusPropostaEquipe {
  if (estaAprovada(status)) return "rascunho";
  if (status === "enviada" && !dadosValidos) return "rascunho";
  return status;
}

export function transicao(
  status: StatusPropostaEquipe,
  acao: AcaoRevisao,
  ctx: ContextoRevisao,
): ResultadoTransicao {
  switch (acao) {
    case "enviar": {
      if (status !== "rascunho" && status !== "devolvida") {
        return { ok: false, erro: "Só rascunho ou proposta devolvida vai para revisão." };
      }
      if ((ctx.pendencias ?? 0) > 0) {
        return { ok: false, erro: "Resolva as pendências antes de enviar para revisão." };
      }
      return { ok: true, status: "em_revisao" };
    }
    case "aprovar":
    case "devolver": {
      if (status !== "em_revisao") return { ok: false, erro: "A proposta não está em revisão." };
      if (!podeRevisar(status, ctx)) {
        return { ok: false, erro: "Quem criou a proposta não pode revisá-la." };
      }
      if (acao === "devolver") {
        const nota = (ctx.nota ?? "").trim();
        if (nota === "") return { ok: false, erro: "Escreva o que precisa mudar para devolver." };
        if (nota.length > TAMANHO_MAXIMO_NOTA) return { ok: false, erro: "A nota está longa demais." };
        return { ok: true, status: "devolvida" };
      }
      return { ok: true, status: "aprovada" };
    }
    case "retirar": {
      if (status !== "em_revisao") return { ok: false, erro: "A proposta não está em revisão." };
      const ehAutor = ctx.criadoPor === null || ctx.criadoPor === ctx.usuarioId;
      if (!ehAutor && ctx.autor !== "assistente") {
        return { ok: false, erro: "Só quem criou a proposta pode retirá-la da revisão." };
      }
      return { ok: true, status: "rascunho" };
    }
    case "reabrir": {
      if (!estaAprovada(status)) return { ok: false, erro: "Só proposta aprovada volta para rascunho." };
      return { ok: true, status: "rascunho" };
    }
  }
}
