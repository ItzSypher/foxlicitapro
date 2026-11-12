import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { COOKIE_SESSAO, DURACAO_SESSAO_SEGUNDOS, criarToken, lerToken } from "@/lib/auth";
import { lerUsuario } from "@/db/usuarios";
import type { Sessao } from "@/core/types-equipe";

/**
 * Sessão por usuário.
 * lerSessao: usuário logado ou null. exigirSessao: redireciona ao login sem sessão.
 * exigirDono: só o dono passa; gestor recebe erro de permissão.
 * A assinatura do cookie vale 30 dias, mas pessoa desativada perde o acesso na hora (confere no banco).
 */
const sessaoDoPedido = cache(async (): Promise<Sessao | null> => {
  const jar = await cookies();
  // O relógio só pode ser lido depois de um acesso dinâmico (cacheComponents).
  await connection();
  const sessao = await lerToken(jar.get(COOKIE_SESSAO)?.value, process.env.APP_SECRET, Date.now());
  if (!sessao) return null;
  try {
    const usuario = await lerUsuario(sessao.usuarioId);
    if (!usuario || !usuario.ativo) return null;
    return { usuarioId: usuario.id, nome: usuario.nome, papel: usuario.papel };
  } catch (e) {
    // Banco fora do ar: mantém a sessão assinada para não prender ninguém num laço de login.
    console.error("[sessao] conferência no banco falhou:", e instanceof Error ? e.message : e);
    return sessao;
  }
});

export async function lerSessao(): Promise<Sessao | null> {
  return sessaoDoPedido();
}

export async function exigirSessao(): Promise<Sessao> {
  const sessao = await sessaoDoPedido();
  if (!sessao) redirect("/login/sair");
  return sessao;
}

export async function exigirDono(): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (sessao.papel !== "dono") throw new Error("Apenas o dono pode fazer isso.");
  return sessao;
}

/** Grava o cookie da sessão (usado no login). */
export async function iniciarSessao(sessao: Sessao): Promise<void> {
  const segredo = process.env.APP_SECRET;
  if (!segredo) throw new Error("APP_SECRET não definido");
  const jar = await cookies();
  jar.set(COOKIE_SESSAO, await criarToken(segredo, sessao), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SESSAO_SEGUNDOS,
  });
}

export async function encerrarSessao(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_SESSAO);
}
