"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { COOKIE_SESSAO, tokenValido } from "@/lib/auth";
import { DadosPropostaSchema, totalProposta, validarProposta } from "@/core/proposta";
import { ehModeloId, type ModeloId } from "@/core/proposta-modelos";
import type { StatusProposta } from "@/core/types-detalhe";
import { criarRascunho } from "./rascunho";
import {
  atualizarProposta,
  criarProposta,
  definirStatus,
  excluirProposta,
  gerarTokenPublico,
  lerProposta,
  revogarToken,
} from "@/db/propostas";

/** O proxy já exige sessão; aqui de novo, porque uma server action pode ser chamada por qualquer rota liberada. */
async function exigirSessao(): Promise<boolean> {
  const jar = await cookies();
  return tokenValido(jar.get(COOKIE_SESSAO)?.value, process.env.APP_SECRET);
}

const SEM_SESSAO = "Sessão expirada. Entre de novo.";
const FALHA = "Não foi possível salvar agora. Tente de novo.";

const IdSchema = z.uuid();

export type RespostaSalvar =
  | { ok: true; salvoEm: string; status: StatusProposta }
  | { ok: false; mensagem: string };

const PedidoSalvarSchema = z.object({
  id: IdSchema,
  titulo: z.string().trim().min(1).max(160),
  modelo: z.string().refine(ehModeloId),
  dados: DadosPropostaSchema,
});

export async function salvarPropostaAction(pedido: unknown): Promise<RespostaSalvar> {
  if (!(await exigirSessao())) return { ok: false, mensagem: SEM_SESSAO };
  const lido = PedidoSalvarSchema.safeParse(pedido);
  if (!lido.success) return { ok: false, mensagem: "Há um campo com valor inválido." };
  const { id, titulo, dados } = lido.data;
  const modelo = lido.data.modelo as ModeloId;

  try {
    const atual = await lerProposta(id);
    if (!atual) return { ok: false, mensagem: "Proposta não encontrada." };
    const salvoEm = await atualizarProposta(id, { titulo, modelo, dados, totalCentavos: totalProposta(dados) });
    if (!salvoEm) return { ok: false, mensagem: "Proposta não encontrada." };

    let status = atual.status;
    if (status !== "rascunho" && validarProposta(dados, modelo).length > 0) {
      await definirStatus(id, "rascunho");
      status = "rascunho";
    }
    revalidatePath("/propostas");
    return { ok: true, salvoEm: salvoEm.toISOString(), status };
  } catch {
    return { ok: false, mensagem: FALHA };
  }
}

export type RespostaStatus = { ok: true; status: StatusProposta } | { ok: false; mensagem: string };

/** Marca como pronta; só passa sem pendências. Para voltar a rascunho, `pronta: false`. */
export async function marcarProntaAction(id: string, pronta: boolean): Promise<RespostaStatus> {
  if (!(await exigirSessao())) return { ok: false, mensagem: SEM_SESSAO };
  if (!IdSchema.safeParse(id).success) return { ok: false, mensagem: "Proposta não encontrada." };
  try {
    const p = await lerProposta(id);
    if (!p) return { ok: false, mensagem: "Proposta não encontrada." };
    if (pronta && validarProposta(p.dados, p.modelo).length > 0) {
      return { ok: false, mensagem: "Resolva as pendências antes de marcar como pronta." };
    }
    const status: StatusProposta = pronta ? "pronta" : "rascunho";
    await definirStatus(id, status);
    revalidatePath("/propostas");
    return { ok: true, status };
  } catch {
    return { ok: false, mensagem: FALHA };
  }
}

export type RespostaLink =
  | { ok: true; token: string; expira: string; status: StatusProposta }
  | { ok: false; mensagem: string };

/** Gera um link novo de 15 dias e marca a proposta como enviada. Exige proposta pronta ou já enviada. */
export async function gerarLinkAction(id: string): Promise<RespostaLink> {
  if (!(await exigirSessao())) return { ok: false, mensagem: SEM_SESSAO };
  if (!IdSchema.safeParse(id).success) return { ok: false, mensagem: "Proposta não encontrada." };
  try {
    const p = await lerProposta(id);
    if (!p) return { ok: false, mensagem: "Proposta não encontrada." };
    if (p.status === "rascunho") return { ok: false, mensagem: "Marque a proposta como pronta antes de enviar." };
    const gerado = await gerarTokenPublico(id, 15);
    if (!gerado) return { ok: false, mensagem: FALHA };
    await definirStatus(id, "enviada");
    revalidatePath("/propostas");
    return { ok: true, token: gerado.token, expira: gerado.expira, status: "enviada" };
  } catch {
    return { ok: false, mensagem: "Não foi possível gerar o link agora. Tente de novo." };
  }
}

export async function revogarLinkAction(id: string): Promise<{ ok: boolean; mensagem?: string }> {
  if (!(await exigirSessao())) return { ok: false, mensagem: SEM_SESSAO };
  if (!IdSchema.safeParse(id).success) return { ok: false, mensagem: "Proposta não encontrada." };
  try {
    await revogarToken(id);
    return { ok: true };
  } catch {
    return { ok: false, mensagem: "Não foi possível revogar agora. Tente de novo." };
  }
}

export async function excluirPropostaAction(id: string): Promise<{ ok: false; mensagem: string }> {
  if (!(await exigirSessao())) return { ok: false, mensagem: SEM_SESSAO };
  if (!IdSchema.safeParse(id).success) return { ok: false, mensagem: "Proposta não encontrada." };
  try {
    await excluirProposta(id);
  } catch {
    return { ok: false, mensagem: "Não foi possível excluir agora. Tente de novo." };
  }
  revalidatePath("/propostas");
  redirect("/propostas");
}

export async function duplicarPropostaAction(id: string): Promise<{ ok: false; mensagem: string }> {
  if (!(await exigirSessao())) return { ok: false, mensagem: SEM_SESSAO };
  if (!IdSchema.safeParse(id).success) return { ok: false, mensagem: "Proposta não encontrada." };
  let novoId: string;
  try {
    const p = await lerProposta(id);
    if (!p) return { ok: false, mensagem: "Proposta não encontrada." };
    novoId = await criarProposta({
      compraId: p.compraId,
      modelo: p.modelo,
      titulo: `${p.titulo} (cópia)`.slice(0, 160),
      dados: p.dados,
      totalCentavos: totalProposta(p.dados),
    });
  } catch {
    return { ok: false, mensagem: "Não foi possível duplicar agora. Tente de novo." };
  }
  revalidatePath("/propostas");
  redirect(`/propostas/${novoId}`);
}

/** Cria o rascunho (com a compra, se houver) e abre o editor. Chamada pelo formulário da escolha de modelo. */
export async function criarRascunhoAction(formData: FormData): Promise<{ ok: false; mensagem: string }> {
  if (!(await exigirSessao())) return { ok: false, mensagem: SEM_SESSAO };
  const modeloBruto = formData.get("modelo");
  const compraBruta = formData.get("compra");
  if (!ehModeloId(modeloBruto)) return { ok: false, mensagem: "Escolha um modelo." };
  const compra = typeof compraBruta === "string" && compraBruta !== "" ? compraBruta : null;
  const criado = await criarRascunho(modeloBruto, compra);
  if (criado === null) return { ok: false, mensagem: "Não foi possível criar a proposta agora. Tente de novo." };
  redirect(criado.semItens ? `/propostas/${criado.id}?aviso=itens` : `/propostas/${criado.id}`);
}
