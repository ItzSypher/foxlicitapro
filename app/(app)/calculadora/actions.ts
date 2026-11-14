"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { salvarCotacao } from "@/db/cotacoes";
import { calcularPrecificacao } from "@/core/precificacao";
import { temPermissao } from "@/core/permissoes";
import type { SugestaoPreco } from "@/core/fornecedores";
import { adicionarPreco, lerFornecedor, sugerirPrecoParaDescricao } from "@/db/fornecedores";
import { lerSessao } from "@/lib/sessao";
import type { EntradaPrecificacao } from "@/core/precificacao";

const PedidoSchema = z.object({
  itemId: z.string().min(1).max(200).nullable(),
  descricao: z.string().trim().min(1, "Descreva o que você está cotando.").max(300),
  frente: z.enum(["servicos", "produtos"]),
  cnae: z.string().max(20).nullable(),
  custo: z.number(),
  frete: z.number(),
  extras: z.number(),
  tetoOrgao: z.number().nullable(),
  margemMinima: z.number(),
  margemAlvo: z.number(),
  regime: z.enum(["mei", "simples"]),
  vendasPrevistasNoMes: z.number().optional(),
  /** Fornecedor do custo (opcional): o custo também vira preço dele */
  fornecedorId: z.string().uuid().nullable().optional(),
});

export type RespostaSalvar = { ok: true } | { ok: false; mensagem: string };

/** O cálculo é refeito aqui: o servidor não confia no resultado que veio do navegador. */
export async function salvarCotacaoAction(pedido: z.input<typeof PedidoSchema>): Promise<RespostaSalvar> {
  const sessao = await lerSessao();
  if (!sessao) return { ok: false, mensagem: "Entre de novo para salvar." };
  const lido = PedidoSchema.safeParse(pedido);
  if (!lido.success) {
    return { ok: false, mensagem: lido.error.issues[0]?.message ?? "Dados da cotação inválidos." };
  }
  const p = lido.data;
  const fornecedorId = p.fornecedorId ?? null;
  if (fornecedorId !== null) {
    if (!temPermissao(sessao, "editar_propostas")) return { ok: false, mensagem: "Você não tem permissão para registrar preço de fornecedor." };
    const fornecedor = await lerFornecedor(sessao.empresaId, fornecedorId).catch(() => null);
    if (!fornecedor) return { ok: false, mensagem: "Fornecedor não encontrado." };
  }

  const entrada: EntradaPrecificacao = {
    custo: p.custo,
    frete: p.frete,
    extras: p.extras,
    tetoOrgao: p.tetoOrgao,
    margemMinima: p.margemMinima,
    margemAlvo: p.margemAlvo,
    regime: p.regime,
    tipo: p.frente,
    ...(p.vendasPrevistasNoMes !== undefined ? { vendasPrevistasNoMes: p.vendasPrevistasNoMes } : {}),
  };
  const resultado = calcularPrecificacao(entrada);
  if (!resultado.ok) return { ok: false, mensagem: "Corrija os campos em vermelho antes de salvar." };

  try {
    await salvarCotacao(sessao.empresaId, {
      itemId: p.itemId,
      descricao: p.descricao,
      frente: p.frente,
      cnae: p.cnae,
      entrada,
      calculo: resultado.calculo,
    });
  } catch {
    return { ok: false, mensagem: "Não foi possível salvar agora. Tente de novo." };
  }

  if (fornecedorId !== null && p.custo > 0) {
    try {
      const gravou = await adicionarPreco(sessao.empresaId, fornecedorId, {
        descricao: p.descricao,
        unidade: "un",
        preco: p.custo,
        prazoDias: null,
        origem: "cotacao",
      });
      if (!gravou) return { ok: false, mensagem: "Cotação salva, mas o fornecedor não foi encontrado para guardar o preço." };
    } catch {
      return { ok: false, mensagem: "Cotação salva, mas não foi possível guardar o preço do fornecedor." };
    }
    revalidatePath("/fornecedores");
  }

  revalidatePath("/calculadora");
  revalidatePath("/pipeline");
  return { ok: true };
}

/** Último e menor preço de fornecedor para itens parecidos com a descrição (dados só da empresa da sessão). */
export async function sugerirPrecoAction(descricao: string): Promise<SugestaoPreco | null> {
  const sessao = await lerSessao();
  if (!sessao || typeof descricao !== "string" || descricao.trim().length < 3) return null;
  try {
    return await sugerirPrecoParaDescricao(sessao.empresaId, descricao.slice(0, 300));
  } catch {
    return null;
  }
}
