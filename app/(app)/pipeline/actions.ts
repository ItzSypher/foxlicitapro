"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import {
  ErroRevisaoJuridica,
  adicionarComentario,
  atualizarNotas,
  definirResponsavel,
  lerObjetoItem,
  listarComentarios,
  moverItem,
  oportunidadeComScoreSchema,
  removerItem,
  salvarItem,
} from "@/db/pipeline";
import { definirPasso, listarMarcas } from "@/db/revisao-juridica";
import { lerUsuarioDaEmpresa } from "@/db/usuarios";
import { ehPassoJuridico, type MarcaJuridica } from "@/core/revisao-juridica";
import { avisarResponsavel } from "@/lib/avisos";
import { lerSessao, verificarPermissao } from "@/lib/sessao";
import type { OportunidadeComScore } from "@/core/types";
import type { ComentarioPipeline, Sessao } from "@/core/types-equipe";
import type { EtapaId, ResultadoAcao } from "@/components/pipeline/tipos";

const idSchema = z.string().min(1).max(200);
const etapaSchema = z.enum(["radar", "analisando", "cotando", "revisao_juridica", "proposta", "disputa", "ganha", "perdida"]);
const notasSchema = z.string().max(5000);
const comentarioSchema = z.string().trim().min(1).max(2000);

const ERRO_DADOS = "Dados inválidos. Recarregue a página e tente de novo.";
const SEM_SESSAO = "Sessão expirada. Entre de novo.";

function atualizarTelas(): void {
  revalidatePath("/pipeline");
  revalidatePath("/radar");
}

async function executar(
  tarefa: () => Promise<boolean>,
  mensagemFalha: string,
  naoEncontrado: string,
): Promise<ResultadoAcao> {
  try {
    const achou = await tarefa();
    if (!achou) return { ok: false, erro: naoEncontrado };
    atualizarTelas();
    return { ok: true };
  } catch (e) {
    console.error("[pipeline]", e instanceof Error ? e.message : e);
    return { ok: false, erro: mensagemFalha };
  }
}

export async function salvarNoPipeline(item: OportunidadeComScore): Promise<ResultadoAcao> {
  const v = await verificarPermissao("mover_pipeline");
  if (!v.ok) return { ok: false, erro: v.erro };
  const sessao = v.sessao;
  const lido = oportunidadeComScoreSchema.safeParse(item);
  if (!lido.success) return { ok: false, erro: ERRO_DADOS };
  return executar(
    async () => {
      await salvarItem(sessao.empresaId, lido.data, sessao.usuarioId);
      return true;
    },
    "Não foi possível salvar no pipeline. Tente de novo.",
    "Item não encontrado.",
  );
}

export async function moverEtapa(id: string, etapa: EtapaId): Promise<ResultadoAcao> {
  const v = await verificarPermissao("mover_pipeline");
  if (!v.ok) return { ok: false, erro: v.erro };
  const sessao = v.sessao;
  const i = idSchema.safeParse(id);
  const e = etapaSchema.safeParse(etapa);
  if (!i.success || !e.success) return { ok: false, erro: ERRO_DADOS };
  try {
    const achou = await moverItem(sessao.empresaId, i.data, e.data, undefined, sessao.usuarioId);
    if (!achou) return { ok: false, erro: "Esse item não está mais no pipeline." };
    atualizarTelas();
    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroRevisaoJuridica) return { ok: false, erro: erro.message };
    console.error("[pipeline]", erro instanceof Error ? erro.message : erro);
    return { ok: false, erro: "Não foi possível mover o item. Tente de novo." };
  }
}

export type RespostaRevisao = { ok: true; marcas: MarcaJuridica[] } | { ok: false; erro: string };

/** Marca ou desmarca um passo do checklist jurídico. Exige a permissão de revisão jurídica (o dono tem sempre). */
export async function marcarPassoJuridicoAction(id: string, passo: string, marcado: boolean): Promise<RespostaRevisao> {
  const v = await verificarPermissao("revisao_juridica");
  if (!v.ok) return { ok: false, erro: v.erro };
  const i = idSchema.safeParse(id);
  if (!i.success || !ehPassoJuridico(passo) || typeof marcado !== "boolean") return { ok: false, erro: ERRO_DADOS };
  try {
    const valido = await definirPasso(v.sessao.empresaId, i.data, passo, marcado, v.sessao.usuarioId);
    if (!valido) return { ok: false, erro: "O item não está mais na revisão jurídica." };
    atualizarTelas();
    return { ok: true, marcas: await listarMarcas(v.sessao.empresaId, i.data) };
  } catch (erro) {
    console.error("[pipeline]", erro instanceof Error ? erro.message : erro);
    return { ok: false, erro: "Não foi possível salvar o checklist. Tente de novo." };
  }
}

export async function removerDoPipeline(id: string): Promise<ResultadoAcao> {
  const v = await verificarPermissao("mover_pipeline");
  if (!v.ok) return { ok: false, erro: v.erro };
  const i = idSchema.safeParse(id);
  if (!i.success) return { ok: false, erro: ERRO_DADOS };
  const empresaId = v.sessao.empresaId;
  return executar(
    () => removerItem(empresaId, i.data),
    "Não foi possível remover o item. Tente de novo.",
    "Esse item não está mais no pipeline.",
  );
}

export async function salvarNotas(id: string, notas: string): Promise<ResultadoAcao> {
  const v = await verificarPermissao("mover_pipeline");
  if (!v.ok) return { ok: false, erro: v.erro };
  const i = idSchema.safeParse(id);
  const n = notasSchema.safeParse(notas);
  if (!i.success || !n.success) return { ok: false, erro: ERRO_DADOS };
  const empresaId = v.sessao.empresaId;
  return executar(
    () => atualizarNotas(empresaId, i.data, n.data),
    "Não foi possível salvar as notas. Tente de novo.",
    "Esse item não está mais no pipeline.",
  );
}

/** `responsavelId` null tira o responsável. Quem recebe o item (e não é quem atribuiu) ganha um e-mail. */
export async function definirResponsavelAction(id: string, responsavelId: string | null): Promise<ResultadoAcao> {
  const v = await verificarPermissao("mover_pipeline");
  if (!v.ok) return { ok: false, erro: v.erro };
  const sessao: Sessao = v.sessao;
  const i = idSchema.safeParse(id);
  const r = z.uuid().nullable().safeParse(responsavelId);
  if (!i.success || !r.success) return { ok: false, erro: ERRO_DADOS };

  try {
    if (r.data !== null) {
      const alvo = await lerUsuarioDaEmpresa(sessao.empresaId, r.data);
      if (!alvo || !alvo.ativo) return { ok: false, erro: "Essa pessoa não está mais na equipe." };
    }
    const resultado = await definirResponsavel(sessao.empresaId, i.data, r.data);
    if (!resultado.existe) return { ok: false, erro: "Esse item não está mais no pipeline." };
    if (resultado.mudou && r.data !== null && r.data !== sessao.usuarioId) {
      const novoResponsavel = r.data;
      after(async () => {
        const objeto = (await lerObjetoItem(sessao.empresaId, i.data)) ?? "uma oportunidade";
        await avisarResponsavel({
          empresaId: sessao.empresaId,
          itemId: i.data,
          objeto,
          responsavelId: novoResponsavel,
          porNome: sessao.nome,
        });
      });
    }
    atualizarTelas();
    return { ok: true };
  } catch (e) {
    console.error("[pipeline]", e instanceof Error ? e.message : e);
    return { ok: false, erro: "Não foi possível trocar o responsável. Tente de novo." };
  }
}

export type RespostaComentarios = { ok: true; comentarios: ComentarioPipeline[] } | { ok: false; erro: string };

export async function lerComentariosAction(id: string): Promise<RespostaComentarios> {
  const sessao = await lerSessao();
  if (!sessao) return { ok: false, erro: SEM_SESSAO };
  const i = idSchema.safeParse(id);
  if (!i.success) return { ok: false, erro: ERRO_DADOS };
  try {
    return { ok: true, comentarios: await listarComentarios(sessao.empresaId, i.data) };
  } catch (e) {
    console.error("[pipeline]", e instanceof Error ? e.message : e);
    return { ok: false, erro: "Não foi possível carregar os comentários." };
  }
}

/** Grava o comentário e devolve a lista atualizada. */
export async function comentarAction(id: string, texto: string): Promise<RespostaComentarios> {
  const sessao = await lerSessao();
  if (!sessao) return { ok: false, erro: SEM_SESSAO };
  const i = idSchema.safeParse(id);
  const t = comentarioSchema.safeParse(texto);
  if (!i.success || !t.success) return { ok: false, erro: "Escreva o comentário antes de enviar." };
  try {
    const novo = await adicionarComentario(sessao.empresaId, i.data, sessao.usuarioId, t.data);
    if (!novo) return { ok: false, erro: "Esse item não está mais no pipeline." };
    revalidatePath("/pipeline");
    return { ok: true, comentarios: await listarComentarios(sessao.empresaId, i.data) };
  } catch (e) {
    console.error("[pipeline]", e instanceof Error ? e.message : e);
    return { ok: false, erro: "Não foi possível comentar agora. Tente de novo." };
  }
}
