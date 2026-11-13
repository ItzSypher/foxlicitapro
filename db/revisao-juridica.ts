import "server-only";
import { z } from "zod";
import { sql } from "@/db/client";
import { ETAPA_REVISAO, type MarcaJuridica, type PassoJuridicoId } from "@/core/revisao-juridica";

const passoSchema = z.enum(["habilitacao", "clausulas_risco", "garantia_multas", "prazos"]);

const linhaSchema = z.object({
  item_id: z.string(),
  passo: passoSchema,
  marcado_por: z.string().nullable(),
  marcado_por_nome: z.string().nullable(),
  marcado_em: z.date(),
});

/** Converte a linha do banco em marca; linha fora do formato vira null. */
export function paraMarca(linha: unknown): (MarcaJuridica & { itemId: string }) | null {
  const lida = linhaSchema.safeParse(linha);
  if (!lida.success) return null;
  const l = lida.data;
  return { itemId: l.item_id, passo: l.passo, porId: l.marcado_por, porNome: l.marcado_por_nome, em: l.marcado_em.toISOString() };
}

/** Marcas de todos os itens, agrupadas por item. */
export async function listarMarcasPorItem(): Promise<Map<string, MarcaJuridica[]>> {
  const linhas = await sql`
    select p.item_id, p.passo, p.marcado_por, u.nome as marcado_por_nome, p.marcado_em
    from revisao_juridica_passos p
    left join usuarios u on u.id = p.marcado_por
    order by p.marcado_em asc
  `;
  const mapa = new Map<string, MarcaJuridica[]>();
  for (const linha of linhas) {
    const m = paraMarca(linha);
    if (!m) continue;
    const { itemId, ...marca } = m;
    const lista = mapa.get(itemId) ?? [];
    lista.push(marca);
    mapa.set(itemId, lista);
  }
  return mapa;
}

/** Marcas de um item. */
export async function listarMarcas(itemId: string): Promise<MarcaJuridica[]> {
  const linhas = await sql`
    select p.item_id, p.passo, p.marcado_por, u.nome as marcado_por_nome, p.marcado_em
    from revisao_juridica_passos p
    left join usuarios u on u.id = p.marcado_por
    where p.item_id = ${itemId}
    order by p.marcado_em asc
  `;
  const marcas: MarcaJuridica[] = [];
  for (const linha of linhas) {
    const m = paraMarca(linha);
    if (!m) continue;
    marcas.push({ passo: m.passo, porId: m.porId, porNome: m.porNome, em: m.em });
  }
  return marcas;
}

/**
 * Marca ou desmarca um passo. Só vale com o item na etapa "Revisão jurídica".
 * Devolve false quando o item não existe ou está em outra etapa.
 */
export async function definirPasso(
  itemId: string,
  passo: PassoJuridicoId,
  marcado: boolean,
  usuarioId: string,
): Promise<boolean> {
  const alvo = await sql`select 1 from pipeline_itens where id = ${itemId} and etapa = ${ETAPA_REVISAO}`;
  if (alvo.length === 0) return false;
  if (marcado) {
    await sql`
      insert into revisao_juridica_passos (item_id, passo, marcado_por, marcado_em)
      values (${itemId}, ${passo}, ${usuarioId}, now())
      on conflict (item_id, passo) do nothing
    `;
  } else {
    await sql`delete from revisao_juridica_passos where item_id = ${itemId} and passo = ${passo}`;
  }
  return true;
}
