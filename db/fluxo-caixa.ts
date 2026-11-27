import "server-only";
import { z } from "zod";
import { sql } from "@/db/client";
import { lerFichaSalva } from "@/core/ficha";
import type { GanhoParaCaixa } from "@/core/fluxo-caixa";
import { comissaoDoItem } from "@/core/lucro";
import { COMISSAO_MAXIMA, COMISSAO_MINIMA } from "@/core/lucro";

const numeroBruto = z.union([z.string(), z.number()]).nullable();

const linhaSchema = z.object({
  id: z.string(),
  objeto: z.string().nullable(),
  orgao: z.string().nullable(),
  frente: z.enum(["servicos", "produtos"]).nullable(),
  valor_estimado: numeroBruto,
  valor_proposto: numeroBruto,
  valor_homologado: numeroBruto,
  valor_recebido: numeroBruto,
  custo_real: numeroBruto,
  comissao_percentual: numeroBruto,
  pagamento_previsto: z.string().nullable(),
  recebido_em: z.string().nullable(),
  ganho_em: z.date().nullable(),
  dev_custo: numeroBruto,
  dev_parcelas: numeroBruto,
  contrato_meses: numeroBruto,
  terceirizavel: z.boolean().nullable(),
  ficha: z.unknown(),
});

function numero(v: string | number | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Licitações na etapa Ganha com o que o fluxo de caixa precisa. O dia da vitória é o da última entrada
 * em "ganha" no histórico; os prazos vêm da ficha do edital, quando há. Sempre só da empresa da sessão.
 */
export async function listarGanhosParaCaixa(empresaId: string): Promise<GanhoParaCaixa[]> {
  const linhas = await sql`
    select i.id,
           i.dados->>'objeto' as objeto,
           i.dados->>'orgao' as orgao,
           i.dados->'score'->>'frenteCasada' as frente,
           i.valor_estimado, i.valor_homologado, i.valor_recebido, i.custo_real, i.comissao_percentual,
           i.dev_custo, i.dev_parcelas, i.contrato_meses, i.terceirizavel,
           to_char(i.pagamento_previsto, 'YYYY-MM-DD') as pagamento_previsto,
           to_char(i.recebido_em, 'YYYY-MM-DD') as recebido_em,
           (select max(p.total) from propostas p
            where p.empresa_id = i.empresa_id and p.compra_id = i.id and p.status in ('aprovada', 'pronta', 'enviada')) as valor_proposto,
           (select max(h.em) from pipeline_historico h
            where h.empresa_id = i.empresa_id and h.item_id = i.id and h.para = 'ganha') as ganho_em,
           f.ficha
    from pipeline_itens i
    left join fichas_edital f on f.id_pncp = i.id
    where i.empresa_id = ${empresaId} and i.etapa = 'ganha'
  `;
  const ganhos: GanhoParaCaixa[] = [];
  for (const linha of linhas) {
    const l = linhaSchema.parse(linha);
    const ficha = lerFichaSalva(l.ficha);
    ganhos.push({
      id: l.id,
      objeto: l.objeto ?? "",
      orgao: l.orgao ?? "",
      valorEstimado: numero(l.valor_estimado),
      valorProposto: numero(l.valor_proposto),
      valorHomologado: numero(l.valor_homologado),
      valorRecebido: numero(l.valor_recebido),
      custoReal: numero(l.custo_real),
      comissaoAjuste: numero(l.comissao_percentual),
      pagamentoPrevisto: l.pagamento_previsto,
      recebidoEm: l.recebido_em,
      ganhoEm: l.ganho_em === null ? null : l.ganho_em.toISOString(),
      prazoEntregaDias: ficha?.prazoEntregaDias.valor ?? null,
      prazoPagamentoDias: ficha?.prazoPagamentoDias.valor ?? null,
      frente: l.frente,
      devCusto: numero(l.dev_custo),
      devParcelas: numero(l.dev_parcelas),
      contratoMeses: numero(l.contrato_meses),
      terceirizavel: l.terceirizavel,
    });
  }
  return ganhos;
}

const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;

function diaValido(dia: string): boolean {
  if (!FORMATO_DIA.test(dia)) return false;
  const d = new Date(`${dia}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dia;
}

/**
 * Marca o pagamento como recebido (data e valor) ou, com null, desfaz. Só itens na etapa Ganha.
 * Falso quando o item não existe, não é da empresa ou a data/valor são inválidos.
 */
export async function gravarRecebido(
  empresaId: string,
  id: string,
  recebido: { recebidoEm: string; valor: number } | null,
): Promise<boolean> {
  if (recebido !== null && (!diaValido(recebido.recebidoEm) || !Number.isFinite(recebido.valor) || recebido.valor < 0)) return false;
  const dia = recebido === null ? null : recebido.recebidoEm;
  const valor = recebido === null ? null : Math.round(recebido.valor * 100) / 100;
  const r = await sql`
    update pipeline_itens
    set recebido_em = ${dia}::date, valor_recebido = ${valor}
    where empresa_id = ${empresaId} and id = ${id} and etapa = 'ganha'
  `;
  return r.count > 0;
}

/** Data prevista do pagamento ("AAAA-MM-DD"); null volta a usar o prazo do edital. */
export async function gravarPagamentoPrevisto(empresaId: string, id: string, dia: string | null): Promise<boolean> {
  if (dia !== null && !diaValido(dia)) return false;
  const r = await sql`
    update pipeline_itens
    set pagamento_previsto = ${dia}::date
    where empresa_id = ${empresaId} and id = ${id} and etapa = 'ganha'
  `;
  return r.count > 0;
}

/** Custo real da licitação, em reais; null volta a estimar o custo. Só itens na etapa Ganha. */
export async function gravarCustoRealDoItem(empresaId: string, id: string, custo: number | null): Promise<boolean> {
  if (custo !== null && (!Number.isFinite(custo) || custo < 0)) return false;
  const valor = custo === null ? null : Math.round(custo * 100) / 100;
  const r = await sql`
    update pipeline_itens
    set custo_real = ${valor}
    where empresa_id = ${empresaId} and id = ${id} and etapa = 'ganha'
  `;
  return r.count > 0;
}

/** Comissão desta licitação (0 a 30%); null tira a comissão (sem "Tem comissão" marcado). */
export async function gravarComissaoDoItem(empresaId: string, id: string, percentual: number | null): Promise<boolean> {
  if (percentual !== null && (!Number.isFinite(percentual) || percentual < COMISSAO_MINIMA || percentual > COMISSAO_MAXIMA)) return false;
  const valor = percentual === null ? null : Math.round(percentual * 100) / 100;
  const r = await sql`
    update pipeline_itens
    set comissao_percentual = ${valor}
    where empresa_id = ${empresaId} and id = ${id} and etapa = 'ganha'
  `;
  return r.count > 0;
}

/** Comissão do item do pipeline (0 quando ninguém marcou "Tem comissão"); sempre só da empresa informada. */
export async function lerComissaoDoItemPipeline(empresaId: string, itemId: string | null): Promise<number> {
  if (itemId === null) return 0;
  const linhas = await sql<{ comissao_percentual: string | number | null }[]>`
    select comissao_percentual from pipeline_itens
    where empresa_id = ${empresaId} and id = ${itemId}
  `;
  return comissaoDoItem(numero(linhas[0]?.comissao_percentual ?? null));
}
