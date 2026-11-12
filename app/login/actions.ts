"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { gastarTempoDeVerificacao, hashSenha, textosIguais, verificarSenha } from "@/lib/auth";
import { bloqueado, limparFalhas, registrarFalha } from "@/lib/limite-tentativas";
import { iniciarSessao } from "@/lib/sessao";
import { contarUsuarios, criarDonoInicial, lerCredenciais, normalizarEmail } from "@/db/usuarios";
import type { Usuario } from "@/core/types-equipe";

export interface EstadoLogin {
  erro: string | null;
}

/** Primeiro acesso: com a tabela de usuários vazia, estes dados criam o dono. */
const EMAIL_DONO = "arthurfoxinfo@gmail.com";
const NOME_DONO = "Arthur Silva Moura";

const ERRO_GENERICO = "E-mail ou senha incorretos.";

const EntradaSchema = z.object({
  email: z.string().trim().min(3).max(200),
  senha: z.string().min(1).max(200),
});

async function falhar(email: string): Promise<EstadoLogin> {
  registrarFalha(email);
  await new Promise((resolver) => setTimeout(resolver, 600));
  return { erro: ERRO_GENERICO };
}

async function autenticar(email: string, senha: string): Promise<Usuario | null> {
  if ((await contarUsuarios()) === 0) {
    const senhaInicial = process.env.APP_PASSWORD;
    if (!senhaInicial || email !== EMAIL_DONO || !textosIguais(senha, senhaInicial)) return null;
    return criarDonoInicial({ nome: NOME_DONO, email, senhaHash: await hashSenha(senha) });
  }
  const credenciais = await lerCredenciais(email);
  if (!credenciais) {
    await gastarTempoDeVerificacao(senha);
    return null;
  }
  const confere = await verificarSenha(senha, credenciais.senhaHash);
  return confere && credenciais.usuario.ativo ? credenciais.usuario : null;
}

export async function entrar(_anterior: EstadoLogin, dados: FormData): Promise<EstadoLogin> {
  if (!process.env.APP_SECRET) {
    return { erro: "Acesso não configurado no servidor." };
  }
  const lido = EntradaSchema.safeParse({ email: dados.get("email"), senha: dados.get("senha") });
  if (!lido.success) return { erro: "Digite o e-mail e a senha para entrar." };

  const email = normalizarEmail(lido.data.email);
  if (bloqueado(email)) {
    return { erro: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  }

  let usuario: Usuario | null;
  try {
    usuario = await autenticar(email, lido.data.senha);
  } catch (e) {
    console.error("[login]", e instanceof Error ? e.message : e);
    return { erro: "Não foi possível entrar agora. Tente de novo." };
  }
  if (!usuario) return falhar(email);

  limparFalhas(email);
  await iniciarSessao({ usuarioId: usuario.id, nome: usuario.nome, papel: usuario.papel });
  redirect("/radar");
}
