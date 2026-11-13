"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { salvarCotacao } from "@/db/cotacoes";
import { calcularPrecificacao } from "@/core/precificacao";
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
});

export type RespostaSalvar = { ok: true } | { ok: false; mensagem: string };

/** O cálculo é refeito aqui: o servidor não confia no resultado que veio do navegador. */
export async function salvarCotacaoAction(pedido: z.input<typeof PedidoSchema>): Promise<RespostaSalvar> {
  if (!(await lerSessao())) return { ok: false, mensagem: "Entre de novo para salvar." };
  const lido = PedidoSchema.safeParse(pedido);
  if (!lido.success) {
    return { ok: false, mensagem: lido.error.issues[0]?.message ?? "Dados da cotação inválidos." };
  }
  const p = lido.data;

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
    await salvarCotacao({
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

  revalidatePath("/calculadora");
  return { ok: true };
}
