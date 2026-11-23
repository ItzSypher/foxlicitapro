"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Permissao } from "@/core/permissoes";
import { lerSessao, verificarPermissao } from "@/lib/sessao";
import { DadosPropostaSchema, dadosEmBranco, dataIsoBrasilia, totalProposta, validarProposta } from "@/core/proposta";
import { validarEnvio, validarExterna } from "@/core/proposta-eventos";
import { ehModeloId, type ModeloId } from "@/core/proposta-modelos";
import { podeGerarLink, statusAposEdicao, podeEditar, type AcaoRevisao } from "@/core/revisao";
import type { Sessao, StatusPropostaEquipe } from "@/core/types-equipe";
import { criarPropostaExterna, marcarEnviada } from "@/db/proposta-eventos";
import { executarAcaoRevisao } from "@/lib/revisao-proposta";
import { avisarPropostaDaTela } from "@/lib/whatsapp-propostas";
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

const SEM_SESSAO = "Sessão expirada. Entre de novo.";
const FALHA = "Não foi possível salvar agora. Tente de novo.";
const NAO_ENCONTRADA = "Proposta não encontrada.";

type Acesso = { ok: true; sessao: Sessao } | { ok: false; mensagem: string };

/** O proxy já exige sessão; aqui de novo, porque uma server action pode ser chamada por qualquer rota liberada. */
async function acesso(permissao: Permissao): Promise<Acesso> {
  const v = await verificarPermissao(permissao);
  return v.ok ? v : { ok: false, mensagem: v.erro };
}

const IdSchema = z.uuid();

export type RespostaSalvar =
  | { ok: true; salvoEm: string; status: StatusPropostaEquipe }
  | { ok: false; mensagem: string };

const PedidoSalvarSchema = z.object({
  id: IdSchema,
  titulo: z.string().trim().min(1).max(160),
  modelo: z.string().refine(ehModeloId),
  dados: DadosPropostaSchema,
});

export async function salvarPropostaAction(pedido: unknown): Promise<RespostaSalvar> {
  const a = await acesso("editar_propostas");
  if (!a.ok) return { ok: false, mensagem: a.mensagem };
  const empresaId = a.sessao.empresaId;
  const lido = PedidoSalvarSchema.safeParse(pedido);
  if (!lido.success) return { ok: false, mensagem: "Há um campo com valor inválido." };
  const { id, titulo, dados } = lido.data;
  const modelo = lido.data.modelo as ModeloId;

  try {
    const atual = await lerProposta(empresaId, id);
    if (!atual) return { ok: false, mensagem: NAO_ENCONTRADA };
    if (atual.externa) return { ok: false, mensagem: "Proposta enviada fora do sistema não tem documento para editar." };
    if (!podeEditar(atual.status)) {
      return { ok: false, mensagem: "A proposta está em revisão. Retire da revisão para editar." };
    }
    const salvoEm = await atualizarProposta(empresaId, id, { titulo, modelo, dados, totalCentavos: totalProposta(dados) });
    if (!salvoEm) return { ok: false, mensagem: NAO_ENCONTRADA };

    const status = statusAposEdicao(atual.status, validarProposta(dados, modelo).length === 0);
    if (status !== atual.status) await definirStatus(empresaId, id, status, status === "rascunho" ? null : undefined);
    revalidatePath("/propostas");
    return { ok: true, salvoEm: salvoEm.toISOString(), status };
  } catch {
    return { ok: false, mensagem: FALHA };
  }
}

export interface InfoRevisao {
  revisadoPorNome: string | null;
  revisaoNota: string | null;
  revisadoEm: string | null;
}

export type RespostaRevisao =
  | { ok: true; status: StatusPropostaEquipe; revisao: InfoRevisao }
  | { ok: false; mensagem: string };

const AcaoSchema = z.enum(["enviar", "aprovar", "devolver", "retirar", "reabrir"]);

/**
 * Enviar para revisão, aprovar, devolver (com nota), retirar da revisão ou reabrir uma aprovada.
 * As regras de quem pode o quê ficam em core/revisao.ts; a execução é a mesma do WhatsApp (lib/revisao-proposta.ts).
 */
export async function acaoRevisaoAction(id: string, acao: AcaoRevisao, nota?: string): Promise<RespostaRevisao> {
  const sessao = await lerSessao();
  if (!sessao) return { ok: false, mensagem: SEM_SESSAO };
  const acaoLida = AcaoSchema.safeParse(acao);
  if (!IdSchema.safeParse(id).success || !acaoLida.success) return { ok: false, mensagem: NAO_ENCONTRADA };

  const r = await executarAcaoRevisao(sessao, id, acaoLida.data, nota);
  if (r.ok) {
    revalidatePath("/propostas");
    // Subiu para revisão: o dono recebe o link com o botão Aprovar. Aprovou na tela: o outro lado fica sabendo.
    if (acaoLida.data === "enviar") after(() => avisarPropostaDaTela(sessao, id, "subiu"));
    if (acaoLida.data === "aprovar") after(() => avisarPropostaDaTela(sessao, id, "aprovou"));
  }
  return r;
}

export type RespostaLink =
  | { ok: true; token: string; expira: string; status: StatusPropostaEquipe }
  | { ok: false; mensagem: string };

/**
 * Gera um link novo de 15 dias. Exige proposta aprovada (ou já enviada).
 * Gerar o link não marca como enviada: isso pede o comprovante (`marcarEnviadaAction`).
 */
export async function gerarLinkAction(id: string): Promise<RespostaLink> {
  const a = await acesso("editar_propostas");
  if (!a.ok) return { ok: false, mensagem: a.mensagem };
  if (!IdSchema.safeParse(id).success) return { ok: false, mensagem: NAO_ENCONTRADA };
  try {
    const p = await lerProposta(a.sessao.empresaId, id);
    if (!p) return { ok: false, mensagem: NAO_ENCONTRADA };
    if (!podeGerarLink(p.status)) {
      return { ok: false, mensagem: "A proposta precisa ser aprovada antes de ser enviada." };
    }
    const gerado = await gerarTokenPublico(a.sessao.empresaId, id, 15);
    if (!gerado) return { ok: false, mensagem: FALHA };
    revalidatePath("/propostas");
    return { ok: true, token: gerado.token, expira: gerado.expira, status: p.status };
  } catch {
    return { ok: false, mensagem: "Não foi possível gerar o link agora. Tente de novo." };
  }
}

const EntradaEnvioSchema = z.object({
  protocolo: z.string().max(500).nullish(),
  comprovante: z.string().max(900_000).nullish(),
  nota: z.string().max(5000).nullish(),
});

export type RespostaEnvio = { ok: true; status: StatusPropostaEquipe; enviadaEm: string } | { ok: false; mensagem: string };

/**
 * Marca como enviada com a prova do envio: número do protocolo no portal e/ou comprovante (print ou PDF).
 * Vale para proposta aprovada; numa já enviada, registra mais um envio (reenvio ou complemento).
 */
export async function marcarEnviadaAction(id: string, entrada: unknown): Promise<RespostaEnvio> {
  const a = await acesso("editar_propostas");
  if (!a.ok) return { ok: false, mensagem: a.mensagem };
  if (!IdSchema.safeParse(id).success) return { ok: false, mensagem: NAO_ENCONTRADA };
  const lida = EntradaEnvioSchema.safeParse(entrada);
  if (!lida.success) return { ok: false, mensagem: "O comprovante passou de 600 KB. Mande um print ou um PDF menor." };
  const envio = validarEnvio(lida.data);
  if (!envio.ok) return { ok: false, mensagem: envio.erro };
  try {
    const p = await lerProposta(a.sessao.empresaId, id);
    if (!p) return { ok: false, mensagem: NAO_ENCONTRADA };
    if (!podeGerarLink(p.status)) return { ok: false, mensagem: "A proposta precisa ser aprovada antes de ser enviada." };
    const gravou = await marcarEnviada(a.sessao.empresaId, id, a.sessao.usuarioId, envio.valor, ["aprovada", "pronta", "enviada"]);
    if (!gravou) return { ok: false, mensagem: "A proposta mudou enquanto você olhava. Recarregue a página." };
    revalidatePath("/propostas");
    const sessao = a.sessao;
    after(() => avisarPropostaDaTela(sessao, id, "enviou"));
    return { ok: true, status: "enviada", enviadaEm: p.enviadaEm ?? new Date().toISOString() };
  } catch {
    return { ok: false, mensagem: FALHA };
  }
}

const EntradaExternaSchema = EntradaEnvioSchema.extend({
  orgao: z.string().max(1000),
  numero: z.string().max(1000),
  portal: z.string().max(1000),
  valor: z.string().max(100),
  enviadaEm: z.string().max(20).nullish(),
  objeto: z.string().max(2000).nullish(),
});

/** Registra uma proposta que já foi enviada fora do sistema (órgão, número, portal, valor e prova do envio). */
export async function registrarExternaAction(entrada: unknown): Promise<{ ok: false; mensagem: string }> {
  const a = await acesso("editar_propostas");
  if (!a.ok) return { ok: false, mensagem: a.mensagem };
  const lida = EntradaExternaSchema.safeParse(entrada);
  if (!lida.success) return { ok: false, mensagem: "Há um campo com valor inválido." };
  const agora = new Date();
  const externa = validarExterna(lida.data, dataIsoBrasilia(agora));
  if (!externa.ok) return { ok: false, mensagem: externa.erro };
  const v = externa.valor;
  const dados = {
    ...dadosEmBranco("cotacao-simples", agora),
    orgao: v.orgao,
    objeto: v.objeto,
    numeroCompra: v.numero,
    itens: [],
    observacoes: "",
    data: v.enviadaEm ?? dataIsoBrasilia(agora),
  };
  const titulo = `Proposta · ${v.orgao} · ${v.numero}`.slice(0, 160);
  let id: string;
  try {
    id = await criarPropostaExterna(a.sessao.empresaId, a.sessao.usuarioId, v, dados, titulo);
  } catch {
    return { ok: false, mensagem: FALHA };
  }
  revalidatePath("/propostas");
  const sessao = a.sessao;
  const criada = id;
  after(() => avisarPropostaDaTela(sessao, criada, "registrou"));
  redirect(`/propostas/${id}`);
}

export async function revogarLinkAction(id: string): Promise<{ ok: boolean; mensagem?: string }> {
  const a = await acesso("editar_propostas");
  if (!a.ok) return { ok: false, mensagem: a.mensagem };
  if (!IdSchema.safeParse(id).success) return { ok: false, mensagem: NAO_ENCONTRADA };
  try {
    await revogarToken(a.sessao.empresaId, id);
    return { ok: true };
  } catch {
    return { ok: false, mensagem: "Não foi possível revogar agora. Tente de novo." };
  }
}

export async function excluirPropostaAction(id: string): Promise<{ ok: false; mensagem: string }> {
  const a = await acesso("editar_propostas");
  if (!a.ok) return { ok: false, mensagem: a.mensagem };
  const sessao = a.sessao;
  if (!IdSchema.safeParse(id).success) return { ok: false, mensagem: NAO_ENCONTRADA };
  try {
    const p = await lerProposta(sessao.empresaId, id);
    if (p && sessao.papel !== "dono" && p.criadoPor !== sessao.usuarioId) {
      return { ok: false, mensagem: "Só o dono ou quem criou a proposta pode excluí-la." };
    }
    await excluirProposta(sessao.empresaId, id);
  } catch {
    return { ok: false, mensagem: "Não foi possível excluir agora. Tente de novo." };
  }
  revalidatePath("/propostas");
  redirect("/propostas");
}

export async function duplicarPropostaAction(id: string): Promise<{ ok: false; mensagem: string }> {
  const a = await acesso("editar_propostas");
  if (!a.ok) return { ok: false, mensagem: a.mensagem };
  const sessao = a.sessao;
  if (!IdSchema.safeParse(id).success) return { ok: false, mensagem: NAO_ENCONTRADA };
  let novoId: string;
  try {
    const p = await lerProposta(sessao.empresaId, id);
    if (!p) return { ok: false, mensagem: NAO_ENCONTRADA };
    novoId = await criarProposta(sessao.empresaId, {
      compraId: p.compraId,
      modelo: p.modelo,
      titulo: `${p.titulo} (cópia)`.slice(0, 160),
      dados: p.dados,
      totalCentavos: totalProposta(p.dados),
      criadoPor: sessao.usuarioId,
    });
  } catch {
    return { ok: false, mensagem: "Não foi possível duplicar agora. Tente de novo." };
  }
  revalidatePath("/propostas");
  redirect(`/propostas/${novoId}`);
}

/** Cria o rascunho (com a compra, se houver) e abre o editor. Chamada pelo formulário da escolha de modelo. */
export async function criarRascunhoAction(formData: FormData): Promise<{ ok: false; mensagem: string }> {
  const a = await acesso("editar_propostas");
  if (!a.ok) return { ok: false, mensagem: a.mensagem };
  const sessao = a.sessao;
  const modeloBruto = formData.get("modelo");
  const compraBruta = formData.get("compra");
  if (!ehModeloId(modeloBruto)) return { ok: false, mensagem: "Escolha um modelo." };
  const compra = typeof compraBruta === "string" && compraBruta !== "" ? compraBruta : null;
  const criado = await criarRascunho(sessao.empresaId, modeloBruto, compra, sessao.usuarioId);
  if (criado === null) return { ok: false, mensagem: "Não foi possível criar a proposta agora. Tente de novo." };
  redirect(criado.semItens ? `/propostas/${criado.id}?aviso=itens` : `/propostas/${criado.id}`);
}
