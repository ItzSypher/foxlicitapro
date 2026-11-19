"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ErroConsultaCnpj, consultarCnpj, regioesSugeridas, somenteDigitos, type EmpresaConsultada } from "@/core/brasilapi";
import { ehRegiao } from "@/core/perfil";
import type { Regiao } from "@/core/types";
import { CnpjJaCadastrado, cnaesSchema, criarEmpresaComDono, criarEmpresaSemDono, definirEmpresaAtiva } from "@/db/empresas";
import { adicionarGestorPorEmail, removerAcessoEmpresa } from "@/db/usuario-empresas";
import { EmailJaCadastrado } from "@/db/usuarios";
import { hashSenha } from "@/lib/auth";
import { exigirSuperadmin } from "@/lib/sessao";

const SEM_PERMISSAO = "Só o administrador pode fazer isso.";

export type ResultadoConsulta =
  | { ok: true; empresa: EmpresaConsultada; regioes: Regiao[] }
  | { ok: false; erro: string };
export type ResultadoAdmin = { ok: true } | { ok: false; erro: string };

async function permitido(): Promise<boolean> {
  try {
    await exigirSuperadmin();
    return true;
  } catch {
    return false;
  }
}

/** Busca o CNPJ na BrasilAPI e devolve os dados com a frente sugerida em cada CNAE. */
export async function consultarCnpjAction(cnpj: string): Promise<ResultadoConsulta> {
  if (!(await permitido())) return { ok: false, erro: SEM_PERMISSAO };
  try {
    const empresa = await consultarCnpj(String(cnpj).slice(0, 30));
    return { ok: true, empresa, regioes: regioesSugeridas(empresa.uf) };
  } catch (e) {
    if (e instanceof ErroConsultaCnpj) return { ok: false, erro: e.message };
    console.error("[admin-empresas] consulta falhou:", e instanceof Error ? e.message : e);
    return { ok: false, erro: "Não foi possível consultar o CNPJ agora." };
  }
}

const CriacaoSchema = z.object({
  cnpj: z.string().min(11).max(30),
  cnaes: cnaesSchema,
  regioes: z.array(z.string().refine(ehRegiao)).min(1, "Marque pelo menos uma região.").max(10),
  nomeDono: z.string().trim().min(2, "Digite o nome do dono.").max(100),
  emailDono: z.string().trim().toLowerCase().max(200).pipe(z.email("Digite um e-mail válido.")),
  senha: z.string().min(8, "A senha precisa de pelo menos 8 caracteres.").max(200),
});

/** Cria a empresa e o primeiro dono. Os dados da Receita são consultados de novo aqui; do cliente só vêm as frentes e regiões. */
export async function criarEmpresaAction(entrada: unknown): Promise<ResultadoAdmin> {
  if (!(await permitido())) return { ok: false, erro: SEM_PERMISSAO };
  const lido = CriacaoSchema.safeParse(entrada);
  if (!lido.success) return { ok: false, erro: lido.error.issues[0]?.message ?? "Confira os dados e tente de novo." };
  const d = lido.data;

  let consultada: EmpresaConsultada;
  try {
    consultada = await consultarCnpj(d.cnpj);
  } catch (e) {
    return { ok: false, erro: e instanceof ErroConsultaCnpj ? e.message : "Não foi possível consultar o CNPJ agora." };
  }
  const frentes = new Map(d.cnaes.map((c) => [c.codigo, c.frente]));
  const cnaes = consultada.cnaes.map((c) => ({ ...c, frente: frentes.get(c.codigo) ?? c.frente }));

  try {
    await criarEmpresaComDono(
      { ...consultada, cnaes, regioes: d.regioes.filter(ehRegiao) },
      { nome: d.nomeDono, email: d.emailDono, senhaHash: await hashSenha(d.senha) },
    );
  } catch (e) {
    if (e instanceof CnpjJaCadastrado || e instanceof EmailJaCadastrado) return { ok: false, erro: e.message };
    console.error("[admin-empresas] criação falhou:", e instanceof Error ? e.message : e);
    return { ok: false, erro: "Não foi possível criar a empresa agora." };
  }
  revalidatePath("/admin/empresas");
  return { ok: true };
}

const CriacaoTesteSchema = z.object({
  cnpj: z
    .string()
    .max(30)
    .transform((v) => somenteDigitos(v))
    .pipe(z.string().length(14, "O CNPJ de teste precisa ter 14 dígitos.")),
  razaoSocial: z.string().trim().min(2, "Digite a razão social.").max(150),
  uf: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Digite a UF com 2 letras."),
  municipio: z.string().trim().min(2, "Digite o município.").max(100),
  porte: z.enum(["mei", "me", "epp", "demais"]),
  regioes: z.array(z.string().refine(ehRegiao)).min(1, "Marque pelo menos uma região.").max(10),
  /** Cria a empresa sem dono; o gestor entra depois pela seção "Gestores" */
  semDono: z.boolean().default(false),
  nomeDono: z.string().max(100).default(""),
  emailDono: z.string().max(200).default(""),
  senha: z.string().max(200).default(""),
});

const DonoSchema = z.object({
  nomeDono: z.string().trim().min(2, "Digite o nome do dono.").max(100),
  emailDono: z.string().trim().toLowerCase().max(200).pipe(z.email("Digite um e-mail válido.")),
  senha: z.string().min(8, "A senha precisa de pelo menos 8 caracteres.").max(200),
});

/** Cria uma empresa de teste sem consultar a Receita: CNAEs vazios e demais dados em branco. */
export async function criarEmpresaTesteAction(entrada: unknown): Promise<ResultadoAdmin> {
  if (!(await permitido())) return { ok: false, erro: SEM_PERMISSAO };
  const lido = CriacaoTesteSchema.safeParse(entrada);
  if (!lido.success) return { ok: false, erro: lido.error.issues[0]?.message ?? "Confira os dados e tente de novo." };
  const d = lido.data;
  const dono = d.semDono ? null : DonoSchema.safeParse(d);
  if (dono && !dono.success) return { ok: false, erro: dono.error.issues[0]?.message ?? "Confira os dados do dono." };

  const nova = {
    cnpj: d.cnpj,
    razaoSocial: d.razaoSocial,
    nomeFantasia: null,
    porte: d.porte,
    uf: d.uf,
    municipio: d.municipio,
    dataAbertura: null,
    cnaes: [],
    endereco: null,
    cep: null,
    telefone: null,
    email: null,
    regioes: d.regioes.filter(ehRegiao),
  };
  try {
    if (dono?.success) {
      await criarEmpresaComDono(nova, { nome: dono.data.nomeDono, email: dono.data.emailDono, senhaHash: await hashSenha(dono.data.senha) }, true);
    } else {
      await criarEmpresaSemDono(nova, true);
    }
  } catch (e) {
    if (e instanceof CnpjJaCadastrado || e instanceof EmailJaCadastrado) return { ok: false, erro: e.message };
    console.error("[admin-empresas] criação de teste falhou:", e instanceof Error ? e.message : e);
    return { ok: false, erro: "Não foi possível criar a empresa agora." };
  }
  revalidatePath("/admin/empresas");
  return { ok: true };
}

/** Desativada, ninguém da empresa entra. */
export async function definirEmpresaAtivaAction(id: string, ativa: boolean): Promise<ResultadoAdmin> {
  if (!(await permitido())) return { ok: false, erro: SEM_PERMISSAO };
  try {
    const gravou = await definirEmpresaAtiva(id, ativa === true);
    if (!gravou) return { ok: false, erro: "Empresa não encontrada." };
  } catch (e) {
    console.error("[admin-empresas] ativar/desativar falhou:", e instanceof Error ? e.message : e);
    return { ok: false, erro: "Não foi possível alterar agora." };
  }
  revalidatePath("/admin/empresas");
  return { ok: true };
}

const GestorSchema = z.object({
  empresaId: z.uuid("Empresa inválida."),
  email: z.string().trim().toLowerCase().max(200).pipe(z.email("Digite um e-mail válido.")),
});

/** Dá a uma pessoa já cadastrada (de qualquer empresa) o acesso de gestor a esta empresa. */
export async function adicionarGestorAction(entrada: unknown): Promise<ResultadoAdmin> {
  if (!(await permitido())) return { ok: false, erro: SEM_PERMISSAO };
  const lido = GestorSchema.safeParse(entrada);
  if (!lido.success) return { ok: false, erro: lido.error.issues[0]?.message ?? "Confira os dados e tente de novo." };
  try {
    const r = await adicionarGestorPorEmail(lido.data.empresaId, lido.data.email);
    if (r === "sem_usuario") return { ok: false, erro: "Não há ninguém cadastrado com esse e-mail." };
    if (r === "ja_e_da_empresa") return { ok: false, erro: "Essa pessoa já faz parte da equipe desta empresa." };
  } catch (e) {
    console.error("[admin-empresas] adicionar gestor falhou:", e instanceof Error ? e.message : e);
    return { ok: false, erro: "Não foi possível adicionar agora." };
  }
  revalidatePath("/admin/empresas");
  return { ok: true };
}

const RemocaoSchema = z.object({ empresaId: z.uuid("Empresa inválida."), usuarioId: z.uuid("Pessoa inválida.") });

export async function removerGestorAction(entrada: unknown): Promise<ResultadoAdmin> {
  if (!(await permitido())) return { ok: false, erro: SEM_PERMISSAO };
  const lido = RemocaoSchema.safeParse(entrada);
  if (!lido.success) return { ok: false, erro: lido.error.issues[0]?.message ?? "Confira os dados e tente de novo." };
  try {
    await removerAcessoEmpresa(lido.data.usuarioId, lido.data.empresaId);
  } catch (e) {
    console.error("[admin-empresas] remover gestor falhou:", e instanceof Error ? e.message : e);
    return { ok: false, erro: "Não foi possível remover agora." };
  }
  revalidatePath("/admin/empresas");
  return { ok: true };
}
