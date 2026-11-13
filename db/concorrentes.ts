import "server-only";
import { z } from "zod";
import { sql } from "@/db/client";
import type { AmostraConcorrente } from "@/core/concorrentes";

/** Validade do cache de contratações homologadas e da busca de cada licitação. */
export const VALIDADE_DIAS = 7;
const LOTE = 100;

const linhaSchema = z.object({
  id_pncp: z.string(),
  objeto: z.string(),
  uf: z.string(),
  orgao: z.string(),
  valor_estimado: z.string().nullable(),
  valor_homologado: z.string(),
  publicada_em: z.date().nullable(),
  link: z.string(),
});

/** Contratações homologadas guardadas há menos de 7 dias. Linhas fora do formato são ignoradas. */
export async function lerAmostrasEmCache(): Promise<AmostraConcorrente[]> {
  const linhas = await sql`
    select id_pncp, objeto, uf, orgao, valor_estimado, valor_homologado, publicada_em, link
    from concorrentes_cache
    where buscado_em > now() - make_interval(days => ${VALIDADE_DIAS})
    order by publicada_em desc nulls last
    limit 5000
  `;
  const amostras: AmostraConcorrente[] = [];
  for (const l of linhas) {
    const r = linhaSchema.safeParse(l);
    if (!r.success) continue;
    const homologado = Number(r.data.valor_homologado);
    if (!Number.isFinite(homologado) || homologado <= 0) continue;
    const estimado = r.data.valor_estimado === null ? null : Number(r.data.valor_estimado);
    amostras.push({
      idPncp: r.data.id_pncp,
      objeto: r.data.objeto,
      uf: r.data.uf,
      orgao: r.data.orgao,
      valorEstimado: estimado !== null && Number.isFinite(estimado) ? estimado : null,
      valorHomologado: homologado,
      publicadaEm: r.data.publicada_em ? r.data.publicada_em.toISOString() : null,
      link: r.data.link,
    });
  }
  return amostras;
}

/** Grava (ou renova) as contratações no cache e apaga as vencidas. */
export async function gravarAmostras(amostras: readonly AmostraConcorrente[]): Promise<void> {
  await sql`delete from concorrentes_cache where buscado_em < now() - make_interval(days => ${VALIDADE_DIAS})`;
  for (let i = 0; i < amostras.length; i += LOTE) {
    const linhas = amostras.slice(i, i + LOTE).map((a) => ({
      id_pncp: a.idPncp,
      objeto: a.objeto,
      uf: a.uf,
      orgao: a.orgao,
      valor_estimado: a.valorEstimado,
      valor_homologado: a.valorHomologado,
      publicada_em: a.publicadaEm,
      link: a.link,
    }));
    await sql`
      insert into concorrentes_cache ${sql(linhas, "id_pncp", "objeto", "uf", "orgao", "valor_estimado", "valor_homologado", "publicada_em", "link")}
      on conflict (id_pncp) do update set
        objeto = excluded.objeto, uf = excluded.uf, orgao = excluded.orgao,
        valor_estimado = excluded.valor_estimado, valor_homologado = excluded.valor_homologado,
        publicada_em = excluded.publicada_em, link = excluded.link, buscado_em = now()
    `;
  }
}

export interface BuscaFeita {
  /** ISO */
  buscadoEm: string;
  requisicoes: number;
  falhas: number;
}

/** Última busca da licitação, se foi há menos de 7 dias. */
export async function lerBuscaRecente(idPncp: string): Promise<BuscaFeita | null> {
  const linhas = await sql`
    select buscado_em, requisicoes, falhas from concorrentes_buscas
    where id_pncp = ${idPncp} and buscado_em > now() - make_interval(days => ${VALIDADE_DIAS})
  `;
  const l = linhas[0];
  if (!l) return null;
  const r = z.object({ buscado_em: z.date(), requisicoes: z.number(), falhas: z.number() }).safeParse(l);
  return r.success ? { buscadoEm: r.data.buscado_em.toISOString(), requisicoes: r.data.requisicoes, falhas: r.data.falhas } : null;
}

export async function gravarBusca(idPncp: string, requisicoes: number, falhas: number): Promise<void> {
  await sql`
    insert into concorrentes_buscas (id_pncp, buscado_em, requisicoes, falhas)
    values (${idPncp}, now(), ${requisicoes}, ${falhas})
    on conflict (id_pncp) do update set buscado_em = now(), requisicoes = excluded.requisicoes, falhas = excluded.falhas
  `;
}
