"use server";

import { normalizarTexto } from "@/core/cnae-keywords";
import { MAX_PALAVRAS_SALVAS, MAX_TAMANHO_PALAVRA, adicionarPalavraChave, listarPalavrasChave, removerPalavraChave } from "@/db/palavras-chave";
import { lerSessao } from "@/lib/sessao";

export type RespostaPalavras = { ok: true; palavras: string[] } | { ok: false; erro: string };

const SEM_SESSAO = "Sessão expirada. Entre de novo.";
const FALHA = "Não foi possível salvar agora. Tente de novo.";

/** Palavras-chave são pessoais: cada pessoa mexe só nas próprias, sem precisar de permissão extra. */
export async function adicionarPalavraAction(texto: string): Promise<RespostaPalavras> {
  const sessao = await lerSessao();
  if (!sessao) return { ok: false, erro: SEM_SESSAO };
  const termo = normalizarTexto(typeof texto === "string" ? texto.slice(0, 200) : "");
  if (termo === "") return { ok: false, erro: "Digite uma palavra." };
  if (termo.length > MAX_TAMANHO_PALAVRA) return { ok: false, erro: "Palavra longa demais." };
  try {
    const coube = await adicionarPalavraChave(sessao.usuarioId, termo);
    if (!coube) return { ok: false, erro: `Você pode guardar até ${MAX_PALAVRAS_SALVAS} palavras. Remova alguma antes.` };
    return { ok: true, palavras: await listarPalavrasChave(sessao.usuarioId) };
  } catch (e) {
    console.error("[radar] palavra-chave:", e instanceof Error ? e.message : e);
    return { ok: false, erro: FALHA };
  }
}

export async function removerPalavraAction(texto: string): Promise<RespostaPalavras> {
  const sessao = await lerSessao();
  if (!sessao) return { ok: false, erro: SEM_SESSAO };
  const termo = normalizarTexto(typeof texto === "string" ? texto.slice(0, 200) : "");
  try {
    if (termo !== "") await removerPalavraChave(sessao.usuarioId, termo);
    return { ok: true, palavras: await listarPalavrasChave(sessao.usuarioId) };
  } catch (e) {
    console.error("[radar] palavra-chave:", e instanceof Error ? e.message : e);
    return { ok: false, erro: FALHA };
  }
}
