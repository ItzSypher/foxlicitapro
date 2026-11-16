"use server";

import { revalidatePath } from "next/cache";
import { temPermissao } from "@/core/permissoes";
import { analisarItemDoPipeline, MENSAGEM_SEM_CHAVE, type ResultadoAnalise } from "@/lib/conselheiro/analisar";
import { assistenteDisponivel } from "@/lib/gemini";
import { SEM_PERMISSAO, lerSessao } from "@/lib/sessao";

/**
 * Pede ao conselheiro a análise de um item do Pipeline.
 * Todos que veem o Pipeline leem as análises; pedir uma exige poder mexer no pipeline ou fazer revisão jurídica.
 * O limite diário é conferido em analisarItemDoPipeline.
 */
export async function analisarComConselheiroAction(itemId: string): Promise<ResultadoAnalise> {
  const sessao = await lerSessao();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Entre de novo." };
  if (!temPermissao(sessao, "mover_pipeline") && !temPermissao(sessao, "revisao_juridica")) {
    return { ok: false, erro: SEM_PERMISSAO };
  }
  if (!assistenteDisponivel()) return { ok: false, erro: MENSAGEM_SEM_CHAVE };
  const id = typeof itemId === "string" ? itemId.trim() : "";
  if (id === "" || id.length > 200) return { ok: false, erro: "Item inválido." };
  const resultado = await analisarItemDoPipeline(id, sessao);
  if (resultado.ok) revalidatePath("/conselheiro");
  return resultado;
}
