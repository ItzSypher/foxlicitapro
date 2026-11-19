"use server";

import { apagarConversa, lerConversa, listarConversas } from "@/db/conselheiro-conversas";
import { idDeConversaValido, type ConversaAberta, type ResumoConversa } from "@/lib/conselheiro/historico";
import { verificarPermissao } from "@/lib/sessao";

/** Histórico do chat: cada pessoa vê, continua e apaga só as próprias conversas. */

type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string };

const FALHA_LEITURA = "Não foi possível abrir o histórico agora. Tente de novo.";

export async function listarConversasAction(): Promise<Resultado<ResumoConversa[]>> {
  const acesso = await verificarPermissao("usar_assistente");
  if (!acesso.ok) return { ok: false, erro: acesso.erro };
  try {
    return { ok: true, dados: await listarConversas(acesso.sessao.empresaId, acesso.sessao.usuarioId) };
  } catch (e) {
    console.error("[conversas] leitura da lista falhou:", e instanceof Error ? e.name : "erro");
    return { ok: false, erro: FALHA_LEITURA };
  }
}

export async function abrirConversaAction(conversaId: string): Promise<Resultado<ConversaAberta>> {
  const acesso = await verificarPermissao("usar_assistente");
  if (!acesso.ok) return { ok: false, erro: acesso.erro };
  if (!idDeConversaValido(conversaId)) return { ok: false, erro: "Conversa não encontrada." };
  try {
    const conversa = await lerConversa(acesso.sessao.empresaId, acesso.sessao.usuarioId, conversaId);
    return conversa === null ? { ok: false, erro: "Conversa não encontrada." } : { ok: true, dados: conversa };
  } catch (e) {
    console.error("[conversas] leitura da conversa falhou:", e instanceof Error ? e.name : "erro");
    return { ok: false, erro: FALHA_LEITURA };
  }
}

export async function apagarConversaAction(conversaId: string): Promise<Resultado<null>> {
  const acesso = await verificarPermissao("usar_assistente");
  if (!acesso.ok) return { ok: false, erro: acesso.erro };
  if (!idDeConversaValido(conversaId)) return { ok: false, erro: "Conversa não encontrada." };
  try {
    const apagada = await apagarConversa(acesso.sessao.empresaId, acesso.sessao.usuarioId, conversaId);
    return apagada ? { ok: true, dados: null } : { ok: false, erro: "Conversa não encontrada." };
  } catch (e) {
    console.error("[conversas] não apagou a conversa:", e instanceof Error ? e.name : "erro");
    return { ok: false, erro: "Não foi possível apagar agora. Tente de novo." };
  }
}
