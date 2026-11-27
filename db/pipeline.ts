import "server-only";
import type postgres from "postgres";
import { z } from "zod";
import { sql } from "@/db/client";
import type { OportunidadeComScore } from "@/core/types";
import type { ResumoCotacoes } from "@/core/cotacoes-resumo";
import type { DadosSoftware } from "@/core/campos-software";
import { COMISSAO_MAXIMA, COMISSAO_MINIMA } from "@/core/lucro";
import type { ComentarioPipeline } from "@/core/types-equipe";
import { validarSaidaDaRevisao, type MarcaJuridica } from "@/core/revisao-juridica";
import { resumirCotacoesPorItem } from "@/db/cotacoes";
import { listarMarcasPorItem, paraMarca } from "@/db/revisao-juridica";
import {
  ETAPAS,
  ROTULO_ETAPA,
  montarResumo,
  type EtapaId,
  type ItemPipeline,
  type ResumoPipeline,
} from "@/components/pipeline/tipos";

export { ETAPAS, ROTULO_ETAPA };

/** Saída da "Revisão jurídica" para frente sem o checklist completo. A mensagem já é para a tela. */
export class ErroRevisaoJuridica extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroRevisaoJuridica";
  }
}
export type { EtapaId, ItemPipeline, ResumoPipeline };

const etapaSchema = z.enum(["radar", "analisando", "cotando", "revisao_juridica", "proposta", "disputa", "ganha", "perdida"]);

const dataIso = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "data inválida");

const criterioSchema = z.object({
  id: z.enum(["cnae", "modalidade", "local", "documentacao", "valor", "caixa"]),
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
  foco: z.string().optional(),
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
  linkAlerta: z.string().nullish(),
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
  valor_proposto: z.union([z.string(), z.number()]).nullable(),
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

function valorProposto(v: string | number | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Todos os itens, por etapa e ordem. Linhas com `dados` inválidos são ignoradas e registradas. */
export async function listarPipeline(empresaId: string): Promise<ItemPipeline[]> {
  const linhas = await sql`
    select i.id, i.etapa, i.ordem, i.dados, i.notas, i.criado_em, i.atualizado_em,
           i.criado_por, c.nome as criado_por_nome,
           i.responsavel, r.nome as responsavel_nome,
           (select count(*)::int from pipeline_comentarios k where k.empresa_id = i.empresa_id and k.item_id = i.id) as comentarios,
           (select max(p.total) from propostas p
            where p.empresa_id = i.empresa_id and p.compra_id = i.id and p.status in ('aprovada', 'pronta', 'enviada')) as valor_proposto
    from pipeline_itens i
    left join usuarios c on c.id = i.criado_por
    left join usuarios r on r.id = i.responsavel
    where i.empresa_id = ${empresaId}
    order by i.ordem asc, i.criado_em asc
  `;
  const marcas = await listarMarcasPorItem(empresaId).catch((): Map<string, MarcaJuridica[]> => new Map());
  const cotacoes = await resumirCotacoesPorItem(empresaId).catch(() => new Map<string, ResumoCotacoes>());
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
      revisao: marcas.get(d.id) ?? [],
      cotacoes: cotacoes.get(d.id) ?? null,
      preco: null,
      valorProposto: valorProposto(d.valor_proposto),
    });
  }
  return itens;
}

export async function idsNoPipeline(empresaId: string): Promise<Set<string>> {
  const linhas = await sql`select id from pipeline_itens where empresa_id = ${empresaId}`;
  return new Set(linhas.map((l) => String(l.id)));
}

function motivoTravado(etapa: unknown): string {
  return etapa === "disputa"
    ? "Em disputa: não dá para tirar do pipeline."
    : etapa === "ganha"
      ? "Licitação ganha: não dá para tirar do pipeline."
      : "Já tem proposta: não dá para tirar do pipeline.";
}

/**
 * Se o item está no pipeline da empresa e, estando, por que não pode sair (o mesmo texto de `itensTravadosNoPipeline`).
 * Uma consulta só, filtrada pelo item: a tela de licitação não precisa da lista inteira de ids.
 */
export async function situacaoNoPipeline(empresaId: string, id: string): Promise<{ salvo: boolean; travado: string | null }> {
  const linhas = await sql`
    select i.etapa,
      (i.etapa in ('disputa', 'ganha')
        or exists (select 1 from propostas p where p.empresa_id = i.empresa_id and (p.compra_id = i.id or p.pipeline_id = i.id))) as travado
    from pipeline_itens i
    where i.empresa_id = ${empresaId} and i.id = ${id}
    limit 1
  `;
  const linha = linhas[0];
  if (!linha) return { salvo: false, travado: null };
  return { salvo: true, travado: linha.travado === true ? motivoTravado(linha.etapa) : null };
}

/**
 * Itens da empresa que não podem sair do pipeline com o alternador: em disputa, ganhos ou com proposta.
 * Devolve id → motivo (texto pronto para a tela). Com `id`, só olha esse item. Item livre não aparece no mapa.
 */
export async function itensTravadosNoPipeline(empresaId: string, id: string | null = null): Promise<Map<string, string>> {
  const linhas = await sql`
    select i.id, i.etapa
    from pipeline_itens i
    where i.empresa_id = ${empresaId}
      and ${id === null ? sql`true` : sql`i.id = ${id}`}
      and (
        i.etapa in ('disputa', 'ganha')
        or exists (select 1 from propostas p where p.empresa_id = i.empresa_id and (p.compra_id = i.id or p.pipeline_id = i.id))
      )
  `;
  const mapa = new Map<string, string>();
  for (const l of linhas) {
    mapa.set(String(l.id), motivoTravado(l.etapa));
  }
  return mapa;
}

/**
 * Quem recebe um item novo: o responsável padrão da empresa (tela Equipe), senão o primeiro gestor ativo da empresa,
 * senão um gestor ligado a ela pelo Admin (usuario_empresas), senão quem adicionou. Nenhum item fica sem responsável.
 */
function responsavelPadraoSql(tx: postgres.TransactionSql, empresaId: string, criadoPor: string | null) {
  return tx`coalesce(
    (select e.wa_responsavel_padrao from empresas e join usuarios u on u.id = e.wa_responsavel_padrao and u.ativo where e.id = ${empresaId}),
    (select u.id from usuarios u where u.empresa_id = ${empresaId} and u.ativo and u.papel = 'gestor' order by u.criado_em limit 1),
    (select ue.usuario_id from usuario_empresas ue join usuarios u on u.id = ue.usuario_id and u.ativo
      where ue.empresa_id = ${empresaId} order by ue.criado_em limit 1),
    ${criadoPor}::uuid
  )`;
}

/** Insere na etapa "radar", no fim da coluna, já com responsável. Se já existe, atualiza os dados e preenche o responsável vazio. */
export async function salvarItem(
  empresaId: string,
  o: OportunidadeComScore,
  criadoPor: string | null = null,
): Promise<{ criado: boolean }> {
  const dados = oportunidadeComScoreSchema.parse(o);
  const json = JSON.parse(JSON.stringify(dados)) as postgres.JSONValue;
  const encerramento = new Date(dados.dataEncerramento).toISOString();

  return sql.begin(async (tx) => {
    const [linha] = await tx`
      insert into pipeline_itens (empresa_id, id, etapa, ordem, dados, score, faixa, valor_estimado, data_encerramento, criado_por, responsavel)
      values (
        ${empresaId},
        ${dados.id},
        'radar',
        (select coalesce(max(ordem), 0) + 1 from pipeline_itens where empresa_id = ${empresaId} and etapa = 'radar'),
        ${tx.json(json)},
        ${Math.round(dados.score.total)},
        ${dados.score.faixa},
        ${dados.valorEstimado},
        ${encerramento},
        ${criadoPor},
        ${responsavelPadraoSql(tx, empresaId, criadoPor)}
      )
      on conflict (empresa_id, id) do update set
        responsavel = coalesce(pipeline_itens.responsavel, excluded.responsavel),
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
        insert into pipeline_historico (empresa_id, item_id, de, para, usuario_id) values (${empresaId}, ${dados.id}, null, 'radar', ${criadoPor})
      `;
    }
    return { criado };
  });
}

/** Muda de etapa e registra o histórico na mesma transação. Sem `ordem`, vai para o fim da coluna. */
export async function moverItem(
  empresaId: string,
  id: string,
  etapa: EtapaId,
  ordem?: number,
  usuarioId: string | null = null,
): Promise<boolean> {
  const destino = etapaSchema.parse(etapa);
  return sql.begin(async (tx) => {
    const atual = await tx`select etapa from pipeline_itens where empresa_id = ${empresaId} and id = ${id} for update`;
    if (atual.length === 0) return false;
    const origem = etapaSchema.parse(atual[0]?.etapa);

    if (origem === "revisao_juridica" && origem !== destino) {
      const linhasMarcas = await tx`
        select p.item_id, p.passo, p.marcado_por, u.nome as marcado_por_nome, p.marcado_em
        from revisao_juridica_passos p
        left join usuarios u on u.id = p.marcado_por
        where p.empresa_id = ${empresaId} and p.item_id = ${id}
      `;
      const marcas: MarcaJuridica[] = [];
      for (const l of linhasMarcas) {
        const m = paraMarca(l);
        if (m) marcas.push({ passo: m.passo, porId: m.porId, porNome: m.porNome, em: m.em });
      }
      const permitido = validarSaidaDaRevisao(origem, destino, marcas);
      if (!permitido.ok) throw new ErroRevisaoJuridica(permitido.erro);
    }

    let novaOrdem = ordem;
    if (novaOrdem === undefined) {
      const [m] = await tx`
        select coalesce(max(ordem), 0) + 1 as proxima
        from pipeline_itens where empresa_id = ${empresaId} and etapa = ${destino} and id <> ${id}
      `;
      novaOrdem = Number(m?.proxima ?? 1);
    }

    await tx`
      update pipeline_itens
      set etapa = ${destino}, ordem = ${novaOrdem}, atualizado_em = now()
      where empresa_id = ${empresaId} and id = ${id}
    `;
    if (origem !== destino) {
      await tx`
        insert into pipeline_historico (empresa_id, item_id, de, para, usuario_id) values (${empresaId}, ${id}, ${origem}, ${destino}, ${usuarioId})
      `;
    }
    return true;
  });
}

export async function removerItem(empresaId: string, id: string): Promise<boolean> {
  const r = await sql`delete from pipeline_itens where empresa_id = ${empresaId} and id = ${id}`;
  return r.count > 0;
}

export async function atualizarNotas(empresaId: string, id: string, notas: string): Promise<boolean> {
  const r = await sql`
    update pipeline_itens set notas = ${notas}, atualizado_em = now() where empresa_id = ${empresaId} and id = ${id}
  `;
  return r.count > 0;
}

function numeroOuNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Terceirização e comissão do item; null se ele não está no pipeline da empresa. */
export async function lerSoftwareDoItem(empresaId: string, id: string): Promise<DadosSoftware | null> {
  const linhas = await sql`
    select terceirizavel, dev_custo, dev_parcelas, contrato_meses, comissao_percentual
    from pipeline_itens
    where empresa_id = ${empresaId} and id = ${id}
    limit 1
  `;
  const l = linhas[0];
  if (!l) return null;
  return {
    terceirizavel: typeof l.terceirizavel === "boolean" ? l.terceirizavel : null,
    devCusto: numeroOuNull(l.dev_custo),
    devParcelas: numeroOuNull(l.dev_parcelas),
    contratoMeses: numeroOuNull(l.contrato_meses),
    comissaoPercentual: numeroOuNull(l.comissao_percentual),
  };
}

/** Grava a resposta de terceirização, o custo e as parcelas do dev e os meses de contrato. False se o item não está no pipeline. */
export async function gravarSoftwareDoItem(
  empresaId: string,
  id: string,
  d: Omit<DadosSoftware, "comissaoPercentual">,
): Promise<boolean> {
  const custo = d.devCusto === null ? null : Math.round(d.devCusto * 100) / 100;
  const r = await sql`
    update pipeline_itens
    set terceirizavel = ${d.terceirizavel}, dev_custo = ${custo}, dev_parcelas = ${d.devParcelas},
        contrato_meses = ${d.contratoMeses}, atualizado_em = now()
    where empresa_id = ${empresaId} and id = ${id}
  `;
  return r.count > 0;
}

/** Comissão do item em qualquer etapa (0 a 30%); null = sem comissão. False se o item não está no pipeline ou o valor é inválido. */
export async function gravarComissaoDoPipeline(empresaId: string, id: string, percentual: number | null): Promise<boolean> {
  if (percentual !== null && (!Number.isFinite(percentual) || percentual < COMISSAO_MINIMA || percentual > COMISSAO_MAXIMA)) return false;
  const valor = percentual === null ? null : Math.round(percentual * 100) / 100;
  const r = await sql`
    update pipeline_itens set comissao_percentual = ${valor}, atualizado_em = now()
    where empresa_id = ${empresaId} and id = ${id}
  `;
  return r.count > 0;
}

const FORMATO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Define (ou tira, com null) o responsável. Devolve se o item existe e se o responsável mudou. */
export async function definirResponsavel(
  empresaId: string,
  id: string,
  responsavelId: string | null,
): Promise<{ existe: boolean; mudou: boolean }> {
  if (responsavelId !== null && !FORMATO_ID.test(responsavelId)) return { existe: false, mudou: false };
  return sql.begin(async (tx) => {
    const atual = await tx`select responsavel from pipeline_itens where empresa_id = ${empresaId} and id = ${id} for update`;
    if (atual.length === 0) return { existe: false, mudou: false };
    if (responsavelId !== null) {
      // Pessoa da empresa ou gestor ligado a ela pelo Admin.
      const dono = await tx`
        select 1 from usuarios where id = ${responsavelId} and empresa_id = ${empresaId}
        union all
        select 1 from usuario_empresas where usuario_id = ${responsavelId} and empresa_id = ${empresaId}
      `;
      if (dono.length === 0) return { existe: false, mudou: false };
    }
    const anterior = (atual[0]?.responsavel ?? null) as string | null;
    if (anterior === responsavelId) return { existe: true, mudou: false };
    await tx`update pipeline_itens set responsavel = ${responsavelId}, atualizado_em = now() where empresa_id = ${empresaId} and id = ${id}`;
    return { existe: true, mudou: true };
  });
}

/** Etapa atual de um item do pipeline; null se ele não está lá. */
export async function lerEtapaItem(empresaId: string, id: string): Promise<EtapaId | null> {
  const linhas = await sql`select etapa from pipeline_itens where empresa_id = ${empresaId} and id = ${id}`;
  const lida = etapaSchema.safeParse(linhas[0]?.etapa);
  return lida.success ? lida.data : null;
}

/** Texto do objeto da oportunidade, para avisos. */
export async function lerObjetoItem(empresaId: string, id: string): Promise<string | null> {
  const linhas = await sql`select dados->>'objeto' as objeto from pipeline_itens where empresa_id = ${empresaId} and id = ${id}`;
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
export async function listarComentarios(empresaId: string, itemId: string): Promise<ComentarioPipeline[]> {
  const linhas = await sql`
    select k.id, k.item_id, u.nome as autor, k.texto, k.em
    from pipeline_comentarios k
    left join usuarios u on u.id = k.usuario_id
    where k.empresa_id = ${empresaId} and k.item_id = ${itemId}
    order by k.em asc, k.id asc
    limit 200
  `;
  return linhas.map(paraComentario);
}

/** Null quando o item não existe mais. */
export async function adicionarComentario(
  empresaId: string,
  itemId: string,
  usuarioId: string,
  texto: string,
): Promise<ComentarioPipeline | null> {
  const existe = await sql`select 1 from pipeline_itens where empresa_id = ${empresaId} and id = ${itemId}`;
  if (existe.length === 0) return null;
  const linhas = await sql`
    with novo as (
      insert into pipeline_comentarios (empresa_id, item_id, usuario_id, texto)
      values (${empresaId}, ${itemId}, ${usuarioId}, ${texto})
      returning id, item_id, usuario_id, texto, em
    )
    select novo.id, novo.item_id, u.nome as autor, novo.texto, novo.em
    from novo left join usuarios u on u.id = novo.usuario_id
  `;
  return linhas[0] ? paraComentario(linhas[0]) : null;
}

export async function listarHistorico(empresaId: string, id: string): Promise<EventoHistorico[]> {
  const linhas = await sql`
    select de, para, em from pipeline_historico where empresa_id = ${empresaId} and item_id = ${id} order by em asc, id asc
  `;
  return linhas.map((l) => {
    const e = historicoSchema.parse(l);
    return { de: e.de, para: e.para, em: e.em.toISOString() };
  });
}

export async function resumoPipeline(empresaId: string): Promise<ResumoPipeline> {
  const linhas = await sql`
    select etapa, sum(valor_estimado)::float8 as valor, count(*)::int as quantidade
    from pipeline_itens
    where empresa_id = ${empresaId}
    group by etapa
  `;
  const agregadas = linhas.map((l) => ({
    etapa: etapaSchema.parse(l.etapa),
    quantidade: z.number().parse(l.quantidade),
    valor: z.number().nullable().parse(l.valor),
  }));
  return montarResumo(agregadas);
}
