import "server-only";
import type postgres from "postgres";
import { z } from "zod";
import { sql } from "@/db/client";
import type { OportunidadeComScore } from "@/core/types";
import type { ComentarioPipeline } from "@/core/types-equipe";
import {
  ETAPAS,
  ROTULO_ETAPA,
  montarResumo,
  type EtapaId,
  type ItemPipeline,
  type ResumoPipeline,
} from "@/components/pipeline/tipos";

export { ETAPAS, ROTULO_ETAPA };
export type { EtapaId, ItemPipeline, ResumoPipeline };

const etapaSchema = z.enum(["radar", "analisando", "cotando", "proposta", "disputa", "ganha", "perdida"]);

const dataIso = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "data inválida");

const criterioSchema = z.object({
  id: z.enum(["cnae", "modalidade", "local", "documentacao", "valor"]),
  rotulo: z.string(),
  pontos: z.number(),
  maximo: z.number(),
  motivo: z.string(),
  aConfirmar: z.boolean(),
});

const scoreSchema = z.object({
  total: z.number(),
  faixa: z.enum(["go", "atencao", "nogo"]),
  criterios: z.array(criterioSchema),
  cnaesCasados: z.array(z.string()),
  frenteCasada: z.enum(["servicos", "produtos"]).nullable(),
});

export const oportunidadeComScoreSchema: z.ZodType<OportunidadeComScore> = z.object({
  id: z.string().min(1).max(200),
  objeto: z.string().max(10_000),
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
  score: scoreSchema,
});

const linhaSchema = z.object({
  id: z.string(),
  etapa: etapaSchema,
  ordem: z.number(),
  dados: oportunidadeComScoreSchema,
  notas: z.string(),
  criado_em: z.date(),
  atualizado_em: z.date(),
  criado_por: z.string().nullable(),
  criado_por_nome: z.string().nullable(),
  responsavel: z.string().nullable(),
  responsavel_nome: z.string().nullable(),
  comentarios: z.number(),
});

const historicoSchema = z.object({
  de: etapaSchema.nullable(),
  para: etapaSchema,
  em: z.date(),
});

export interface EventoHistorico {
  de: EtapaId | null;
  para: EtapaId;
  em: string;
}

/** Todos os itens, por etapa e ordem. Linhas com `dados` inválidos são ignoradas e registradas. */
export async function listarPipeline(): Promise<ItemPipeline[]> {
  const linhas = await sql`
    select i.id, i.etapa, i.ordem, i.dados, i.notas, i.criado_em, i.atualizado_em,
           i.criado_por, c.nome as criado_por_nome,
           i.responsavel, r.nome as responsavel_nome,
           (select count(*)::int from pipeline_comentarios k where k.item_id = i.id) as comentarios
    from pipeline_itens i
    left join usuarios c on c.id = i.criado_por
    left join usuarios r on r.id = i.responsavel
    order by i.ordem asc, i.criado_em asc
  `;
  const itens: ItemPipeline[] = [];
  for (const linha of linhas) {
    const lida = linhaSchema.safeParse(linha);
    if (!lida.success) {
      console.error(`[pipeline] item ${String(linha.id)} ignorado: dados inválidos`);
      continue;
    }
    const d = lida.data;
    itens.push({
      id: d.id,
      etapa: d.etapa,
      ordem: d.ordem,
      notas: d.notas,
      criadoEm: d.criado_em.toISOString(),
      atualizadoEm: d.atualizado_em.toISOString(),
      item: d.dados,
      criadoPorId: d.criado_por,
      criadoPorNome: d.criado_por_nome,
      responsavelId: d.responsavel,
      responsavelNome: d.responsavel_nome,
      comentarios: d.comentarios,
    });
  }
  return itens;
}

export async function idsNoPipeline(): Promise<Set<string>> {
  const linhas = await sql`select id from pipeline_itens`;
  return new Set(linhas.map((l) => String(l.id)));
}

/** Insere na etapa "radar", no fim da coluna. Se já existe, só atualiza os dados da oportunidade. */
export async function salvarItem(
  o: OportunidadeComScore,
  criadoPor: string | null = null,
): Promise<{ criado: boolean }> {
  const dados = oportunidadeComScoreSchema.parse(o);
  const json = JSON.parse(JSON.stringify(dados)) as postgres.JSONValue;
  const encerramento = new Date(dados.dataEncerramento).toISOString();

  return sql.begin(async (tx) => {
    const [linha] = await tx`
      insert into pipeline_itens (id, etapa, ordem, dados, score, faixa, valor_estimado, data_encerramento, criado_por)
      values (
        ${dados.id},
        'radar',
        (select coalesce(max(ordem), 0) + 1 from pipeline_itens where etapa = 'radar'),
        ${tx.json(json)},
        ${Math.round(dados.score.total)},
        ${dados.score.faixa},
        ${dados.valorEstimado},
        ${encerramento},
        ${criadoPor}
      )
      on conflict (id) do update set
        dados = excluded.dados,
        score = excluded.score,
        faixa = excluded.faixa,
        valor_estimado = excluded.valor_estimado,
        data_encerramento = excluded.data_encerramento,
        atualizado_em = now()
      returning (xmax = 0) as criado
    `;
    const criado = linha?.criado === true;
    if (criado) {
      await tx`
        insert into pipeline_historico (item_id, de, para, usuario_id) values (${dados.id}, null, 'radar', ${criadoPor})
      `;
    }
    return { criado };
  });
}

/** Muda de etapa e registra o histórico na mesma transação. Sem `ordem`, vai para o fim da coluna. */
export async function moverItem(
  id: string,
  etapa: EtapaId,
  ordem?: number,
  usuarioId: string | null = null,
): Promise<boolean> {
  const destino = etapaSchema.parse(etapa);
  return sql.begin(async (tx) => {
    const atual = await tx`select etapa from pipeline_itens where id = ${id} for update`;
    if (atual.length === 0) return false;
    const origem = etapaSchema.parse(atual[0]?.etapa);

    let novaOrdem = ordem;
    if (novaOrdem === undefined) {
      const [m] = await tx`
        select coalesce(max(ordem), 0) + 1 as proxima
        from pipeline_itens where etapa = ${destino} and id <> ${id}
      `;
      novaOrdem = Number(m?.proxima ?? 1);
    }

    await tx`
      update pipeline_itens
      set etapa = ${destino}, ordem = ${novaOrdem}, atualizado_em = now()
      where id = ${id}
    `;
    if (origem !== destino) {
      await tx`
        insert into pipeline_historico (item_id, de, para, usuario_id) values (${id}, ${origem}, ${destino}, ${usuarioId})
      `;
    }
    return true;
  });
}

export async function removerItem(id: string): Promise<boolean> {
  const r = await sql`delete from pipeline_itens where id = ${id}`;
  return r.count > 0;
}

export async function atualizarNotas(id: string, notas: string): Promise<boolean> {
  const r = await sql`
    update pipeline_itens set notas = ${notas}, atualizado_em = now() where id = ${id}
  `;
  return r.count > 0;
}

const FORMATO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Define (ou tira, com null) o responsável. Devolve se o item existe e se o responsável mudou. */
export async function definirResponsavel(
  id: string,
  responsavelId: string | null,
): Promise<{ existe: boolean; mudou: boolean }> {
  if (responsavelId !== null && !FORMATO_ID.test(responsavelId)) return { existe: false, mudou: false };
  return sql.begin(async (tx) => {
    const atual = await tx`select responsavel from pipeline_itens where id = ${id} for update`;
    if (atual.length === 0) return { existe: false, mudou: false };
    const anterior = (atual[0]?.responsavel ?? null) as string | null;
    if (anterior === responsavelId) return { existe: true, mudou: false };
    await tx`update pipeline_itens set responsavel = ${responsavelId}, atualizado_em = now() where id = ${id}`;
    return { existe: true, mudou: true };
  });
}

/** Texto do objeto da oportunidade, para avisos. */
export async function lerObjetoItem(id: string): Promise<string | null> {
  const linhas = await sql`select dados->>'objeto' as objeto from pipeline_itens where id = ${id}`;
  const objeto: unknown = linhas[0]?.objeto;
  return typeof objeto === "string" ? objeto : null;
}

const comentarioSchema = z.object({
  id: z.coerce.number(),
  item_id: z.string(),
  autor: z.string().nullable(),
  texto: z.string(),
  em: z.date(),
});

function paraComentario(linha: unknown): ComentarioPipeline {
  const c = comentarioSchema.parse(linha);
  return { id: c.id, itemId: c.item_id, autor: c.autor, texto: c.texto, em: c.em.toISOString() };
}

/** Do mais antigo ao mais novo. */
export async function listarComentarios(itemId: string): Promise<ComentarioPipeline[]> {
  const linhas = await sql`
    select k.id, k.item_id, u.nome as autor, k.texto, k.em
    from pipeline_comentarios k
    left join usuarios u on u.id = k.usuario_id
    where k.item_id = ${itemId}
    order by k.em asc, k.id asc
    limit 200
  `;
  return linhas.map(paraComentario);
}

/** Null quando o item não existe mais. */
export async function adicionarComentario(
  itemId: string,
  usuarioId: string,
  texto: string,
): Promise<ComentarioPipeline | null> {
  const existe = await sql`select 1 from pipeline_itens where id = ${itemId}`;
  if (existe.length === 0) return null;
  const linhas = await sql`
    with novo as (
      insert into pipeline_comentarios (item_id, usuario_id, texto)
      values (${itemId}, ${usuarioId}, ${texto})
      returning id, item_id, usuario_id, texto, em
    )
    select novo.id, novo.item_id, u.nome as autor, novo.texto, novo.em
    from novo left join usuarios u on u.id = novo.usuario_id
  `;
  return linhas[0] ? paraComentario(linhas[0]) : null;
}

export async function listarHistorico(id: string): Promise<EventoHistorico[]> {
  const linhas = await sql`
    select de, para, em from pipeline_historico where item_id = ${id} order by em asc, id asc
  `;
  return linhas.map((l) => {
    const e = historicoSchema.parse(l);
    return { de: e.de, para: e.para, em: e.em.toISOString() };
  });
}

export async function resumoPipeline(): Promise<ResumoPipeline> {
  const linhas = await sql`
    select etapa, sum(valor_estimado)::float8 as valor, count(*)::int as quantidade
    from pipeline_itens
    group by etapa
  `;
  const agregadas = linhas.map((l) => ({
    etapa: etapaSchema.parse(l.etapa),
    quantidade: z.number().parse(l.quantidade),
    valor: z.number().nullable().parse(l.valor),
  }));
  return montarResumo(agregadas);
}
