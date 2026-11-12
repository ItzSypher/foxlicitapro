/**
 * Limite simples de tentativas de login, em memória: 5 falhas por e-mail a cada 15 minutos.
 * Com várias instâncias o limite vale por instância, o que basta para duas pessoas.
 */
export const MAX_TENTATIVAS = 5;
export const JANELA_MS = 15 * 60 * 1000;

const falhas = new Map<string, number[]>();

function recentes(chave: string, agora: number): number[] {
  const lista = (falhas.get(chave) ?? []).filter((t) => agora - t < JANELA_MS);
  if (lista.length === 0) falhas.delete(chave);
  else falhas.set(chave, lista);
  return lista;
}

export function bloqueado(chave: string, agora: number = Date.now()): boolean {
  return recentes(chave, agora).length >= MAX_TENTATIVAS;
}

export function registrarFalha(chave: string, agora: number = Date.now()): void {
  const lista = recentes(chave, agora);
  lista.push(agora);
  falhas.set(chave, lista);
  if (falhas.size > 2000) {
    for (const k of [...falhas.keys()]) recentes(k, agora);
  }
}

export function limparFalhas(chave: string): void {
  falhas.delete(chave);
}
