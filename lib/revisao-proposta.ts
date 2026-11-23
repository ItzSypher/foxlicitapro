import "server-only";
import { after } from "next/server";
import { podeAgirNaRevisao } from "@/core/permissoes";
import { validarProposta } from "@/core/proposta";
import type { TipoEvento } from "@/core/proposta-eventos";
import { transicao, type AcaoRevisao } from "@/core/revisao";
import type { Sessao, StatusPropostaEquipe } from "@/core/types-equipe";
import { definirStatus, lerProposta } from "@/db/propostas";
import { avisarPropostaEmRevisao, avisarPropostaRevisada } from "@/lib/avisos";
import { SEM_PERMISSAO } from "@/lib/sessao";

export interface InfoRevisao {
  revisadoPorNome: string | null;
  revisaoNota: string | null;
  revisadoEm: string | null;
}

export type ResultadoRevisao =
  | { ok: true; status: StatusPropostaEquipe; revisao: InfoRevisao }
  | { ok: false; mensagem: string };

const NAO_ENCONTRADA = "Proposta não encontrada.";
const FALHA = "Não foi possível salvar agora. Tente de novo.";

/** O que entra na linha do tempo; retirar e reabrir só voltam para rascunho. */
const EVENTO_DA_ACAO: Record<AcaoRevisao, TipoEvento | null> = {
  enviar: "revisao",
  aprovar: "aprovada",
  devolver: "devolvida",
  retirar: null,
  reabrir: null,
};

/**
 * Enviar para revisão, aprovar, devolver (com nota), retirar da revisão ou reabrir uma aprovada.
 * É o que a tela de propostas e o WhatsApp executam: as regras de quem pode o quê ficam em core/revisao.ts
 * e core/permissoes.ts. `id` já deve ser um UUID válido.
 */
export async function executarAcaoRevisao(sessao: Sessao, id: string, acao: AcaoRevisao, nota?: string): Promise<ResultadoRevisao> {
  if (!podeAgirNaRevisao(sessao, acao)) return { ok: false, mensagem: SEM_PERMISSAO };

  try {
    const p = await lerProposta(sessao.empresaId, id);
    if (!p) return { ok: false, mensagem: NAO_ENCONTRADA };

    const decisao = transicao(p.status, acao, {
      usuarioId: sessao.usuarioId,
      criadoPor: p.criadoPor,
      autor: p.autor,
      nota,
      pendencias: acao === "enviar" ? validarProposta(p.dados, p.modelo).length : 0,
    });
    if (!decisao.ok) return { ok: false, mensagem: decisao.erro };

    const notaFinal = acao === "devolver" ? (nota ?? "").trim() : null;
    const revisao = acao === "aprovar" || acao === "devolver" ? { revisadoPor: sessao.usuarioId, nota: notaFinal } : null;
    const tipoEvento = EVENTO_DA_ACAO[acao];
    const evento = tipoEvento ? { tipo: tipoEvento, por: sessao.usuarioId, nota: notaFinal } : undefined;
    const gravou = await definirStatus(sessao.empresaId, id, decisao.status, revisao, p.status, evento);
    if (!gravou) return { ok: false, mensagem: "A proposta mudou enquanto você olhava. Recarregue a página." };

    if (acao === "enviar") {
      after(() =>
        avisarPropostaEmRevisao({ empresaId: sessao.empresaId, id, titulo: p.titulo, autorId: sessao.usuarioId, autorNome: sessao.nome }),
      );
    } else if (revisao) {
      after(() =>
        avisarPropostaRevisada({
          empresaId: sessao.empresaId,
          id,
          titulo: p.titulo,
          autorId: p.criadoPor,
          revisorId: sessao.usuarioId,
          revisorNome: sessao.nome,
          aprovada: acao === "aprovar",
          nota: notaFinal,
        }),
      );
    }

    return {
      ok: true,
      status: decisao.status,
      revisao: revisao
        ? { revisadoPorNome: sessao.nome, revisaoNota: notaFinal, revisadoEm: new Date().toISOString() }
        : { revisadoPorNome: null, revisaoNota: null, revisadoEm: null },
    };
  } catch {
    return { ok: false, mensagem: FALHA };
  }
}
