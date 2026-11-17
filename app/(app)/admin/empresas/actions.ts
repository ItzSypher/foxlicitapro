"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ErroConsultaCnpj, consultarCnpj, regioesSugeridas, somenteDigitos, type EmpresaConsultada } from "@/core/brasilapi";
import { ehRegiao } from "@/core/perfil";
import type { Regiao } from "@/core/types";
import { CnpjJaCadastrado, cnaesSchema, criarEmpresaComDono, definirEmpresaAtiva } from "@/db/empresas";
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

  try {
    await criarEmpresaComDono(
      {
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
      },
      { nome: d.nomeDono, email: d.emailDono, senhaHash: await hashSenha(d.senha) },
      true,
    );
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
