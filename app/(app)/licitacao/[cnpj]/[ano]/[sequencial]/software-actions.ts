"use server";

import { revalidatePath } from "next/cache";
import { entradaComissaoSchema, entradaSoftwareSchema } from "@/core/campos-software";
import { numeroControleDaChave } from "@/core/pncp/detalhe";
import { lerChaveCompra } from "@/core/proposta";
import { gravarComissaoDoPipeline, gravarSoftwareDoItem } from "@/db/pipeline";
import { SEM_PERMISSAO, lerSessao } from "@/lib/sessao";

export type ResultadoSoftware = { ok: true } | { ok: false; erro: string };

const SEM_SESSAO = "Sessão expirada. Entre de novo.";
const FORA_DO_PIPELINE = "Salve a licitação no pipeline para guardar.";

/**
 * Gestor e dono guardam terceirização, custo e parcelas do dev, horas próprias, meses de contrato e preço do lance.
 * O item tem que estar no pipeline da empresa da sessão.
 */
export async function salvarSoftwareAction(entrada: unknown): Promise<ResultadoSoftware> {
  const sessao = await lerSessao();
  if (!sessao) return { ok: false, erro: SEM_SESSAO };
  if (sessao.papel !== "dono" && sessao.papel !== "gestor") return { ok: false, erro: SEM_PERMISSAO };
  const lida = entradaSoftwareSchema.safeParse(entrada);
  if (!lida.success) {
    return { ok: false, erro: "Confira os valores: custo do dev, parcelas (1 a 60), horas (1 a 744), meses (1 a 120) e lance." };
  }
  const { compra, terceirizavel, devCusto, devParcelas, contratoMeses, precoLance, horasMes } = lida.data;
  const chave = lerChaveCompra(compra);
  if (!chave) return { ok: false, erro: "Licitação inválida." };
  try {
    const gravou = await gravarSoftwareDoItem(sessao.empresaId, numeroControleDaChave(chave), {
      terceirizavel,
      devCusto,
      devParcelas,
      contratoMeses,
      precoLance,
      horasMes,
    });
    if (!gravou) return { ok: false, erro: FORA_DO_PIPELINE };
  } catch (e) {
    console.error("[software]", e instanceof Error ? e.message : e);
    return { ok: false, erro: "Não foi possível salvar agora. Tente de novo." };
  }
  revalidatePath(`/licitacao/${chave.cnpj}/${chave.ano}/${chave.sequencial}`);
  return { ok: true };
}

/** Gestor e dono: comissão deste item (0 a 30%); null = sem comissão. */
export async function salvarComissaoItemAction(entrada: unknown): Promise<ResultadoSoftware> {
  const sessao = await lerSessao();
  if (!sessao) return { ok: false, erro: SEM_SESSAO };
  if (sessao.papel !== "dono" && sessao.papel !== "gestor") return { ok: false, erro: SEM_PERMISSAO };
  const lida = entradaComissaoSchema.safeParse(entrada);
  if (!lida.success) return { ok: false, erro: "Use uma comissão de 0 a 30%." };
  const chave = lerChaveCompra(lida.data.compra);
  if (!chave) return { ok: false, erro: "Licitação inválida." };
  try {
    const gravou = await gravarComissaoDoPipeline(sessao.empresaId, numeroControleDaChave(chave), lida.data.percentual);
    if (!gravou) return { ok: false, erro: FORA_DO_PIPELINE };
  } catch (e) {
    console.error("[software]", e instanceof Error ? e.message : e);
    return { ok: false, erro: "Não foi possível salvar agora. Tente de novo." };
  }
  revalidatePath(`/licitacao/${chave.cnpj}/${chave.ano}/${chave.sequencial}`);
  return { ok: true };
}
