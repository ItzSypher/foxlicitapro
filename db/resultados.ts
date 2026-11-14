import "server-only";
import { z } from "zod";
import { sql } from "@/db/client";
import type { EntradaResultados, ItemResultado, PrazosFicha } from "@/core/resultados";
import { lerFichaSalva } from "@/core/ficha";

/** Dados brutos do painel de resultados de uma empresa (tudo filtrado por empresa_id). */
export type DadosResultados = Pick<EntradaResultados, "itens" | "movimentos" | "propostasEnviadasEm">;

const itemSchema = z.object({
  id: z.string(),
  etapa: z.string(),
  etapa_em: z.date(),
  valor_estimado: z.union([z.string(), z.number()]).nullable(),
  valor_proposto: z.union([z.string(), z.number()]).nullable(),
  ficha: z.unknown(),
});

function numero(v: string | number | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function prazosDaFicha(bruto: unknown): PrazosFicha | null {
  const ficha = lerFichaSalva(bruto);
  if (ficha === null) return null;
  return {
    prazoEntregaDias: ficha.prazoEntregaDias.valor,
    prazoPagamentoDias: ficha.prazoPagamentoDias.valor,
    medicaoMensal: ficha.medicaoMensal.valor,
    pagamentoAntecipado: ficha.pagamentoAntecipado.valor,
  };
}

export async function lerDadosResultados(empresaId: string): Promise<DadosResultados> {
  const [linhasItens, linhasMov, linhasProp] = await Promise.all([
    sql`
      select i.id, i.etapa, i.valor_estimado,
             coalesce((select max(h.em) from pipeline_historico h
                       where h.empresa_id = i.empresa_id and h.item_id = i.id and h.para = i.etapa), i.atualizado_em) as etapa_em,
             (select max(p.total) from propostas p
              where p.empresa_id = i.empresa_id and p.compra_id = i.id and p.status in ('aprovada', 'pronta', 'enviada')) as valor_proposto,
             f.ficha
      from pipeline_itens i
      left join fichas_edital f on f.id_pncp = i.id
      where i.empresa_id = ${empresaId} and i.etapa in ('ganha', 'perdida')
    `,
    sql<{ item_id: string; em: Date }[]>`
      select item_id, em from pipeline_historico
      where empresa_id = ${empresaId} and para <> 'radar' and em >= now() - interval '13 months'
    `,
    sql<{ atualizado_em: Date }[]>`
      select atualizado_em from propostas
      where empresa_id = ${empresaId} and status = 'enviada' and atualizado_em >= now() - interval '13 months'
    `,
  ]);

  const itens: ItemResultado[] = [];
  for (const linha of linhasItens) {
    const l = itemSchema.parse(linha);
    itens.push({
      id: l.id,
      etapa: l.etapa,
      etapaEm: l.etapa_em.toISOString(),
      valorEstimado: numero(l.valor_estimado),
      valorProposto: numero(l.valor_proposto),
      ficha: prazosDaFicha(l.ficha),
    });
  }
  return {
    itens,
    movimentos: linhasMov.map((m) => ({ itemId: m.item_id, em: m.em.toISOString() })),
    propostasEnviadasEm: linhasProp.map((p) => p.atualizado_em.toISOString()),
  };
}
