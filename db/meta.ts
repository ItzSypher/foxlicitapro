import "server-only";
import { z } from "zod";
import { sql } from "@/db/client";
import {
  META_PADRAO,
  ganhosDaJanela,
  inicioDaSemana,
  inicioDoHistorico,
  montarPainelMeta,
  normalizarMeta,
  type EntradaEmDisputa,
  type EntradaVencida,
  type GanhosMeta,
  type MetaConfig,
  type PainelMeta,
  type PropostasDaSemana,
} from "@/core/meta";

const linhaMetaSchema = z.object({
  meta_disputas_min: z.number().int(),
  meta_disputas_ideal: z.number().int(),
});

/**
 * Meta da empresa. Sem a migration 021 (ou com falha de leitura), vale o padrão: a meta nunca derruba a tela.
 */
export async function lerMetaDisputas(empresaId: string): Promise<MetaConfig> {
  try {
    const linhas = await sql`select meta_disputas_min, meta_disputas_ideal from empresas where id = ${empresaId} limit 1`;
    const lida = linhaMetaSchema.safeParse(linhas[0]);
    return lida.success ? normalizarMeta(lida.data.meta_disputas_min, lida.data.meta_disputas_ideal) : META_PADRAO;
  } catch (e) {
    console.error("[meta] leitura da meta falhou:", e instanceof Error ? e.message : e);
    return META_PADRAO;
  }
}

/** Grava a meta já normalizada (mínimo de 1, ideal nunca abaixo do mínimo). Falso se a empresa não existe. */
export async function gravarMetaDisputas(empresaId: string, minimo: number, ideal: number): Promise<boolean> {
  const meta = normalizarMeta(minimo, ideal);
  const linhas = await sql<{ id: string }[]>`
    update empresas set meta_disputas_min = ${meta.minimo}, meta_disputas_ideal = ${meta.ideal}
    where id = ${empresaId}
    returning id
  `;
  return linhas.length > 0;
}

const entradaSchema = z.object({
  item_id: z.string(),
  em: z.date(),
  valor_proposto: z.number().nullable(),
  valor_estimado: z.number().nullable(),
});

/**
 * Entradas na etapa `etapa` desde `desde`, a partir do histórico de etapas do pipeline. O valor é o maior total
 * entre as propostas aprovadas, prontas ou enviadas do item; sem proposta, o valor estimado (marcado como estimado).
 */
async function listarEntradasNaEtapa(empresaId: string, etapa: "disputa" | "ganha", desde: Date): Promise<EntradaEmDisputa[]> {
  const linhas = await sql`
    select h.item_id, h.em,
           (select max(p.total)::float8 from propostas p
            where p.empresa_id = i.empresa_id and p.compra_id = i.id and p.status in ('aprovada', 'pronta', 'enviada')) as valor_proposto,
           i.valor_estimado::float8 as valor_estimado
    from pipeline_historico h
    join pipeline_itens i on i.empresa_id = h.empresa_id and i.id = h.item_id
    where h.empresa_id = ${empresaId} and h.para = ${etapa} and h.em >= ${desde.toISOString()}::timestamptz
  `;
  return linhas.map((linha) => {
    const l = entradaSchema.parse(linha);
    const proposto = l.valor_proposto !== null && l.valor_proposto > 0 ? l.valor_proposto : null;
    if (proposto !== null) return { itemId: l.item_id, em: l.em, valor: proposto, estimado: false };
    const estimado = l.valor_estimado !== null && l.valor_estimado > 0 ? l.valor_estimado : null;
    return { itemId: l.item_id, em: l.em, valor: estimado, estimado: estimado !== null };
  });
}

/** Itens que entraram em "ganha" desde `desde`; sem a leitura, a lista vem vazia e o painel segue. */
async function listarVencidas(empresaId: string, desde: Date): Promise<EntradaVencida[]> {
  try {
    return await listarEntradasNaEtapa(empresaId, "ganha", desde);
  } catch (e) {
    console.error("[meta] vencidas indisponíveis:", e instanceof Error ? e.message : e);
    return [];
  }
}

/** Disputadas e vencidas da semana de `agora`, com valores; para o resumo do WhatsApp. Zerado se a leitura falhar. */
export async function lerGanhosDaSemana(empresaId: string, agora: Date): Promise<GanhosMeta> {
  const inicio = inicioDaSemana(agora);
  try {
    const [disputas, vencidas] = await Promise.all([
      listarEntradasNaEtapa(empresaId, "disputa", inicio),
      listarEntradasNaEtapa(empresaId, "ganha", inicio),
    ]);
    return ganhosDaJanela(disputas, vencidas, inicio);
  } catch (e) {
    console.error("[meta] ganhos da semana indisponíveis:", e instanceof Error ? e.message : e);
    return ganhosDaJanela([], [], inicio);
  }
}

const contagemSchema = z.object({ enviadas: z.number().int(), aguardando: z.number().int(), ganhas: z.number().int() });

/** Enviadas e ganhas na semana; aguardando resultado é o total em aberto. */
async function contarPropostas(empresaId: string, inicio: Date): Promise<PropostasDaSemana> {
  const linhas = await sql`
    select
      count(*) filter (where enviada_em >= ${inicio.toISOString()}::timestamptz)::int as enviadas,
      count(*) filter (where status = 'enviada' and (resultado is null or resultado = 'aguardando'))::int as aguardando,
      count(*) filter (where resultado = 'ganhou' and coalesce(resultado_em, enviada_em) >= ${inicio.toISOString()}::timestamptz)::int as ganhas
    from propostas
    where empresa_id = ${empresaId}
  `;
  const lida = contagemSchema.safeParse(linhas[0]);
  return lida.success ? lida.data : { enviadas: 0, aguardando: 0, ganhas: 0 };
}

/** Painel "Meta da semana"; null se não foi possível ler (a tela segue sem o painel). */
export async function carregarPainelMeta(empresaId: string, agora: Date): Promise<PainelMeta | null> {
  try {
    const inicio = inicioDaSemana(agora);
    const desde = inicioDoHistorico(agora);
    const [meta, entradas, vencidas, propostas] = await Promise.all([
      lerMetaDisputas(empresaId),
      listarEntradasNaEtapa(empresaId, "disputa", desde),
      listarVencidas(empresaId, desde),
      contarPropostas(empresaId, inicio).catch((e: unknown): PropostasDaSemana => {
        console.error("[meta] propostas indisponíveis:", e instanceof Error ? e.message : e);
        return { enviadas: 0, aguardando: 0, ganhas: 0 };
      }),
    ]);
    return montarPainelMeta(entradas, agora, meta, propostas, vencidas);
  } catch (e) {
    console.error("[meta] painel indisponível:", e instanceof Error ? e.message : e);
    return null;
  }
}
