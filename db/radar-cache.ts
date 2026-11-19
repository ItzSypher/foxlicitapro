import "server-only";
import { z } from "zod";
import { sql } from "./client";
import type { ModalidadeId, Oportunidade } from "@/core/types";

const dataIso = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "data inválida");

const oportunidadeSchema: z.ZodType<Oportunidade> = z.object({
  id: z.string().min(1),
  objeto: z.string(),
  valorEstimado: z.number().nullable(),
  orgao: z.string(),
  orgaoCnpj: z.string(),
  unidade: z.string(),
  municipio: z.string(),
  codigoIbge: z.string(),
  uf: z.string(),
  regiao: z.enum(["nova-iguacu", "baixada", "capital", "rj", "fora-rj"]),
  modalidadeId: z.union([z.literal(6), z.literal(8)]),
  modalidadeNome: z.string(),
  dataAbertura: dataIso.nullable(),
  dataPublicacao: dataIso.nullish(),
  dataEncerramento: dataIso,
  anoCompra: z.number(),
  sequencialCompra: z.number(),
  linkPncp: z.string(),
  linkOrigem: z.string().nullable(),
});

export interface LinhaCache {
  uf: string;
  modalidadeId: ModalidadeId;
  oportunidades: Oportunidade[];
  atualizadoEm: Date;
  falhouEm: Date | null;
}

/**
 * Lê o cache das UFs pedidas (todas, se `ufs` for omitido), uma linha por UF e modalidade.
 * Itens que não passam na validação são descartados.
 */
export async function lerCacheRadar(ufs?: ReadonlyArray<string>): Promise<LinhaCache[]> {
  if (ufs !== undefined && ufs.length === 0) return [];
  const linhas = await sql<
    { uf: string; modalidade_id: number; oportunidades: unknown; atualizado_em: Date; falhou_em: Date | null }[]
  >`select uf, modalidade_id, oportunidades, atualizado_em, falhou_em from radar_cache
    ${ufs === undefined ? sql`` : sql`where uf in ${sql([...ufs])}`}`;

  return linhas.flatMap((l) => {
    if (l.modalidade_id !== 6 && l.modalidade_id !== 8) return [];
    const brutas = Array.isArray(l.oportunidades) ? l.oportunidades : [];
    const oportunidades = brutas.flatMap((b) => {
      const r = oportunidadeSchema.safeParse(b);
      return r.success ? [r.data] : [];
    });
    return [{ uf: l.uf, modalidadeId: l.modalidade_id, oportunidades, atualizadoEm: l.atualizado_em, falhouEm: l.falhou_em }];
  });
}

/** Grava o resultado de uma UF e modalidade (substitui a lista e zera a falha). */
export async function gravarModalidade(uf: string, modalidadeId: ModalidadeId, oportunidades: Oportunidade[], em: Date): Promise<void> {
  await sql`
    insert into radar_cache (uf, modalidade_id, oportunidades, total, atualizado_em, falhou_em)
    values (${uf}, ${modalidadeId}, ${sql.json(JSON.parse(JSON.stringify(oportunidades)))}, ${oportunidades.length}, ${em}, null)
    on conflict (uf, modalidade_id) do update
      set oportunidades = excluded.oportunidades, total = excluded.total,
          atualizado_em = excluded.atualizado_em, falhou_em = null`;
}

/** Marca que a última tentativa da UF e modalidade falhou, sem apagar a lista anterior. */
export async function marcarFalha(uf: string, modalidadeId: ModalidadeId, em: Date): Promise<void> {
  await sql`update radar_cache set falhou_em = ${em} where uf = ${uf} and modalidade_id = ${modalidadeId}`;
}

/** Tenta pegar a trava de coleta. Devolve false se outra coleta começou há menos de `segundos`. */
export async function pegarTrava(segundos = 180): Promise<boolean> {
  const linhas = await sql`
    insert into radar_trava (id, em) values (1, now())
    on conflict (id) do update set em = now()
      where radar_trava.em < now() - make_interval(secs => ${segundos})
    returning id`;
  return linhas.length > 0;
}

export async function soltarTrava(): Promise<void> {
  await sql`update radar_trava set em = to_timestamp(0) where id = 1`;
}
