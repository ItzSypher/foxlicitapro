import "server-only";
import type postgres from "postgres";
import { z } from "zod";
import { sql } from "@/db/client";
import type { OportunidadeComScore } from "@/core/types";
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
    select id, etapa, ordem, dados, notas, criado_em, atualizado_em
    from pipeline_itens
    order by ordem asc, criado_em asc
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
    });
  }
  return itens;
}

export async function idsNoPipeline(): Promise<Set<string>> {
  const linhas = await sql`select id from pipeline_itens`;
  return new Set(linhas.map((l) => String(l.id)));
}

/** Insere na etapa "radar", no fim da coluna. Se já existe, só atualiza os dados da oportunidade. */
export async function salvarItem(o: OportunidadeComScore): Promise<{ criado: boolean }> {
  const dados = oportunidadeComScoreSchema.parse(o);
  const json = JSON.parse(JSON.stringify(dados)) as postgres.JSONValue;
  const encerramento = new Date(dados.dataEncerramento).toISOString();

  return sql.begin(async (tx) => {
    const [linha] = await tx`
      insert into pipeline_itens (id, etapa, ordem, dados, score, faixa, valor_estimado, data_encerramento)
      values (
        ${dados.id},
        'radar',
        (select coalesce(max(ordem), 0) + 1 from pipeline_itens where etapa = 'radar'),
        ${tx.json(json)},
        ${Math.round(dados.score.total)},
        ${dados.score.faixa},
        ${dados.valorEstimado},
        ${encerramento}
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
      await tx`insert into pipeline_historico (item_id, de, para) values (${dados.id}, null, 'radar')`;
    }
    return { criado };
  });
}

/** Muda de etapa e registra o histórico na mesma transação. Sem `ordem`, vai para o fim da coluna. */
export async function moverItem(id: string, etapa: EtapaId, ordem?: number): Promise<boolean> {
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
      await tx`insert into pipeline_historico (item_id, de, para) values (${id}, ${origem}, ${destino})`;
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
