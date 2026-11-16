import "server-only";
import { z } from "zod";
import { sql } from "@/db/client";
import type { EntradaResultados, ItemResultado, PrazosFicha } from "@/core/resultados";
import { ehMotivoPerda, type MotivoPerda } from "@/core/fechamento";
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
  objeto: z.string().nullable(),
  orgao: z.string().nullable(),
  regiao: z.enum(["nova-iguacu", "baixada", "capital", "rj", "fora-rj"]),
  frente: z.enum(["servicos", "produtos"]).nullable(),
  responsavel: z.string().nullable(),
  responsavel_nome: z.string().nullable(),
  valor_homologado: z.union([z.string(), z.number()]).nullable(),
  custo_real: z.union([z.string(), z.number()]).nullable(),
  fechado_em: z.date().nullable(),
  motivo_perda: z.string().nullable(),
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

/** Motivo gravado como texto livre: o que não é da lista vira "outro"; vazio, nenhum. */
function motivoDe(bruto: string | null): MotivoPerda | null {
  if (bruto === null || bruto.trim() === "") return null;
  return ehMotivoPerda(bruto) ? bruto : "outro";
}

export async function lerDadosResultados(empresaId: string): Promise<DadosResultados> {
  const [linhasItens, linhasMov, linhasProp] = await Promise.all([
    sql`
      select i.id, i.etapa, i.valor_estimado,
             coalesce((select max(h.em) from pipeline_historico h
                       where h.empresa_id = i.empresa_id and h.item_id = i.id and h.para = i.etapa), i.atualizado_em) as etapa_em,
             (select max(p.total) from propostas p
              where p.empresa_id = i.empresa_id and p.compra_id = i.id and p.status in ('aprovada', 'pronta', 'enviada')) as valor_proposto,
             f.ficha,
             i.dados->>'objeto' as objeto,
             i.dados->>'orgao' as orgao,
             coalesce(i.dados->>'regiao', 'fora-rj') as regiao,
             i.dados->'score'->>'frenteCasada' as frente,
             i.responsavel, r.nome as responsavel_nome,
             i.valor_homologado, i.custo_real, i.fechado_em, i.motivo_perda
      from pipeline_itens i
      left join fichas_edital f on f.id_pncp = i.id
      left join usuarios r on r.id = i.responsavel
      where i.empresa_id = ${empresaId} and i.etapa in ('ganha', 'perdida', 'disputa')
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
      objeto: l.objeto ?? "",
      orgao: l.orgao ?? "",
      regiao: l.regiao,
      frente: l.frente,
      responsavelId: l.responsavel,
      responsavelNome: l.responsavel_nome,
      valorHomologado: numero(l.valor_homologado),
      custoReal: numero(l.custo_real),
      fechadoEm: l.fechado_em === null ? null : l.fechado_em.toISOString(),
      motivoPerda: motivoDe(l.motivo_perda),
    });
  }
  return {
    itens,
    movimentos: linhasMov.map((m) => ({ itemId: m.item_id, em: m.em.toISOString() })),
    propostasEnviadasEm: linhasProp.map((p) => p.atualizado_em.toISOString()),
  };
}

export interface DadosFechamento {
  valorHomologado: number | null;
  custoReal: number | null;
  motivoPerda: MotivoPerda | null;
}

/**
 * Grava o fechamento de um item ganho ou perdido. Falso quando o item não existe ou já não está em Ganha nem em Perdida.
 * `fechado_em` guarda só a primeira vez; `atualizado_em` não muda, porque dele sai a data da etapa em itens antigos.
 */
export async function gravarFechamento(empresaId: string, id: string, dados: DadosFechamento): Promise<boolean> {
  const r = await sql`
    update pipeline_itens
    set valor_homologado = ${dados.valorHomologado},
        custo_real = ${dados.custoReal},
        motivo_perda = ${dados.motivoPerda},
        fechado_em = coalesce(fechado_em, now())
    where empresa_id = ${empresaId} and id = ${id} and etapa in ('ganha', 'perdida')
  `;
  return r.count > 0;
}
