"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  atualizarNotas,
  moverItem,
  oportunidadeComScoreSchema,
  removerItem,
  salvarItem,
} from "@/db/pipeline";
import type { OportunidadeComScore } from "@/core/types";
import type { EtapaId, ResultadoAcao } from "@/components/pipeline/tipos";

const idSchema = z.string().min(1).max(200);
const etapaSchema = z.enum(["radar", "analisando", "cotando", "proposta", "disputa", "ganha", "perdida"]);
const notasSchema = z.string().max(5000);

const ERRO_DADOS = "Dados inválidos. Recarregue a página e tente de novo.";

function atualizarTelas(): void {
  revalidatePath("/pipeline");
  revalidatePath("/radar");
}

async function executar(
  tarefa: () => Promise<boolean>,
  mensagemFalha: string,
  naoEncontrado: string,
): Promise<ResultadoAcao> {
  try {
    const achou = await tarefa();
    if (!achou) return { ok: false, erro: naoEncontrado };
    atualizarTelas();
    return { ok: true };
  } catch (e) {
    console.error("[pipeline]", e instanceof Error ? e.message : e);
    return { ok: false, erro: mensagemFalha };
  }
}

export async function salvarNoPipeline(item: OportunidadeComScore): Promise<ResultadoAcao> {
  const lido = oportunidadeComScoreSchema.safeParse(item);
  if (!lido.success) return { ok: false, erro: ERRO_DADOS };
  return executar(
    async () => {
      await salvarItem(lido.data);
      return true;
    },
    "Não foi possível salvar no pipeline. Tente de novo.",
    "Item não encontrado.",
  );
}

export async function moverEtapa(id: string, etapa: EtapaId): Promise<ResultadoAcao> {
  const i = idSchema.safeParse(id);
  const e = etapaSchema.safeParse(etapa);
  if (!i.success || !e.success) return { ok: false, erro: ERRO_DADOS };
  return executar(
    () => moverItem(i.data, e.data),
    "Não foi possível mover o item. Tente de novo.",
    "Esse item não está mais no pipeline.",
  );
}

export async function removerDoPipeline(id: string): Promise<ResultadoAcao> {
  const i = idSchema.safeParse(id);
  if (!i.success) return { ok: false, erro: ERRO_DADOS };
  return executar(
    () => removerItem(i.data),
    "Não foi possível remover o item. Tente de novo.",
    "Esse item não está mais no pipeline.",
  );
}

export async function salvarNotas(id: string, notas: string): Promise<ResultadoAcao> {
  const i = idSchema.safeParse(id);
  const n = notasSchema.safeParse(notas);
  if (!i.success || !n.success) return { ok: false, erro: ERRO_DADOS };
  return executar(
    () => atualizarNotas(i.data, n.data),
    "Não foi possível salvar as notas. Tente de novo.",
    "Esse item não está mais no pipeline.",
  );
}
