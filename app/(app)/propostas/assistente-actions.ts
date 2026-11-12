"use server";

import { revalidatePath } from "next/cache";
import { lerChaveCompra } from "@/core/proposta";
import { montarPropostaComAssistente, type ResultadoMontagem } from "@/lib/assistente/proposta";
import { assistenteDisponivel } from "@/lib/gemini";
import { lerSessao } from "@/lib/sessao";

/**
 * Monta a proposta da licitação com o assistente e a deixa em revisão.
 * O proxy já exige sessão; aqui de novo, porque uma server action pode ser chamada por qualquer rota liberada.
 */
export async function montarComAssistenteAction(compra: string): Promise<ResultadoMontagem> {
  const sessao = await lerSessao();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Entre de novo." };
  if (!assistenteDisponivel()) return { ok: false, erro: "O assistente ainda não está ativado." };
  const chave = lerChaveCompra(typeof compra === "string" ? compra : "");
  if (!chave) return { ok: false, erro: "Licitação inválida." };
  const resultado = await montarPropostaComAssistente(chave, sessao);
  if (resultado.ok) revalidatePath("/propostas");
  return resultado;
}
