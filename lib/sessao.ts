import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { COOKIE_SESSAO, DURACAO_SESSAO_SEGUNDOS, criarToken, lerToken } from "@/lib/auth";
import { lerUsuario } from "@/db/usuarios";
import { temPermissao, type Permissao } from "@/core/permissoes";
import type { Sessao, SessaoToken } from "@/core/types-equipe";

/**
 * Sessão por usuário.
 * lerSessao: usuário logado ou null. exigirSessao: redireciona ao login sem sessão.
 * exigirDono: só o dono passa; gestor recebe erro de permissão.
 * exigirPermissao / verificarPermissao: o dono passa sempre; os outros, só com a permissão marcada.
 * A assinatura do cookie vale 30 dias, mas pessoa desativada (ou de empresa desativada) perde o acesso na hora (confere no banco).
 * A sessão carrega empresaId, lido do banco a cada pedido: toda consulta de dados da empresa se filtra por ele.
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
    return {
      usuarioId: usuario.id,
      nome: usuario.nome,
      papel: usuario.papel,
      empresaId: usuario.empresaId,
      superadmin: usuario.superadmin,
      permissoes: usuario.permissoes,
    };
  } catch (e) {
    // Sem o banco não há empresa para escopar os dados: a página mostra o erro em vez de adivinhar a empresa.
    console.error("[sessao] conferência no banco falhou:", e instanceof Error ? e.message : e);
    throw e;
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

/** Só o superadmin passa (administração das empresas). */
export async function exigirSuperadmin(): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (!sessao.superadmin) throw new ErroPermissao();
  return sessao;
}

export const SEM_PERMISSAO = "Você não tem permissão para isso.";

export class ErroPermissao extends Error {
  constructor() {
    super(SEM_PERMISSAO);
    this.name = "ErroPermissao";
  }
}

/** Exige a permissão; sem ela, lança ErroPermissao. Sem sessão, vai para o login. */
export async function exigirPermissao(permissao: Permissao): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (!temPermissao(sessao, permissao)) throw new ErroPermissao();
  return sessao;
}

export type ResultadoPermissao = { ok: true; sessao: Sessao } | { ok: false; erro: string; semSessao: boolean };

/** Versão sem exceção para server actions e rotas: devolve a mensagem pronta para a tela. */
export async function verificarPermissao(permissao: Permissao): Promise<ResultadoPermissao> {
  const sessao = await lerSessao();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Entre de novo.", semSessao: true };
  if (!temPermissao(sessao, permissao)) return { ok: false, erro: SEM_PERMISSAO, semSessao: false };
  return { ok: true, sessao };
}

/** Grava o cookie da sessão (usado no login). */
export async function iniciarSessao(sessao: SessaoToken): Promise<void> {
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
