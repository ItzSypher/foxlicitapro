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
  dataEncerramento: dataIso,
  anoCompra: z.number(),
  sequencialCompra: z.number(),
  linkPncp: z.string(),
  linkOrigem: z.string().nullable(),
});

export interface LinhaCache {
  modalidadeId: ModalidadeId;
  oportunidades: Oportunidade[];
  atualizadoEm: Date;
  falhouEm: Date | null;
}

/** Lê o cache das duas modalidades. Itens que não passam na validação são descartados. */
export async function lerCacheRadar(): Promise<LinhaCache[]> {
  const linhas = await sql<
    { modalidade_id: number; oportunidades: unknown; atualizado_em: Date; falhou_em: Date | null }[]
  >`select modalidade_id, oportunidades, atualizado_em, falhou_em from radar_cache`;

  return linhas.flatMap((l) => {
    if (l.modalidade_id !== 6 && l.modalidade_id !== 8) return [];
    const brutas = Array.isArray(l.oportunidades) ? l.oportunidades : [];
    const oportunidades = brutas.flatMap((b) => {
      const r = oportunidadeSchema.safeParse(b);
      return r.success ? [r.data] : [];
    });
    return [{ modalidadeId: l.modalidade_id, oportunidades, atualizadoEm: l.atualizado_em, falhouEm: l.falhou_em }];
  });
}

/** Grava o resultado de uma modalidade (substitui a lista e zera a falha). */
export async function gravarModalidade(modalidadeId: ModalidadeId, oportunidades: Oportunidade[], em: Date): Promise<void> {
  await sql`
    insert into radar_cache (modalidade_id, oportunidades, total, atualizado_em, falhou_em)
    values (${modalidadeId}, ${sql.json(JSON.parse(JSON.stringify(oportunidades)))}, ${oportunidades.length}, ${em}, null)
    on conflict (modalidade_id) do update
      set oportunidades = excluded.oportunidades, total = excluded.total,
          atualizado_em = excluded.atualizado_em, falhou_em = null`;
}

/** Marca que a última tentativa da modalidade falhou, sem apagar a lista anterior. */
export async function marcarFalha(modalidadeId: ModalidadeId, em: Date): Promise<void> {
  await sql`update radar_cache set falhou_em = ${em} where modalidade_id = ${modalidadeId}`;
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
