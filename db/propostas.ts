import "server-only";
import { randomBytes } from "node:crypto";
import type postgres from "postgres";
import { z } from "zod";
import { sql } from "@/db/client";
import { DadosPropostaSchema } from "@/core/proposta";
import { ehModeloId, type ModeloId } from "@/core/proposta-modelos";
import { ehStatusEquipe } from "@/core/revisao";
import type { DadosProposta } from "@/core/types-detalhe";
import type { AnaliseAssistente, AutorProposta, StatusPropostaEquipe } from "@/core/types-equipe";

export interface Proposta {
  id: string;
  compraId: string | null;
  modelo: ModeloId;
  titulo: string;
  dados: DadosProposta;
  /** Em reais */
  total: number;
  status: StatusPropostaEquipe;
  tokenPublico: string | null;
  /** ISO 8601 */
  tokenExpira: string | null;
  criadoEm: string;
  atualizadoEm: string;
  autor: AutorProposta;
  criadoPor: string | null;
  criadoPorNome: string | null;
  revisadoPor: string | null;
  revisadoPorNome: string | null;
  revisaoNota: string | null;
  /** ISO 8601 */
  revisadoEm: string | null;
  analise: AnaliseAssistente | null;
}

export interface ResumoProposta {
  id: string;
  compraId: string | null;
  titulo: string;
  orgao: string;
  total: number;
  status: StatusPropostaEquipe;
  atualizadoEm: string;
  autor: AutorProposta;
  criadoPor: string | null;
  criadoPorNome: string | null;
  revisadoPor: string | null;
}

export interface NovaProposta {
  compraId: string | null;
  modelo: ModeloId;
  titulo: string;
  dados: DadosProposta;
  /** Em centavos inteiros */
  totalCentavos: number;
  /** Quem está criando; null só em rotinas sem sessão */
  criadoPor?: string | null;
  autor?: AutorProposta;
  analise?: AnaliseAssistente | null;
  /** Padrão: rascunho */
  status?: StatusPropostaEquipe;
}

export interface PropostaPublica {
  titulo: string;
  modelo: ModeloId;
  dados: DadosProposta;
}

const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const FORMATO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const analiseSchema: z.ZodType<AnaliseAssistente> = z.object({
  modeloId: z.string(),
  resumo: z.string(),
  pegadinhas: z.array(z.string()),
  documentosExigidos: z.array(z.string()),
  sugestoesPorItem: z.array(
    z.object({
      numero: z.number(),
      marcaModelo: z.string(),
      precoSugerido: z.number().nullable(),
      observacao: z.string(),
    }),
  ),
  geradoEm: z.string(),
  modelo: z.string(),
});

function lerAnalise(bruto: unknown): AnaliseAssistente | null {
  if (bruto === null || bruto === undefined) return null;
  const lida = analiseSchema.safeParse(bruto);
  return lida.success ? lida.data : null;
}

function paraReais(centavos: number): string {
  return (Math.round(centavos) / 100).toFixed(2);
}

interface LinhaProposta {
  id: string;
  compra_id: string | null;
  modelo: string;
  titulo: string;
  dados: unknown;
  total: string;
  status: string;
  token_publico: string | null;
  token_expira: Date | null;
  criado_em: Date;
  atualizado_em: Date;
  autor: string;
  criado_por: string | null;
  criado_por_nome: string | null;
  revisado_por: string | null;
  revisado_por_nome: string | null;
  revisao_nota: string | null;
  revisado_em: Date | null;
  analise: unknown;
}

function converter(l: LinhaProposta): Proposta | null {
  const dados = DadosPropostaSchema.safeParse(l.dados);
  if (!dados.success || !ehStatusEquipe(l.status)) return null;
  return {
    id: l.id,
    compraId: l.compra_id,
    modelo: ehModeloId(l.modelo) ? l.modelo : "cotacao-simples",
    titulo: l.titulo,
    dados: dados.data,
    total: Number(l.total),
    status: l.status,
    tokenPublico: l.token_publico,
    tokenExpira: l.token_expira ? l.token_expira.toISOString() : null,
    criadoEm: l.criado_em.toISOString(),
    atualizadoEm: l.atualizado_em.toISOString(),
    autor: l.autor === "assistente" ? "assistente" : "usuario",
    criadoPor: l.criado_por,
    criadoPorNome: l.criado_por_nome,
    revisadoPor: l.revisado_por,
    revisadoPorNome: l.revisado_por_nome,
    revisaoNota: l.revisao_nota,
    revisadoEm: l.revisado_em ? l.revisado_em.toISOString() : null,
    analise: lerAnalise(l.analise),
  };
}

export async function criarProposta(nova: NovaProposta): Promise<string> {
  const dados = DadosPropostaSchema.parse(nova.dados);
  const analise = nova.analise
    ? sql.json(JSON.parse(JSON.stringify(nova.analise)) as postgres.JSONValue)
    : null;
  const linhas = await sql<{ id: string }[]>`
    insert into propostas (compra_id, pipeline_id, modelo, titulo, dados, total, criado_por, autor, analise, status)
    values (
      ${nova.compraId},
      (select id from pipeline_itens where id = ${nova.compraId}),
      ${nova.modelo},
      ${nova.titulo},
      ${sql.json(dados)},
      ${paraReais(nova.totalCentavos)},
      ${nova.criadoPor ?? null},
      ${nova.autor ?? "usuario"},
      ${analise},
      ${nova.status ?? "rascunho"}
    )
    returning id
  `;
  const id = linhas[0]?.id;
  if (!id) throw new Error("A proposta não foi gravada");
  return id;
}

/** Id da proposta mais recente que o assistente criou para a compra nos últimos `minutos`; null se não houver. */
export async function propostaRecenteDoAssistente(compraId: string, minutos: number): Promise<string | null> {
  const minutosSeguros = Math.max(1, Math.min(1440, Math.trunc(minutos)));
  const linhas = await sql<{ id: string }[]>`
    select id from propostas
    where compra_id = ${compraId}
      and autor = 'assistente'
      and criado_em > now() - make_interval(mins => ${minutosSeguros}::int)
    order by criado_em desc
    limit 1
  `;
  return linhas[0]?.id ?? null;
}

/** Propostas que o assistente criou para a pessoa no intervalo [de, ate). */
export async function contarPropostasDoAssistente(usuarioId: string, de: Date, ate: Date): Promise<number> {
  const [linha] = await sql<{ total: number }[]>`
    select count(*)::int as total from propostas
    where autor = 'assistente' and criado_por = ${usuarioId}
      and criado_em >= ${de} and criado_em < ${ate}
  `;
  return linha?.total ?? 0;
}

export async function atualizarProposta(
  id: string,
  mudanca: { titulo: string; modelo: ModeloId; dados: DadosProposta; totalCentavos: number },
): Promise<Date | null> {
  if (!FORMATO_ID.test(id)) return null;
  const dados = DadosPropostaSchema.parse(mudanca.dados);
  const linhas = await sql<{ atualizado_em: Date }[]>`
    update propostas
    set titulo = ${mudanca.titulo},
        modelo = ${mudanca.modelo},
        dados = ${sql.json(dados)},
        total = ${paraReais(mudanca.totalCentavos)},
        atualizado_em = now()
    where id = ${id}
    returning atualizado_em
  `;
  return linhas[0]?.atualizado_em ?? null;
}

export interface RevisaoGravada {
  revisadoPor: string;
  nota: string | null;
}

/**
 * Muda o status. `revisao`: objeto grava quem revisou e a nota; null apaga os dados da revisão;
 * sem o argumento, mantém o que já está gravado. `esperado`: só muda se o status atual ainda for esse
 * (evita duas pessoas decidirem a mesma proposta ao mesmo tempo).
 */
export async function definirStatus(
  id: string,
  status: StatusPropostaEquipe,
  revisao?: RevisaoGravada | null,
  esperado?: StatusPropostaEquipe,
): Promise<boolean> {
  if (!FORMATO_ID.test(id)) return false;
  const condicao = esperado ? sql`and status = ${esperado}` : sql``;
  const campos =
    revisao === undefined
      ? sql``
      : revisao === null
        ? sql`, revisado_por = null, revisao_nota = null, revisado_em = null`
        : sql`, revisado_por = ${revisao.revisadoPor}, revisao_nota = ${revisao.nota}, revisado_em = now()`;
  const linhas = await sql<{ id: string }[]>`
    update propostas set status = ${status}, atualizado_em = now() ${campos}
    where id = ${id} ${condicao}
    returning id
  `;
  return linhas.length > 0;
}

/** Null quando não existe ou quando o jsonb está inválido. */
export async function lerProposta(id: string): Promise<Proposta | null> {
  if (!FORMATO_ID.test(id)) return null;
  const linhas = await sql<LinhaProposta[]>`
    select p.id, p.compra_id, p.modelo, p.titulo, p.dados, p.total, p.status, p.token_publico, p.token_expira,
           p.criado_em, p.atualizado_em, p.autor, p.criado_por, c.nome as criado_por_nome,
           p.revisado_por, r.nome as revisado_por_nome, p.revisao_nota, p.revisado_em, p.analise
    from propostas p
    left join usuarios c on c.id = p.criado_por
    left join usuarios r on r.id = p.revisado_por
    where p.id = ${id} limit 1
  `;
  const linha = linhas[0];
  return linha ? converter(linha) : null;
}

interface LinhaResumo {
  id: string;
  compra_id: string | null;
  titulo: string;
  orgao: string | null;
  total: string;
  status: string;
  atualizado_em: Date;
  autor: string;
  criado_por: string | null;
  criado_por_nome: string | null;
  revisado_por: string | null;
}

/** Mais recentes primeiro; com compraId, só as daquela compra. */
export async function listarPropostas(filtro?: { compraId?: string }): Promise<ResumoProposta[]> {
  const linhas = await sql<LinhaResumo[]>`
    select p.id, p.compra_id, p.titulo, p.dados->>'orgao' as orgao, p.total, p.status, p.atualizado_em,
           p.autor, p.criado_por, c.nome as criado_por_nome, p.revisado_por
    from propostas p
    left join usuarios c on c.id = p.criado_por
    where ${filtro?.compraId ? sql`p.compra_id = ${filtro.compraId}` : sql`true`}
    order by p.atualizado_em desc
    limit 500
  `;
  const resumos: ResumoProposta[] = [];
  for (const l of linhas) {
    if (!ehStatusEquipe(l.status)) continue;
    resumos.push({
      id: l.id,
      compraId: l.compra_id,
      titulo: l.titulo,
      orgao: l.orgao ?? "",
      total: Number(l.total),
      status: l.status,
      atualizadoEm: l.atualizado_em.toISOString(),
      autor: l.autor === "assistente" ? "assistente" : "usuario",
      criadoPor: l.criado_por,
      criadoPorNome: l.criado_por_nome,
      revisadoPor: l.revisado_por,
    });
  }
  return resumos;
}

/**
 * Quantas propostas esperam por esta pessoa: em revisão que ela pode revisar
 * (não é a autora) e devolvidas que ela criou.
 */
export async function contarPropostasParaMim(usuarioId: string): Promise<number> {
  if (!FORMATO_ID.test(usuarioId)) return 0;
  const [linha] = await sql<{ total: number }[]>`
    select count(*)::int as total from propostas
    where (status = 'em_revisao' and (autor = 'assistente' or criado_por is null or criado_por <> ${usuarioId}))
       or (status = 'devolvida' and criado_por = ${usuarioId})
  `;
  return linha?.total ?? 0;
}

export async function excluirProposta(id: string): Promise<boolean> {
  if (!FORMATO_ID.test(id)) return false;
  const linhas = await sql<{ id: string }[]>`delete from propostas where id = ${id} returning id`;
  return linhas.length > 0;
}

/** Gera (ou troca) o link público. Token de 32 bytes aleatórios em base64url. */
export async function gerarTokenPublico(
  id: string,
  dias = 15,
): Promise<{ token: string; expira: string } | null> {
  if (!FORMATO_ID.test(id)) return null;
  const token = randomBytes(32).toString("base64url");
  const diasSeguros = Math.max(1, Math.min(90, Math.trunc(dias)));
  const linhas = await sql<{ token_expira: Date }[]>`
    update propostas
    set token_publico = ${token},
        token_expira = now() + make_interval(days => ${diasSeguros}::int)
    where id = ${id}
    returning token_expira
  `;
  const expira = linhas[0]?.token_expira;
  return expira ? { token, expira: expira.toISOString() } : null;
}

export async function revogarToken(id: string): Promise<boolean> {
  if (!FORMATO_ID.test(id)) return false;
  const linhas = await sql<{ id: string }[]>`
    update propostas set token_publico = null, token_expira = null where id = ${id} returning id
  `;
  return linhas.length > 0;
}

/** Só o que o documento precisa, e só com token existente e não expirado. */
export async function lerPorToken(token: string): Promise<PropostaPublica | null> {
  if (!FORMATO_TOKEN.test(token)) return null;
  const linhas = await sql<Pick<LinhaProposta, "titulo" | "modelo" | "dados">[]>`
    select titulo, modelo, dados from propostas
    where token_publico = ${token} and token_expira > now()
    limit 1
  `;
  const linha = linhas[0];
  if (!linha) return null;
  const dados = DadosPropostaSchema.safeParse(linha.dados);
  if (!dados.success) return null;
  return {
    titulo: linha.titulo,
    modelo: ehModeloId(linha.modelo) ? linha.modelo : "cotacao-simples",
    dados: dados.data,
  };
}
