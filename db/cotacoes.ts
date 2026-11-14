import "server-only";
import type postgres from "postgres";
import { z } from "zod";
import { sql } from "@/db/client";
import type { CalculoPrecificacao, EntradaPrecificacao } from "@/core/precificacao";
import { resumirCotacoes, type CotacaoParaResumo, type ResumoCotacoes } from "@/core/cotacoes-resumo";
import type { Frente } from "@/core/types";

const FrenteSchema = z.enum(["servicos", "produtos"]);
const RegimeSchema = z.enum(["mei", "simples"]);

/** Contrato da coluna cotacoes.entrada (jsonb): o que entra em calcularPrecificacao. */
const EntradaSchema = z.object({
  custo: z.number(),
  frete: z.number(),
  extras: z.number(),
  tetoOrgao: z.number().nullable(),
  margemMinima: z.number(),
  margemAlvo: z.number(),
  regime: RegimeSchema,
  tipo: FrenteSchema,
  vendasPrevistasNoMes: z.number().optional(),
});

/** Parte do item de pipeline_itens.dados (OportunidadeComScore) que a calculadora usa. */
const DadosItemSchema = z.object({
  objeto: z.string(),
  valorEstimado: z.number().nullable().optional(),
  score: z.object({
    frenteCasada: FrenteSchema.nullable(),
    cnaesCasados: z.array(z.string()),
  }),
});

export interface ItemParaCotacao {
  id: string;
  objeto: string;
  valorEstimado: number | null;
  frente: Frente | null;
  cnae: string | null;
}

export interface NovaCotacao {
  itemId: string | null;
  descricao: string;
  frente: Frente;
  cnae: string | null;
  entrada: EntradaPrecificacao;
  calculo: CalculoPrecificacao;
}

export interface CotacaoSalva {
  id: string;
  itemId: string | null;
  descricao: string;
  frente: Frente;
  cnae: string | null;
  entrada: EntradaPrecificacao;
  precoMinimo: number;
  precoAlvo: number;
  /** ISO 8601 */
  criadoEm: string;
}

function paraNumero(valor: string | number | null): number | null {
  if (valor === null) return null;
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** Grava a cotação e devolve o id. O resultado fica guardado junto da entrada que o gerou. */
export async function salvarCotacao(empresaId: string, nova: NovaCotacao): Promise<string> {
  const entrada = EntradaSchema.parse(nova.entrada);
  const resultado: postgres.JSONValue = JSON.parse(JSON.stringify(nova.calculo));
  const linhas = await sql<{ id: string }[]>`
    insert into cotacoes (empresa_id, item_id, descricao, frente, cnae, regime, entrada, resultado, preco_minimo, preco_alvo)
    values (
      ${empresaId},
      ${nova.itemId},
      ${nova.descricao},
      ${nova.frente},
      ${nova.cnae},
      ${nova.entrada.regime},
      ${sql.json(entrada)},
      ${sql.json(resultado)},
      ${nova.calculo.precoMinimo.preco.toFixed(2)},
      ${nova.calculo.precoAlvo.preco.toFixed(2)}
    )
    returning id
  `;
  const id = linhas[0]?.id;
  if (!id) throw new Error("A cotação não foi gravada");
  return id;
}

interface LinhaCotacao {
  id: string;
  item_id: string | null;
  descricao: string;
  frente: string;
  cnae: string | null;
  entrada: unknown;
  preco_minimo: string;
  preco_alvo: string;
  criado_em: Date;
}

/** Cotações de uma oportunidade ou, com itemId nulo, as mais recentes de todas. Linhas com jsonb inválido são ignoradas. */
export async function listarCotacoes(empresaId: string, itemId: string | null, limite: number): Promise<CotacaoSalva[]> {
  const linhas = await sql<LinhaCotacao[]>`
    select id, item_id, descricao, frente, cnae, entrada, preco_minimo, preco_alvo, criado_em
    from cotacoes
    where empresa_id = ${empresaId} and ${itemId === null ? sql`true` : sql`item_id = ${itemId}`}
    order by criado_em desc
    limit ${Math.max(1, Math.min(50, Math.trunc(limite)))}
  `;

  const cotacoes: CotacaoSalva[] = [];
  for (const l of linhas) {
    const entrada = EntradaSchema.safeParse(l.entrada);
    const frente = FrenteSchema.safeParse(l.frente);
    const minimo = paraNumero(l.preco_minimo);
    const alvo = paraNumero(l.preco_alvo);
    if (!entrada.success || !frente.success || minimo === null || alvo === null) continue;
    cotacoes.push({
      id: l.id,
      itemId: l.item_id,
      descricao: l.descricao,
      frente: frente.data,
      cnae: l.cnae,
      entrada: entrada.data,
      precoMinimo: minimo,
      precoAlvo: alvo,
      criadoEm: l.criado_em.toISOString(),
    });
  }
  return cotacoes;
}

interface LinhaItem {
  id: string;
  dados: unknown;
  valor_estimado: string | null;
}

/** Item do pipeline com o que a calculadora pré-preenche; null se não existe ou o jsonb é inválido. */
export async function lerItemParaCotacao(empresaId: string, id: string): Promise<ItemParaCotacao | null> {
  const linhas = await sql<LinhaItem[]>`
    select id, dados, valor_estimado from pipeline_itens where empresa_id = ${empresaId} and id = ${id} limit 1
  `;
  const linha = linhas[0];
  if (!linha) return null;
  const dados = DadosItemSchema.safeParse(linha.dados);
  if (!dados.success) return null;
  return {
    id: linha.id,
    objeto: dados.data.objeto,
    valorEstimado: paraNumero(linha.valor_estimado) ?? dados.data.valorEstimado ?? null,
    frente: dados.data.score.frenteCasada,
    cnae: dados.data.score.cnaesCasados[0] ?? null,
  };
}

interface LinhaCotacaoDoItem {
  item_id: string;
  descricao: string;
  frente: string;
  entrada: unknown;
  preco_alvo: string;
  criado_em: Date;
}

/** Resumo por item do pipeline (chave: id do item) das cotações da empresa. Linhas inválidas são ignoradas. */
export async function resumirCotacoesPorItem(empresaId: string): Promise<Map<string, ResumoCotacoes>> {
  const linhas = await sql<LinhaCotacaoDoItem[]>`
    select item_id, descricao, frente, entrada, preco_alvo, criado_em
    from cotacoes
    where empresa_id = ${empresaId} and item_id is not null
  `;
  const porItem = new Map<string, CotacaoParaResumo[]>();
  for (const l of linhas) {
    const entrada = EntradaSchema.safeParse(l.entrada);
    const frente = FrenteSchema.safeParse(l.frente);
    const venda = paraNumero(l.preco_alvo);
    if (!entrada.success || !frente.success || venda === null) continue;
    const lista = porItem.get(l.item_id) ?? [];
    lista.push({
      descricao: l.descricao,
      frente: frente.data,
      precoVenda: venda,
      custo: entrada.data.custo,
      margem: entrada.data.margemAlvo,
      criadoEm: l.criado_em.toISOString(),
    });
    porItem.set(l.item_id, lista);
  }
  const resumos = new Map<string, ResumoCotacoes>();
  for (const [itemId, lista] of porItem) {
    const resumo = resumirCotacoes(lista);
    if (resumo) resumos.set(itemId, resumo);
  }
  return resumos;
}
