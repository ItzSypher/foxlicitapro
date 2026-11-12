"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { gerarSenhaInicial, hashSenha, verificarSenha } from "@/lib/auth";
import { exigirDono, lerSessao } from "@/lib/sessao";
import {
  EmailJaCadastrado,
  criarUsuario,
  definirAtivo,
  definirSenhaUsuario,
  lerSenhaHash,
  lerUsuario,
} from "@/db/usuarios";

export interface EstadoAdicionar {
  erro: string | null;
  /** Senha gerada, mostrada uma única vez */
  senha: string | null;
  nome: string | null;
  email: string | null;
}

export interface EstadoSenha {
  erro: string | null;
  ok: boolean;
}

export type RespostaSenha = { ok: true; senha: string } | { ok: false; erro: string };
export type RespostaSimples = { ok: true } | { ok: false; erro: string };

const SEM_PERMISSAO = "Só o dono pode fazer isso.";

const NovaPessoaSchema = z.object({
  nome: z.string().trim().min(2, "Digite o nome.").max(100),
  email: z.string().trim().toLowerCase().max(200).pipe(z.email("Digite um e-mail válido.")),
});

async function comoDono(): Promise<boolean> {
  try {
    await exigirDono();
    return true;
  } catch {
    return false;
  }
}

export async function adicionarPessoaAction(_anterior: EstadoAdicionar, dados: FormData): Promise<EstadoAdicionar> {
  const vazio: EstadoAdicionar = { erro: null, senha: null, nome: null, email: null };
  if (!(await comoDono())) return { ...vazio, erro: SEM_PERMISSAO };
  const lido = NovaPessoaSchema.safeParse({ nome: dados.get("nome"), email: dados.get("email") });
  if (!lido.success) return { ...vazio, erro: lido.error.issues[0]?.message ?? "Dados inválidos." };

  const senha = gerarSenhaInicial();
  try {
    const usuario = await criarUsuario({
      nome: lido.data.nome,
      email: lido.data.email,
      papel: "gestor",
      senhaHash: await hashSenha(senha),
    });
    revalidatePath("/equipe");
    return { erro: null, senha, nome: usuario.nome, email: usuario.email };
  } catch (e) {
    if (e instanceof EmailJaCadastrado) return { ...vazio, erro: e.message };
    console.error("[equipe]", e instanceof Error ? e.message : e);
    return { ...vazio, erro: "Não foi possível adicionar agora. Tente de novo." };
  }
}

export async function redefinirSenhaAction(id: string): Promise<RespostaSenha> {
  if (!(await comoDono())) return { ok: false, erro: SEM_PERMISSAO };
  if (!z.uuid().safeParse(id).success) return { ok: false, erro: "Pessoa não encontrada." };
  try {
    const senha = gerarSenhaInicial();
    const gravou = await definirSenhaUsuario(id, await hashSenha(senha));
    if (!gravou) return { ok: false, erro: "Pessoa não encontrada." };
    return { ok: true, senha };
  } catch (e) {
    console.error("[equipe]", e instanceof Error ? e.message : e);
    return { ok: false, erro: "Não foi possível redefinir agora. Tente de novo." };
  }
}

export async function alternarAtivoAction(id: string, ativo: boolean): Promise<RespostaSimples> {
  let dono;
  try {
    dono = await exigirDono();
  } catch {
    return { ok: false, erro: SEM_PERMISSAO };
  }
  if (!z.uuid().safeParse(id).success) return { ok: false, erro: "Pessoa não encontrada." };
  if (!ativo && id === dono.usuarioId) return { ok: false, erro: "Você não pode desativar a própria conta." };
  try {
    const alvo = await lerUsuario(id);
    if (!alvo) return { ok: false, erro: "Pessoa não encontrada." };
    const mudou = await definirAtivo(id, ativo);
    if (!mudou) return { ok: false, erro: "É preciso manter pelo menos um dono ativo." };
    revalidatePath("/equipe");
    return { ok: true };
  } catch (e) {
    console.error("[equipe]", e instanceof Error ? e.message : e);
    return { ok: false, erro: "Não foi possível alterar agora. Tente de novo." };
  }
}

const TrocaSchema = z
  .object({
    atual: z.string().min(1, "Digite a senha atual.").max(200),
    nova: z.string().min(8, "A nova senha precisa de pelo menos 8 caracteres.").max(200),
    confirmar: z.string().max(200),
  })
  .refine((d) => d.nova === d.confirmar, { message: "A confirmação não confere com a nova senha.", path: ["confirmar"] });

export async function trocarMinhaSenhaAction(_anterior: EstadoSenha, dados: FormData): Promise<EstadoSenha> {
  const sessao = await lerSessao();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Entre de novo." };
  const lido = TrocaSchema.safeParse({
    atual: dados.get("atual"),
    nova: dados.get("nova"),
    confirmar: dados.get("confirmar"),
  });
  if (!lido.success) return { ok: false, erro: lido.error.issues[0]?.message ?? "Dados inválidos." };
  try {
    const hashAtual = await lerSenhaHash(sessao.usuarioId);
    if (!hashAtual || !(await verificarSenha(lido.data.atual, hashAtual))) {
      return { ok: false, erro: "A senha atual não confere." };
    }
    await definirSenhaUsuario(sessao.usuarioId, await hashSenha(lido.data.nova));
    return { ok: true, erro: null };
  } catch (e) {
    console.error("[equipe]", e instanceof Error ? e.message : e);
    return { ok: false, erro: "Não foi possível trocar a senha agora. Tente de novo." };
  }
}
