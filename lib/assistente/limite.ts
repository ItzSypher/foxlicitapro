/**
 * Limite simples do chat, em memória: 30 mensagens por usuário a cada hora.
 * Com várias instâncias o limite vale por instância, o que basta para duas pessoas.
 */
export const MAX_MENSAGENS_POR_HORA = 30;
export const JANELA_MS = 60 * 60 * 1000;

const usos = new Map<string, number[]>();

function recentes(usuarioId: string, agora: number): number[] {
  const lista = (usos.get(usuarioId) ?? []).filter((t) => agora - t < JANELA_MS);
  if (lista.length === 0) usos.delete(usuarioId);
  else usos.set(usuarioId, lista);
  return lista;
}

export type ResultadoLimite = { permitido: true; restantes: number } | { permitido: false; tentarEmMs: number };

/** Conta uma mensagem se ainda houver cota; recusada, não consome nada. */
export function registrarMensagem(usuarioId: string, agora: number = Date.now()): ResultadoLimite {
  const lista = recentes(usuarioId, agora);
  if (lista.length >= MAX_MENSAGENS_POR_HORA) {
    return { permitido: false, tentarEmMs: Math.max(0, JANELA_MS - (agora - lista[0])) };
  }
  lista.push(agora);
  usos.set(usuarioId, lista);
  if (usos.size > 2000) {
    for (const id of [...usos.keys()]) recentes(id, agora);
  }
  return { permitido: true, restantes: MAX_MENSAGENS_POR_HORA - lista.length };
}

export function limparLimites(): void {
  usos.clear();
}
