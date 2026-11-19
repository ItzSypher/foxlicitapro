import "server-only";
import { z } from "zod";
import { sql } from "@/db/client";
import { DIAS_DESERTA_VALIDA, type Deserta } from "@/core/desertas";

const situacaoSchema = z.enum(["deserta", "fracassada", "mista"]);

interface LinhaDeserta {
  id: string;
  uf: string;
  codigo_ibge: string;
  municipio: string;
  orgao: string;
  orgao_cnpj: string;
  unidade: string;
  objeto: string;
  valor_estimado: string | null;
  itens_sem_vencedor: number;
  total_itens: number;
  situacao: string;
  deserta_em: Date;
  ano_compra: number;
  sequencial_compra: number;
  link_pncp: string;
}

function converter(l: LinhaDeserta): Deserta | null {
  const situacao = situacaoSchema.safeParse(l.situacao);
  if (!situacao.success) return null;
  return {
    id: l.id,
    uf: l.uf,
    codigoIbge: l.codigo_ibge,
    municipio: l.municipio,
    orgao: l.orgao,
    orgaoCnpj: l.orgao_cnpj,
    unidade: l.unidade,
    objeto: l.objeto,
    valorEstimado: l.valor_estimado === null ? null : Number(l.valor_estimado),
    itensSemVencedor: l.itens_sem_vencedor,
    totalItens: l.total_itens,
    situacao: situacao.data,
    desertaEm: l.deserta_em.toISOString(),
    anoCompra: l.ano_compra,
    sequencialCompra: l.sequencial_compra,
    linkPncp: l.link_pncp,
  };
}

/** Desertas das UFs pedidas dentro da validade (60 dias), da mais recente para a mais antiga. */
export async function listarDesertas(ufs: ReadonlyArray<string>): Promise<Deserta[]> {
  if (ufs.length === 0) return [];
  const linhas = await sql<LinhaDeserta[]>`
    select id, uf, codigo_ibge, municipio, orgao, orgao_cnpj, unidade, objeto, valor_estimado::text as valor_estimado,
           itens_sem_vencedor, total_itens, situacao, deserta_em, ano_compra, sequencial_compra, link_pncp
    from radar_desertas
    where uf in ${sql([...ufs])} and deserta_em > now() - make_interval(days => ${DIAS_DESERTA_VALIDA}::int)
    order by deserta_em desc
    limit 1000`;
  return linhas.flatMap((l) => {
    const d = converter(l);
    return d ? [d] : [];
  });
}

/** Grava (ou atualiza) as desertas coletadas. */
export async function gravarDesertas(desertas: ReadonlyArray<Deserta>, em: Date): Promise<void> {
  for (const d of desertas) {
    await sql`
      insert into radar_desertas (id, uf, codigo_ibge, municipio, orgao, orgao_cnpj, unidade, objeto, valor_estimado,
                                  itens_sem_vencedor, total_itens, situacao, deserta_em, ano_compra, sequencial_compra, link_pncp, coletada_em)
      values (${d.id}, ${d.uf}, ${d.codigoIbge}, ${d.municipio}, ${d.orgao}, ${d.orgaoCnpj}, ${d.unidade}, ${d.objeto},
              ${d.valorEstimado === null ? null : d.valorEstimado.toFixed(2)}, ${d.itensSemVencedor}, ${d.totalItens}, ${d.situacao},
              ${new Date(d.desertaEm)}, ${d.anoCompra}, ${d.sequencialCompra}, ${d.linkPncp}, ${em})
      on conflict (id) do update
        set objeto = excluded.objeto, valor_estimado = excluded.valor_estimado, itens_sem_vencedor = excluded.itens_sem_vencedor,
            total_itens = excluded.total_itens, situacao = excluded.situacao, deserta_em = excluded.deserta_em, coletada_em = excluded.coletada_em`;
  }
}

/** Apaga o que passou da validade. */
export async function apagarDesertasVelhas(): Promise<void> {
  await sql`delete from radar_desertas where deserta_em < now() - make_interval(days => ${DIAS_DESERTA_VALIDA + 5}::int)`;
}

/** Último dia (yyyyMMdd) que a coleta já olhou na UF; null se nunca olhou. */
export async function lerVarredura(uf: string): Promise<string | null> {
  const linhas = await sql<{ ate: string }[]>`select to_char(ate, 'YYYYMMDD') as ate from radar_desertas_varredura where uf = ${uf}`;
  return linhas[0]?.ate ?? null;
}

/** Guarda até que dia (yyyyMMdd) a UF já foi olhada. */
export async function gravarVarredura(uf: string, ate: string, em: Date): Promise<void> {
  const data = `${ate.slice(0, 4)}-${ate.slice(4, 6)}-${ate.slice(6, 8)}`;
  await sql`
    insert into radar_desertas_varredura (uf, ate, atualizado_em) values (${uf}, ${data}::date, ${em})
    on conflict (uf) do update set ate = excluded.ate, atualizado_em = excluded.atualizado_em`;
}
