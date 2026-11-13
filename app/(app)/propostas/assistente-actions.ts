"use server";

import { revalidatePath } from "next/cache";
import { lerChaveCompra } from "@/core/proposta";
import { textoRestantes, type CotaAssistente } from "@/core/limite-diario";
import { restantesHoje } from "@/lib/assistente/cota";
import { montarPropostaComAssistente, type ResultadoMontagem } from "@/lib/assistente/proposta";
import { assistenteDisponivel } from "@/lib/gemini";
import { verificarPermissao } from "@/lib/sessao";

/**
 * Monta a proposta da licitação com o assistente e a deixa em revisão.
 * O proxy já exige sessão; aqui de novo, porque uma server action pode ser chamada por qualquer rota liberada.
 * Exige as permissões de usar o assistente e de criar propostas; o limite diário é conferido em montarPropostaComAssistente.
 */
export async function montarComAssistenteAction(compra: string): Promise<ResultadoMontagem> {
  const usar = await verificarPermissao("usar_assistente");
  if (!usar.ok) return { ok: false, erro: usar.erro };
  const criar = await verificarPermissao("editar_propostas");
  if (!criar.ok) return { ok: false, erro: criar.erro };
  if (!assistenteDisponivel()) return { ok: false, erro: "O assistente ainda não está ativado." };
  const chave = lerChaveCompra(typeof compra === "string" ? compra : "");
  if (!chave) return { ok: false, erro: "Licitação inválida." };
  const resultado = await montarPropostaComAssistente(chave, usar.sessao);
  if (resultado.ok) revalidatePath("/propostas");
  return resultado;
}

export type RespostaRestantes =
  | { ok: true; ilimitada: true }
  | { ok: true; ilimitada: false; restantes: number; limite: number; texto: string }
  | { ok: false; erro: string };

/** Quantas propostas a pessoa logada ainda pode montar hoje com o assistente. Para mostrar perto do botão. */
export async function restantesHojeAction(): Promise<RespostaRestantes> {
  const v = await verificarPermissao("usar_assistente");
  if (!v.ok) return { ok: false, erro: v.erro };
  try {
    const cota: CotaAssistente = await restantesHoje(v.sessao.usuarioId);
    if (cota.ilimitada) return { ok: true, ilimitada: true };
    return { ok: true, ilimitada: false, restantes: cota.restantes, limite: cota.limite, texto: textoRestantes(cota) };
  } catch {
    return { ok: false, erro: "Não foi possível conferir o limite agora." };
  }
}
