import "server-only";
import { z } from "zod";
import { sql } from "@/db/client";
import { JANELA_DEDUP_DIAS, diaDeSaoPaulo, type AvisoExistente, type AvisoNovo, type PessoaAviso } from "@/core/avisos";
import { ehPapel, normalizarPermissoes } from "@/core/permissoes";

const FORMATO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AvisoPainel {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string;
  link: string | null;
  lido: boolean;
  /** ISO 8601 */
  criadoEm: string;
}

export interface ListaAvisos {
  itens: AvisoPainel[];
  naoLidos: number;
}

const LIMITE_LISTA = 30;

const linhaSchema = z.object({
  id: z.string(),
  tipo: z.string(),
  titulo: z.string(),
  corpo: z.string(),
  link: z.string().nullable(),
  lido: z.boolean(),
  criado_em: z.date(),
});

/** Avisos da pessoa (os dela e os de "todos"), do mais novo ao mais antigo. */
export async function listarAvisos(empresaId: string, usuarioId: string): Promise<ListaAvisos> {
  if (!FORMATO_ID.test(usuarioId)) return { itens: [], naoLidos: 0 };
  const linhas = await sql`
    select a.id, a.tipo, a.titulo, a.corpo, a.link, a.criado_em,
           (a.lido_em is not null or l.aviso_id is not null) as lido
    from avisos a
    left join avisos_leituras l on l.aviso_id = a.id and l.usuario_id = ${usuarioId}
    where a.empresa_id = ${empresaId} and (a.usuario_id = ${usuarioId} or a.usuario_id is null)
    order by a.criado_em desc
    limit ${LIMITE_LISTA}
  `;
  const itens: AvisoPainel[] = [];
  for (const linha of linhas) {
    const l = linhaSchema.parse(linha);
    itens.push({ id: l.id, tipo: l.tipo, titulo: l.titulo, corpo: l.corpo, link: l.link, lido: l.lido, criadoEm: l.criado_em.toISOString() });
  }
  return { itens, naoLidos: await contarNaoLidos(empresaId, usuarioId) };
}

export async function contarNaoLidos(empresaId: string, usuarioId: string): Promise<number> {
  if (!FORMATO_ID.test(usuarioId)) return 0;
  const [linha] = await sql<{ total: number }[]>`
    select count(*)::int as total
    from avisos a
    left join avisos_leituras l on l.aviso_id = a.id and l.usuario_id = ${usuarioId}
    where a.empresa_id = ${empresaId} and (a.usuario_id = ${usuarioId} or a.usuario_id is null)
      and a.lido_em is null and l.aviso_id is null
  `;
  return linha?.total ?? 0;
}

/** Marca um aviso como lido para esta pessoa. Avisos de outra empresa ou de outra pessoa não são tocados. */
export async function marcarLido(empresaId: string, usuarioId: string, avisoId: string): Promise<void> {
  if (!FORMATO_ID.test(usuarioId) || !FORMATO_ID.test(avisoId)) return;
  await sql`
    update avisos set lido_em = now()
    where id = ${avisoId} and empresa_id = ${empresaId} and usuario_id = ${usuarioId} and lido_em is null
  `;
  await sql`
    insert into avisos_leituras (aviso_id, usuario_id)
    select id, ${usuarioId} from avisos where id = ${avisoId} and empresa_id = ${empresaId} and usuario_id is null
    on conflict do nothing
  `;
}

export async function marcarTodosLidos(empresaId: string, usuarioId: string): Promise<void> {
  if (!FORMATO_ID.test(usuarioId)) return;
  await sql`
    update avisos set lido_em = now()
    where empresa_id = ${empresaId} and usuario_id = ${usuarioId} and lido_em is null
  `;
  await sql`
    insert into avisos_leituras (aviso_id, usuario_id)
    select id, ${usuarioId} from avisos where empresa_id = ${empresaId} and usuario_id is null
    on conflict do nothing
  `;
}

/** Avisos recentes da empresa, para a deduplicação. */
export async function listarAvisosRecentes(empresaId: string, agora: Date): Promise<AvisoExistente[]> {
  const desde = diaDeSaoPaulo(new Date(agora.getTime() - JANELA_DEDUP_DIAS * 24 * 3_600_000));
  const linhas = await sql<{ chave: string; usuario_id: string | null }[]>`
    select chave, usuario_id from avisos where empresa_id = ${empresaId} and dia >= ${desde}::date
  `;
  return linhas.map((l) => ({ chave: l.chave, usuarioId: l.usuario_id }));
}

/** Grava o aviso no painel de um destino (null = todos). Devolve false se o mesmo aviso já existia hoje. */
export async function gravarAviso(empresaId: string, destino: string | null, aviso: AvisoNovo, agora: Date): Promise<boolean> {
  const linhas = await sql`
    insert into avisos (empresa_id, usuario_id, tipo, titulo, corpo, link, chave, dia)
    values (${empresaId}, ${destino}, ${aviso.tipo}, ${aviso.titulo}, ${aviso.corpo}, ${aviso.link}, ${aviso.chave}, ${diaDeSaoPaulo(agora)}::date)
    on conflict do nothing
    returning id
  `;
  return linhas.length > 0;
}

const pessoaSchema = z.object({
  id: z.string(),
  nome: z.string(),
  email: z.string(),
  papel: z.string(),
  permissoes: z.array(z.string()),
  whatsapp: z.string().nullable(),
  aviso_email: z.boolean(),
  aviso_whatsapp: z.boolean(),
});

/** Pessoas ativas da empresa com os canais que escolheram. */
export async function listarPessoasDeAviso(empresaId: string): Promise<PessoaAviso[]> {
  const linhas = await sql`
    select id, nome, email, papel, permissoes, whatsapp, aviso_email, aviso_whatsapp
    from usuarios where empresa_id = ${empresaId} and ativo
    order by (papel = 'dono') desc, lower(nome) asc
  `;
  const pessoas: PessoaAviso[] = [];
  for (const linha of linhas) {
    const p = pessoaSchema.parse(linha);
    if (!ehPapel(p.papel)) continue;
    pessoas.push({
      id: p.id,
      nome: p.nome,
      email: p.email,
      papel: p.papel,
      permissoes: normalizarPermissoes(p.permissoes),
      whatsapp: p.whatsapp,
      avisoEmail: p.aviso_email,
      avisoWhatsapp: p.aviso_whatsapp,
    });
  }
  return pessoas;
}

export interface CanaisPessoa {
  /** 55DDDNUMERO ou null */
  whatsapp: string | null;
  email: boolean;
  avisoWhatsapp: boolean;
}

export async function lerCanais(empresaId: string, usuarioId: string): Promise<CanaisPessoa> {
  if (!FORMATO_ID.test(usuarioId)) return { whatsapp: null, email: true, avisoWhatsapp: false };
  const linhas = await sql<{ whatsapp: string | null; aviso_email: boolean; aviso_whatsapp: boolean }[]>`
    select whatsapp, aviso_email, aviso_whatsapp from usuarios where id = ${usuarioId} and empresa_id = ${empresaId}
  `;
  const l = linhas[0];
  return l ? { whatsapp: l.whatsapp, email: l.aviso_email, avisoWhatsapp: l.aviso_whatsapp } : { whatsapp: null, email: true, avisoWhatsapp: false };
}

export async function salvarCanais(empresaId: string, usuarioId: string, canais: CanaisPessoa): Promise<boolean> {
  if (!FORMATO_ID.test(usuarioId)) return false;
  const r = await sql`
    update usuarios set whatsapp = ${canais.whatsapp}, aviso_email = ${canais.email}, aviso_whatsapp = ${canais.avisoWhatsapp}
    where id = ${usuarioId} and empresa_id = ${empresaId}
  `;
  return r.count > 0;
}
