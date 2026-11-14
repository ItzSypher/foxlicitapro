"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DadosFornecedorSchema } from "@/core/fornecedores";
import { adicionarPreco, atualizarFornecedor, criarFornecedor } from "@/db/fornecedores";
import { verificarPermissao } from "@/lib/sessao";

export type ResultadoFornecedor = { ok: true; id: string } | { ok: false; erro: string };
export type ResultadoPreco = { ok: true } | { ok: false; erro: string };

const FALHA = "Não foi possível salvar agora. Tente de novo em instantes.";

/** Criar e editar exigem editar_propostas (o dono sempre passa); a empresa vem sempre da sessão. */
export async function salvarFornecedorAction(id: string | null, entrada: unknown): Promise<ResultadoFornecedor> {
  const permissao = await verificarPermissao("editar_propostas");
  if (!permissao.ok) return { ok: false, erro: permissao.erro };
  const lido = DadosFornecedorSchema.safeParse(entrada);
  if (!lido.success) return { ok: false, erro: lido.error.issues[0]?.message ?? "Confira os dados e tente de novo." };
  const { empresaId } = permissao.sessao;
  try {
    if (id === null) {
      const novo = await criarFornecedor(empresaId, lido.data);
      revalidatePath("/fornecedores");
      return { ok: true, id: novo };
    }
    const gravou = await atualizarFornecedor(empresaId, id, lido.data);
    if (!gravou) return { ok: false, erro: "Fornecedor não encontrado." };
  } catch (e) {
    console.error("[fornecedores] gravação falhou:", e instanceof Error ? e.message : e);
    return { ok: false, erro: FALHA };
  }
  revalidatePath("/fornecedores");
  revalidatePath(`/fornecedores/${id}`);
  return { ok: true, id };
}

const PrecoSchema = z.object({
  descricao: z.string().trim().min(1, "Descreva o item.").max(300),
  unidade: z.string().trim().min(1, "Informe a unidade.").max(20),
  preco: z.number().finite().min(0, "Informe um preço válido.").max(1_000_000_000),
  prazoDias: z.number().int().min(0).max(3650).nullable(),
});

export async function adicionarPrecoAction(fornecedorId: string, entrada: unknown): Promise<ResultadoPreco> {
  const permissao = await verificarPermissao("editar_propostas");
  if (!permissao.ok) return { ok: false, erro: permissao.erro };
  const lido = PrecoSchema.safeParse(entrada);
  if (!lido.success) return { ok: false, erro: lido.error.issues[0]?.message ?? "Confira os dados e tente de novo." };
  try {
    const gravou = await adicionarPreco(permissao.sessao.empresaId, fornecedorId, { ...lido.data, origem: "manual" });
    if (!gravou) return { ok: false, erro: "Fornecedor não encontrado." };
  } catch (e) {
    console.error("[fornecedores] preço não gravado:", e instanceof Error ? e.message : e);
    return { ok: false, erro: FALHA };
  }
  revalidatePath(`/fornecedores/${fornecedorId}`);
  return { ok: true };
}
