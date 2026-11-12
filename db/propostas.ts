import "server-only";
import { randomBytes } from "node:crypto";
import { sql } from "@/db/client";
import { DadosPropostaSchema } from "@/core/proposta";
import { ehModeloId, type ModeloId } from "@/core/proposta-modelos";
import type { DadosProposta, StatusProposta } from "@/core/types-detalhe";

export interface Proposta {
  id: string;
  compraId: string | null;
  modelo: ModeloId;
  titulo: string;
  dados: DadosProposta;
  /** Em reais */
  total: number;
  status: StatusProposta;
  tokenPublico: string | null;
  /** ISO 8601 */
  tokenExpira: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ResumoProposta {
  id: string;
  compraId: string | null;
  titulo: string;
  orgao: string;
  total: number;
  status: StatusProposta;
  atualizadoEm: string;
}

export interface NovaProposta {
  compraId: string | null;
  modelo: ModeloId;
  titulo: string;
  dados: DadosProposta;
  /** Em centavos inteiros */
  totalCentavos: number;
}

export interface PropostaPublica {
  titulo: string;
  modelo: ModeloId;
  dados: DadosProposta;
}

const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const FORMATO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ehStatus(valor: string): valor is StatusProposta {
  return valor === "rascunho" || valor === "pronta" || valor === "enviada";
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
}

function converter(l: LinhaProposta): Proposta | null {
  const dados = DadosPropostaSchema.safeParse(l.dados);
  if (!dados.success || !ehStatus(l.status)) return null;
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
  };
}

export async function criarProposta(nova: NovaProposta): Promise<string> {
  const dados = DadosPropostaSchema.parse(nova.dados);
  const linhas = await sql<{ id: string }[]>`
    insert into propostas (compra_id, pipeline_id, modelo, titulo, dados, total)
    values (
      ${nova.compraId},
      (select id from pipeline_itens where id = ${nova.compraId}),
      ${nova.modelo},
      ${nova.titulo},
      ${sql.json(dados)},
      ${paraReais(nova.totalCentavos)}
    )
    returning id
  `;
  const id = linhas[0]?.id;
  if (!id) throw new Error("A proposta não foi gravada");
  return id;
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

export async function definirStatus(id: string, status: StatusProposta): Promise<boolean> {
  if (!FORMATO_ID.test(id)) return false;
  const linhas = await sql<{ id: string }[]>`
    update propostas set status = ${status}, atualizado_em = now() where id = ${id} returning id
  `;
  return linhas.length > 0;
}

/** Null quando não existe ou quando o jsonb está inválido. */
export async function lerProposta(id: string): Promise<Proposta | null> {
  if (!FORMATO_ID.test(id)) return null;
  const linhas = await sql<LinhaProposta[]>`
    select id, compra_id, modelo, titulo, dados, total, status, token_publico, token_expira, criado_em, atualizado_em
    from propostas where id = ${id} limit 1
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
}

/** Mais recentes primeiro; com compraId, só as daquela compra. */
export async function listarPropostas(filtro?: { compraId?: string }): Promise<ResumoProposta[]> {
  const linhas = await sql<LinhaResumo[]>`
    select id, compra_id, titulo, dados->>'orgao' as orgao, total, status, atualizado_em
    from propostas
    where ${filtro?.compraId ? sql`compra_id = ${filtro.compraId}` : sql`true`}
    order by atualizado_em desc
    limit 500
  `;
  const resumos: ResumoProposta[] = [];
  for (const l of linhas) {
    if (!ehStatus(l.status)) continue;
    resumos.push({
      id: l.id,
      compraId: l.compra_id,
      titulo: l.titulo,
      orgao: l.orgao ?? "",
      total: Number(l.total),
      status: l.status,
      atualizadoEm: l.atualizado_em.toISOString(),
    });
  }
  return resumos;
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
