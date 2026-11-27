"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { gravarComissaoDoItem, gravarCustoRealDoItem, gravarPagamentoPrevisto, gravarRecebido } from "@/db/fluxo-caixa";
import { COMISSAO_MAXIMA, COMISSAO_MINIMA } from "@/core/lucro";
import { exigirDono } from "@/lib/sessao";

export type ResultadoCaixa = { ok: true } | { ok: false; erro: string };

const idSchema = z.string().min(1).max(200);
const diaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const RecebiSchema = z.object({
  id: idSchema,
  recebidoEm: diaSchema,
  valor: z.number().min(0).max(1_000_000_000),
});

const DataSchema = z.object({ id: idSchema, dia: diaSchema.nullable() });

const ComissaoSchema = z.object({
  id: idSchema,
  percentual: z.number().min(COMISSAO_MINIMA).max(COMISSAO_MAXIMA).nullable(),
});

/** Só o dono mexe no caixa, e sempre na empresa da própria sessão. */
async function empresaDoDono(): Promise<string | null> {
  try {
    return (await exigirDono()).empresaId;
  } catch {
    return null;
  }
}

async function gravar(rotina: (empresaId: string) => Promise<boolean>, rotulo: string): Promise<ResultadoCaixa> {
  const empresaId = await empresaDoDono();
  if (empresaId === null) return { ok: false, erro: "Só o dono pode fazer isso." };
  try {
    const gravou = await rotina(empresaId);
    if (!gravou) return { ok: false, erro: "Essa licitação não está mais entre as ganhas." };
  } catch (e) {
    console.error(`[caixa] ${rotulo} falhou:`, e instanceof Error ? e.message : e);
    return { ok: false, erro: "Não foi possível salvar agora. Tente de novo em instantes." };
  }
  revalidatePath("/caixa");
  return { ok: true };
}

/** "Recebi": grava a data e o valor que entraram. */
export async function marcarRecebidoAction(entrada: unknown): Promise<ResultadoCaixa> {
  const lido = RecebiSchema.safeParse(entrada);
  if (!lido.success) return { ok: false, erro: "Confira a data e o valor." };
  const { id, recebidoEm, valor } = lido.data;
  return gravar((empresaId) => gravarRecebido(empresaId, id, { recebidoEm, valor }), "recebido");
}

/** Desfaz o "Recebi" (engano de clique). */
export async function desfazerRecebidoAction(entrada: unknown): Promise<ResultadoCaixa> {
  const lido = idSchema.safeParse(entrada);
  if (!lido.success) return { ok: false, erro: "Licitação inválida." };
  return gravar((empresaId) => gravarRecebido(empresaId, lido.data, null), "desfazer recebido");
}

/** Data em que o pagamento deve cair; vazio volta ao prazo do edital. */
export async function salvarPagamentoPrevistoAction(entrada: unknown): Promise<ResultadoCaixa> {
  const lido = DataSchema.safeParse(entrada);
  if (!lido.success) return { ok: false, erro: "Confira a data." };
  const { id, dia } = lido.data;
  return gravar((empresaId) => gravarPagamentoPrevisto(empresaId, id, dia), "data prevista");
}

const CustoRealSchema = z.object({ id: idSchema, custo: z.number().min(0).max(1_000_000_000).nullable() });

/** Custo real desta licitação (R$); vazio volta à estimativa. */
export async function salvarCustoRealAction(entrada: unknown): Promise<ResultadoCaixa> {
  const lido = CustoRealSchema.safeParse(entrada);
  if (!lido.success) return { ok: false, erro: "Digite o custo em reais, por exemplo 2.700,00." };
  const { id, custo } = lido.data;
  return gravar((empresaId) => gravarCustoRealDoItem(empresaId, id, custo), "custo real");
}

/** Comissão desta licitação (0 a 30%); null tira a comissão (desmarcou "Tem comissão"). */
export async function salvarComissaoDoItemAction(entrada: unknown): Promise<ResultadoCaixa> {
  const lido = ComissaoSchema.safeParse(entrada);
  if (!lido.success) return { ok: false, erro: `Use uma comissão de ${COMISSAO_MINIMA} a ${COMISSAO_MAXIMA}%.` };
  const { id, percentual } = lido.data;
  return gravar((empresaId) => gravarComissaoDoItem(empresaId, id, percentual), "comissão");
}
