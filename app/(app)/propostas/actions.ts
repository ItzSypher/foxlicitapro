"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { avisarPropostaEmRevisao, avisarPropostaRevisada } from "@/lib/avisos";
import { lerSessao } from "@/lib/sessao";
import { DadosPropostaSchema, totalProposta, validarProposta } from "@/core/proposta";
import { ehModeloId, type ModeloId } from "@/core/proposta-modelos";
import { podeGerarLink, statusAposEdicao, podeEditar, transicao, type AcaoRevisao } from "@/core/revisao";
import type { Sessao, StatusPropostaEquipe } from "@/core/types-equipe";
import { criarRascunho } from "./rascunho";
import {
  atualizarProposta,
  criarProposta,
  definirStatus,
  excluirProposta,
  gerarTokenPublico,
  lerProposta,
  revogarToken,
} from "@/db/propostas";

const SEM_SESSAO = "Sessão expirada. Entre de novo.";
const FALHA = "Não foi possível salvar agora. Tente de novo.";
const NAO_ENCONTRADA = "Proposta não encontrada.";

/** O proxy já exige sessão; aqui de novo, porque uma server action pode ser chamada por qualquer rota liberada. */
async function sessaoAtual(): Promise<Sessao | null> {
  return lerSessao();
}

const IdSchema = z.uuid();

export type RespostaSalvar =
  | { ok: true; salvoEm: string; status: StatusPropostaEquipe }
  | { ok: false; mensagem: string };

const PedidoSalvarSchema = z.object({
  id: IdSchema,
  titulo: z.string().trim().min(1).max(160),
  modelo: z.string().refine(ehModeloId),
  dados: DadosPropostaSchema,
});

export async function salvarPropostaAction(pedido: unknown): Promise<RespostaSalvar> {
  if (!(await sessaoAtual())) return { ok: false, mensagem: SEM_SESSAO };
  const lido = PedidoSalvarSchema.safeParse(pedido);
  if (!lido.success) return { ok: false, mensagem: "Há um campo com valor inválido." };
  const { id, titulo, dados } = lido.data;
  const modelo = lido.data.modelo as ModeloId;

  try {
    const atual = await lerProposta(id);
    if (!atual) return { ok: false, mensagem: NAO_ENCONTRADA };
    if (!podeEditar(atual.status)) {
      return { ok: false, mensagem: "A proposta está em revisão. Retire da revisão para editar." };
    }
    const salvoEm = await atualizarProposta(id, { titulo, modelo, dados, totalCentavos: totalProposta(dados) });
    if (!salvoEm) return { ok: false, mensagem: NAO_ENCONTRADA };

    const status = statusAposEdicao(atual.status, validarProposta(dados, modelo).length === 0);
    if (status !== atual.status) await definirStatus(id, status, status === "rascunho" ? null : undefined);
    revalidatePath("/propostas");
    return { ok: true, salvoEm: salvoEm.toISOString(), status };
  } catch {
    return { ok: false, mensagem: FALHA };
  }
}

export interface InfoRevisao {
  revisadoPorNome: string | null;
  revisaoNota: string | null;
  revisadoEm: string | null;
}

export type RespostaRevisao =
  | { ok: true; status: StatusPropostaEquipe; revisao: InfoRevisao }
  | { ok: false; mensagem: string };

const AcaoSchema = z.enum(["enviar", "aprovar", "devolver", "retirar", "reabrir"]);

/**
 * Enviar para revisão, aprovar, devolver (com nota), retirar da revisão ou reabrir uma aprovada.
 * As regras de quem pode o quê ficam em core/revisao.ts.
 */
export async function acaoRevisaoAction(id: string, acao: AcaoRevisao, nota?: string): Promise<RespostaRevisao> {
  const sessao = await sessaoAtual();
  if (!sessao) return { ok: false, mensagem: SEM_SESSAO };
  const acaoLida = AcaoSchema.safeParse(acao);
  if (!IdSchema.safeParse(id).success || !acaoLida.success) return { ok: false, mensagem: NAO_ENCONTRADA };

  try {
    const p = await lerProposta(id);
    if (!p) return { ok: false, mensagem: NAO_ENCONTRADA };

    const decisao = transicao(p.status, acaoLida.data, {
      usuarioId: sessao.usuarioId,
      criadoPor: p.criadoPor,
      autor: p.autor,
      nota,
      pendencias: acaoLida.data === "enviar" ? validarProposta(p.dados, p.modelo).length : 0,
    });
    if (!decisao.ok) return { ok: false, mensagem: decisao.erro };

    const notaFinal = acaoLida.data === "devolver" ? (nota ?? "").trim() : null;
    const revisao =
      acaoLida.data === "aprovar" || acaoLida.data === "devolver"
        ? { revisadoPor: sessao.usuarioId, nota: notaFinal }
        : null;
    const gravou = await definirStatus(id, decisao.status, revisao, p.status);
    if (!gravou) return { ok: false, mensagem: "A proposta mudou enquanto você olhava. Recarregue a página." };

    if (acaoLida.data === "enviar") {
      after(() =>
        avisarPropostaEmRevisao({ id, titulo: p.titulo, autorId: sessao.usuarioId, autorNome: sessao.nome }),
      );
    } else if (revisao) {
      after(() =>
        avisarPropostaRevisada({
          id,
          titulo: p.titulo,
          autorId: p.criadoPor,
          revisorId: sessao.usuarioId,
          revisorNome: sessao.nome,
          aprovada: acaoLida.data === "aprovar",
          nota: notaFinal,
        }),
      );
    }

    revalidatePath("/propostas");
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

export type RespostaLink =
  | { ok: true; token: string; expira: string; status: StatusPropostaEquipe }
  | { ok: false; mensagem: string };

/** Gera um link novo de 15 dias e marca a proposta como enviada. Exige proposta aprovada (ou já enviada). */
export async function gerarLinkAction(id: string): Promise<RespostaLink> {
  if (!(await sessaoAtual())) return { ok: false, mensagem: SEM_SESSAO };
  if (!IdSchema.safeParse(id).success) return { ok: false, mensagem: NAO_ENCONTRADA };
  try {
    const p = await lerProposta(id);
    if (!p) return { ok: false, mensagem: NAO_ENCONTRADA };
    if (!podeGerarLink(p.status)) {
      return { ok: false, mensagem: "A proposta precisa ser aprovada antes de ser enviada." };
    }
    const gerado = await gerarTokenPublico(id, 15);
    if (!gerado) return { ok: false, mensagem: FALHA };
    await definirStatus(id, "enviada");
    revalidatePath("/propostas");
    return { ok: true, token: gerado.token, expira: gerado.expira, status: "enviada" };
  } catch {
    return { ok: false, mensagem: "Não foi possível gerar o link agora. Tente de novo." };
  }
}

export async function revogarLinkAction(id: string): Promise<{ ok: boolean; mensagem?: string }> {
  if (!(await sessaoAtual())) return { ok: false, mensagem: SEM_SESSAO };
  if (!IdSchema.safeParse(id).success) return { ok: false, mensagem: NAO_ENCONTRADA };
  try {
    await revogarToken(id);
    return { ok: true };
  } catch {
    return { ok: false, mensagem: "Não foi possível revogar agora. Tente de novo." };
  }
}

export async function excluirPropostaAction(id: string): Promise<{ ok: false; mensagem: string }> {
  const sessao = await sessaoAtual();
  if (!sessao) return { ok: false, mensagem: SEM_SESSAO };
  if (!IdSchema.safeParse(id).success) return { ok: false, mensagem: NAO_ENCONTRADA };
  try {
    const p = await lerProposta(id);
    if (p && sessao.papel !== "dono" && p.criadoPor !== sessao.usuarioId) {
      return { ok: false, mensagem: "Só o dono ou quem criou a proposta pode excluí-la." };
    }
    await excluirProposta(id);
  } catch {
    return { ok: false, mensagem: "Não foi possível excluir agora. Tente de novo." };
  }
  revalidatePath("/propostas");
  redirect("/propostas");
}

export async function duplicarPropostaAction(id: string): Promise<{ ok: false; mensagem: string }> {
  const sessao = await sessaoAtual();
  if (!sessao) return { ok: false, mensagem: SEM_SESSAO };
  if (!IdSchema.safeParse(id).success) return { ok: false, mensagem: NAO_ENCONTRADA };
  let novoId: string;
  try {
    const p = await lerProposta(id);
    if (!p) return { ok: false, mensagem: NAO_ENCONTRADA };
    novoId = await criarProposta({
      compraId: p.compraId,
      modelo: p.modelo,
      titulo: `${p.titulo} (cópia)`.slice(0, 160),
      dados: p.dados,
      totalCentavos: totalProposta(p.dados),
      criadoPor: sessao.usuarioId,
    });
  } catch {
    return { ok: false, mensagem: "Não foi possível duplicar agora. Tente de novo." };
  }
  revalidatePath("/propostas");
  redirect(`/propostas/${novoId}`);
}

/** Cria o rascunho (com a compra, se houver) e abre o editor. Chamada pelo formulário da escolha de modelo. */
export async function criarRascunhoAction(formData: FormData): Promise<{ ok: false; mensagem: string }> {
  const sessao = await sessaoAtual();
  if (!sessao) return { ok: false, mensagem: SEM_SESSAO };
  const modeloBruto = formData.get("modelo");
  const compraBruta = formData.get("compra");
  if (!ehModeloId(modeloBruto)) return { ok: false, mensagem: "Escolha um modelo." };
  const compra = typeof compraBruta === "string" && compraBruta !== "" ? compraBruta : null;
  const criado = await criarRascunho(modeloBruto, compra, sessao.usuarioId);
  if (criado === null) return { ok: false, mensagem: "Não foi possível criar a proposta agora. Tente de novo." };
  redirect(criado.semItens ? `/propostas/${criado.id}?aviso=itens` : `/propostas/${criado.id}`);
}
