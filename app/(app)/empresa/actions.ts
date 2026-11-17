"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ehRegiao } from "@/core/perfil";
import { atualizarDadosProposta, atualizarPerfilEmpresa, cnaesSchema } from "@/db/empresas";
import { exigirDono } from "@/lib/sessao";

export type ResultadoEmpresa = { ok: true } | { ok: false; erro: string };

const EdicaoSchema = z.object({
  nomeFantasia: z.string().trim().max(120).nullable(),
  cnaes: cnaesSchema,
  regioes: z.array(z.string().refine(ehRegiao)).max(10),
});

/** Só o dono edita, e sempre a empresa da própria sessão. */
export async function salvarEmpresaAction(entrada: unknown): Promise<ResultadoEmpresa> {
  let empresaId: string;
  try {
    empresaId = (await exigirDono()).empresaId;
  } catch {
    return { ok: false, erro: "Só o dono pode fazer isso." };
  }
  const lido = EdicaoSchema.safeParse(entrada);
  if (!lido.success) return { ok: false, erro: "Confira os dados e tente de novo." };
  const regioes = lido.data.regioes.filter(ehRegiao);
  if (regioes.length === 0) return { ok: false, erro: "Marque pelo menos uma região de atendimento." };
  try {
    const gravou = await atualizarPerfilEmpresa(empresaId, { ...lido.data, regioes });
    if (!gravou) return { ok: false, erro: "Empresa não encontrada." };
  } catch (e) {
    console.error("[empresa] gravação falhou:", e instanceof Error ? e.message : e);
    return { ok: false, erro: "Não foi possível salvar agora. Tente de novo em instantes." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const DadosPropostaSchema = z.object({
  responsavel: z.string().trim().max(120).nullable(),
  representanteCpf: z.string().trim().max(30).nullable(),
  representanteRg: z.string().trim().max(30).nullable(),
  dadosBancarios: z.string().trim().max(500).nullable(),
  assinatura: z
    .string()
    .max(280000)
    .regex(/^data:image\/(png|jpeg);base64,/)
    .nullable(),
});

/** Dados padrão que saem em toda proposta nova. Só o dono edita, e sempre a empresa da própria sessão. */
export async function salvarDadosPropostaAction(entrada: unknown): Promise<ResultadoEmpresa> {
  let empresaId: string;
  try {
    empresaId = (await exigirDono()).empresaId;
  } catch {
    return { ok: false, erro: "Só o dono pode fazer isso." };
  }
  const lido = DadosPropostaSchema.safeParse(entrada);
  if (!lido.success) return { ok: false, erro: "Confira os dados e tente de novo. A assinatura deve ser PNG ou JPEG de até 200 KB." };
  try {
    const gravou = await atualizarDadosProposta(empresaId, lido.data);
    if (!gravou) return { ok: false, erro: "Empresa não encontrada." };
  } catch (e) {
    console.error("[empresa] dados da proposta falharam:", e instanceof Error ? e.message : e);
    return { ok: false, erro: "Não foi possível salvar agora. Tente de novo em instantes." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
