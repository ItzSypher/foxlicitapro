import "server-only";
import { sql } from "./client";
import { lerFichaSalva, type FichaEdital, type FichaSalva } from "@/core/ficha";

interface Linha {
  ficha: unknown;
  gerada_em: Date;
  gerada_por_nome: string | null;
  confirmada_por_nome: string | null;
  confirmada_em: Date | null;
}

/** Ficha do edital, se já foi gerada. Conteúdo gravado fora do formato atual é tratado como ausente. */
export async function lerFicha(idPncp: string): Promise<FichaSalva | null> {
  const linhas = await sql<Linha[]>`
    select f.ficha, f.gerada_em, g.nome as gerada_por_nome, c.nome as confirmada_por_nome, f.confirmada_em
    from fichas_edital f
    left join usuarios g on g.id = f.gerada_por
    left join usuarios c on c.id = f.confirmada_por
    where f.id_pncp = ${idPncp}`;
  const l = linhas[0];
  if (!l) return null;
  const ficha = lerFichaSalva(l.ficha);
  if (ficha === null) return null;
  return {
    ficha,
    geradaEm: l.gerada_em.toISOString(),
    geradaPorNome: l.gerada_por_nome,
    confirmadaPorNome: l.confirmada_por_nome,
    confirmadaEm: l.confirmada_em ? l.confirmada_em.toISOString() : null,
  };
}

/** Grava (ou substitui) a ficha. Ficha nova volta a ficar "não conferida". */
export async function gravarFicha(idPncp: string, ficha: FichaEdital, usuarioId: string): Promise<void> {
  await sql`
    insert into fichas_edital (id_pncp, ficha, gerada_em, gerada_por, confirmada_por, confirmada_em)
    values (${idPncp}, ${sql.json(JSON.parse(JSON.stringify(ficha)))}, now(), ${usuarioId}, null, null)
    on conflict (id_pncp) do update
      set ficha = excluded.ficha, gerada_em = excluded.gerada_em, gerada_por = excluded.gerada_por,
          confirmada_por = null, confirmada_em = null`;
}

/** Marca a ficha como conferida. Devolve false se ela não existe. */
export async function confirmarFicha(idPncp: string, usuarioId: string): Promise<boolean> {
  const linhas = await sql`
    update fichas_edital set confirmada_por = ${usuarioId}, confirmada_em = now()
    where id_pncp = ${idPncp}
    returning id_pncp`;
  return linhas.length > 0;
}
