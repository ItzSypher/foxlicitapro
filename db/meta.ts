import "server-only";
import { z } from "zod";
import { sql } from "@/db/client";
import {
  META_PADRAO,
  inicioDaSemana,
  inicioDoHistorico,
  montarPainelMeta,
  normalizarMeta,
  type EntradaEmDisputa,
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

const entradaSchema = z.object({ item_id: z.string(), em: z.date() });

/** Entradas na etapa "disputa" desde `desde`, a partir do histórico de etapas do pipeline. */
async function listarEntradasEmDisputa(empresaId: string, desde: Date): Promise<EntradaEmDisputa[]> {
  const linhas = await sql`
    select h.item_id, h.em
    from pipeline_historico h
    join pipeline_itens i on i.empresa_id = h.empresa_id and i.id = h.item_id
    where h.empresa_id = ${empresaId} and h.para = 'disputa' and h.em >= ${desde.toISOString()}::timestamptz
  `;
  return linhas.map((linha) => {
    const l = entradaSchema.parse(linha);
    return { itemId: l.item_id, em: l.em };
  });
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
    const [meta, entradas, propostas] = await Promise.all([
      lerMetaDisputas(empresaId),
      listarEntradasEmDisputa(empresaId, inicioDoHistorico(agora)),
      contarPropostas(empresaId, inicio).catch((e: unknown): PropostasDaSemana => {
        console.error("[meta] propostas indisponíveis:", e instanceof Error ? e.message : e);
        return { enviadas: 0, aguardando: 0, ganhas: 0 };
      }),
    ]);
    return montarPainelMeta(entradas, agora, meta, propostas);
  } catch (e) {
    console.error("[meta] painel indisponível:", e instanceof Error ? e.message : e);
    return null;
  }
}
