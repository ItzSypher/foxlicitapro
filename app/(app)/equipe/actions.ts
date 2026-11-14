"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { gerarSenhaInicial, hashSenha, verificarSenha } from "@/lib/auth";
import { exigirDono, lerSessao } from "@/lib/sessao";
import { PAPEIS, normalizarPermissoes, ehPermissao } from "@/core/permissoes";
import type { Papel, Sessao } from "@/core/types-equipe";
import {
  EmailJaCadastrado,
  atualizarAcessos,
  criarUsuario,
  definirAtivo,
  definirSenhaUsuario,
  lerSenhaHash,
  lerUsuarioDaEmpresa,
} from "@/db/usuarios";

export interface EstadoAdicionar {
  erro: string | null;
  /** Senha gerada, mostrada uma única vez (null quando o dono digitou a senha) */
  senha: string | null;
  nome: string | null;
  email: string | null;
  /** Pessoa criada com a senha digitada pelo dono */
  criada: boolean;
}

export interface EstadoSenha {
  erro: string | null;
  ok: boolean;
}

export type RespostaSenha = { ok: true; senha: string } | { ok: false; erro: string };
export type RespostaSimples = { ok: true } | { ok: false; erro: string };

const SEM_PERMISSAO = "Só o dono pode fazer isso.";

const PapelSchema = z.enum(PAPEIS as [string, ...string[]], "Escolha o papel.");
const PermissoesSchema = z.array(z.string().refine(ehPermissao)).max(20);
const LimiteSchema = z.coerce.number("Informe o limite diário.").int("Informe o limite diário.").min(0, "O limite não pode ser negativo.").max(100, "O limite máximo é 100.");

const NovaPessoaSchema = z.object({
  nome: z.string().trim().min(2, "Digite o nome.").max(100),
  email: z.string().trim().toLowerCase().max(200).pipe(z.email("Digite um e-mail válido.")),
  papel: PapelSchema,
  permissoes: PermissoesSchema,
  limite: LimiteSchema,
});

const SenhaDigitadaSchema = z
  .object({
    senha: z.string().min(8, "A senha precisa de pelo menos 8 caracteres.").max(200),
    confirmar: z.string().max(200),
  })
  .refine((d) => d.senha === d.confirmar, { message: "A confirmação não confere com a senha.", path: ["confirmar"] });

function textoDe(valor: FormDataEntryValue | null): string {
  return typeof valor === "string" ? valor : "";
}

async function comoDono(): Promise<Sessao | null> {
  try {
    return await exigirDono();
  } catch {
    return null;
  }
}

export async function adicionarPessoaAction(_anterior: EstadoAdicionar, dados: FormData): Promise<EstadoAdicionar> {
  const vazio: EstadoAdicionar = { erro: null, senha: null, nome: null, email: null, criada: false };
  const dono = await comoDono();
  if (!dono) return { ...vazio, erro: SEM_PERMISSAO };
  const lido = NovaPessoaSchema.safeParse({
    nome: dados.get("nome"),
    email: dados.get("email"),
    papel: dados.get("papel"),
    permissoes: dados.getAll("permissoes").map(textoDe),
    limite: dados.get("limite"),
  });
  if (!lido.success) return { ...vazio, erro: lido.error.issues[0]?.message ?? "Dados inválidos." };

  const digitar = dados.get("modoSenha") === "digitar";
  let senha: string;
  if (digitar) {
    const digitada = SenhaDigitadaSchema.safeParse({ senha: textoDe(dados.get("senha")), confirmar: textoDe(dados.get("confirmar")) });
    if (!digitada.success) return { ...vazio, erro: digitada.error.issues[0]?.message ?? "Senha inválida." };
    senha = digitada.data.senha;
  } else {
    senha = gerarSenhaInicial();
  }
  try {
    const usuario = await criarUsuario({
      empresaId: dono.empresaId,
      nome: lido.data.nome,
      email: lido.data.email,
      papel: lido.data.papel as Papel,
      permissoes: normalizarPermissoes(lido.data.permissoes),
      limitePropostasAssistenteDia: lido.data.limite,
      senhaHash: await hashSenha(senha),
    });
    revalidatePath("/equipe");
    return { erro: null, senha: digitar ? null : senha, nome: usuario.nome, email: usuario.email, criada: true };
  } catch (e) {
    if (e instanceof EmailJaCadastrado) return { ...vazio, erro: e.message };
    console.error("[equipe]", e instanceof Error ? e.message : e);
    return { ...vazio, erro: "Não foi possível adicionar agora. Tente de novo." };
  }
}

export async function redefinirSenhaAction(id: string): Promise<RespostaSenha> {
  const dono = await comoDono();
  if (!dono) return { ok: false, erro: SEM_PERMISSAO };
  if (!z.uuid().safeParse(id).success) return { ok: false, erro: "Pessoa não encontrada." };
  try {
    const senha = gerarSenhaInicial();
    const gravou = await definirSenhaUsuario(dono.empresaId, id, await hashSenha(senha));
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
    const alvo = await lerUsuarioDaEmpresa(dono.empresaId, id);
    if (!alvo) return { ok: false, erro: "Pessoa não encontrada." };
    const mudou = await definirAtivo(dono.empresaId, id, ativo);
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
    await definirSenhaUsuario(sessao.empresaId, sessao.usuarioId, await hashSenha(lido.data.nova));
    return { ok: true, erro: null };
  } catch (e) {
    console.error("[equipe]", e instanceof Error ? e.message : e);
    return { ok: false, erro: "Não foi possível trocar a senha agora. Tente de novo." };
  }
}

const AcessosSchema = z.object({
  papel: PapelSchema,
  permissoes: PermissoesSchema,
  limite: LimiteSchema,
});

/** O dono troca papel, permissões e limite diário do assistente de quem já existe. */
export async function atualizarAcessosAction(
  id: string,
  entrada: { papel: string; permissoes: string[]; limite: number },
): Promise<RespostaSimples> {
  let dono;
  try {
    dono = await exigirDono();
  } catch {
    return { ok: false, erro: SEM_PERMISSAO };
  }
  if (!z.uuid().safeParse(id).success) return { ok: false, erro: "Pessoa não encontrada." };
  const lido = AcessosSchema.safeParse({ papel: entrada.papel, permissoes: entrada.permissoes, limite: entrada.limite });
  if (!lido.success) return { ok: false, erro: lido.error.issues[0]?.message ?? "Dados inválidos." };
  if (id === dono.usuarioId && lido.data.papel !== "dono") {
    return { ok: false, erro: "Você não pode tirar o próprio papel de dono." };
  }
  try {
    const alvo = await lerUsuarioDaEmpresa(dono.empresaId, id);
    if (!alvo) return { ok: false, erro: "Pessoa não encontrada." };
    const gravou = await atualizarAcessos(dono.empresaId, id, {
      papel: lido.data.papel as Papel,
      permissoes: normalizarPermissoes(lido.data.permissoes),
      limitePropostasAssistenteDia: lido.data.limite,
    });
    if (!gravou) return { ok: false, erro: "É preciso manter pelo menos um dono ativo." };
    revalidatePath("/equipe");
    return { ok: true };
  } catch (e) {
    console.error("[equipe]", e instanceof Error ? e.message : e);
    return { ok: false, erro: "Não foi possível alterar agora. Tente de novo." };
  }
}
