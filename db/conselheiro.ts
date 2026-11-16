import "server-only";
import { lerSaidaConselheiro, type AnaliseSalva, type SaidaConselheiro, type VereditoConselheiro } from "@/lib/conselheiro/esquema";
import { sql } from "./client";

interface Linha {
  id: string;
  item_id: string;
  criado_em: Date;
  criado_por_nome: string | null;
  modelo: string;
  resultado: unknown;
}

function paraAnalise(l: Linha): AnaliseSalva | null {
  const resultado = lerSaidaConselheiro(l.resultado);
  if (resultado === null) return null;
  return {
    id: l.id,
    itemId: l.item_id,
    criadoEm: l.criado_em.toISOString(),
    criadoPorNome: l.criado_por_nome,
    modelo: l.modelo,
    resultado,
  };
}

/** Grava uma análise nova (as antigas ficam no histórico) e devolve o id. */
export async function salvarAnalise(
  empresaId: string,
  d: { itemId: string; criadoPor: string; modelo: string; resultado: SaidaConselheiro },
): Promise<string> {
  const [linha] = await sql<{ id: string }[]>`
    insert into conselheiro_analises (empresa_id, item_id, criado_por, modelo, resultado)
    values (${empresaId}, ${d.itemId}, ${d.criadoPor}, ${d.modelo}, ${sql.json(JSON.parse(JSON.stringify(d.resultado)))})
    returning id`;
  return linha.id;
}

/** Análise mais recente do item na empresa. Conteúdo gravado fora do formato atual é tratado como ausente. */
export async function lerUltimaAnalise(empresaId: string, itemId: string): Promise<AnaliseSalva | null> {
  const linhas = await sql<Linha[]>`
    select a.id, a.item_id, a.criado_em, u.nome as criado_por_nome, a.modelo, a.resultado
    from conselheiro_analises a
    left join usuarios u on u.id = a.criado_por
    where a.empresa_id = ${empresaId} and a.item_id = ${itemId}
    order by a.criado_em desc
    limit 1`;
  const l = linhas[0];
  return l ? paraAnalise(l) : null;
}

export interface ResumoAnalise {
  criadoEm: string;
  veredito: VereditoConselheiro;
}

/** Veredito e data da análise mais recente de cada item da empresa (para a lista da tela). */
export async function resumirAnalisesPorItem(empresaId: string): Promise<Map<string, ResumoAnalise>> {
  const linhas = await sql<Array<{ item_id: string; criado_em: Date; resultado: unknown }>>`
    select distinct on (item_id) item_id, criado_em, resultado
    from conselheiro_analises
    where empresa_id = ${empresaId}
    order by item_id, criado_em desc`;
  const mapa = new Map<string, ResumoAnalise>();
  for (const l of linhas) {
    const resultado = lerSaidaConselheiro(l.resultado);
    if (resultado !== null) mapa.set(l.item_id, { criadoEm: l.criado_em.toISOString(), veredito: resultado.veredito });
  }
  return mapa;
}

/** Análises que a pessoa pediu no intervalo [de, ate). */
export async function contarAnalisesDaPessoa(empresaId: string, usuarioId: string, de: Date, ate: Date): Promise<number> {
  const [linha] = await sql<{ total: number }[]>`
    select count(*)::int as total from conselheiro_analises
    where empresa_id = ${empresaId} and criado_por = ${usuarioId}
      and criado_em >= ${de} and criado_em < ${ate}`;
  return linha?.total ?? 0;
}
