import "server-only";
import type postgres from "postgres";
import { sql } from "@/db/client";
import { LIMITE_ASSISTENTE_PADRAO, ehPapel, normalizarPermissoes, permissoesPadrao, type Permissao } from "@/core/permissoes";
import type { Papel, Usuario } from "@/core/types-equipe";

const FORMATO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_NULO = "00000000-0000-0000-0000-000000000000";

interface LinhaUsuario {
  id: string;
  nome: string;
  email: string;
  papel: string;
  ativo: boolean;
  permissoes: string[];
  limite_propostas_assistente_dia: number;
  empresa_id: string;
  superadmin: boolean;
}

export class EmailJaCadastrado extends Error {
  constructor() {
    super("Já existe uma pessoa com esse e-mail.");
    this.name = "EmailJaCadastrado";
  }
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

function converter(l: LinhaUsuario): Usuario | null {
  if (!ehPapel(l.papel)) return null;
  return {
    id: l.id,
    nome: l.nome,
    email: l.email,
    papel: l.papel,
    ativo: l.ativo,
    empresaId: l.empresa_id,
    superadmin: l.superadmin,
    permissoes: normalizarPermissoes(l.permissoes),
    limitePropostasAssistenteDia: l.limite_propostas_assistente_dia,
  };
}

function somenteValidos(linhas: LinhaUsuario[]): Usuario[] {
  const usuarios: Usuario[] = [];
  for (const l of linhas) {
    const u = converter(l);
    if (u) usuarios.push(u);
  }
  return usuarios;
}

export async function contarUsuarios(): Promise<number> {
  const [linha] = await sql<{ total: number }[]>`select count(*)::int as total from usuarios`;
  return linha?.total ?? 0;
}

/** Ativos primeiro, dono antes do gestor, depois por nome. */
export async function listarUsuarios(empresaId: string): Promise<Usuario[]> {
  const linhas = await sql<LinhaUsuario[]>`
    select id, nome, email, papel, ativo, permissoes, limite_propostas_assistente_dia, empresa_id, superadmin from usuarios
    where empresa_id = ${empresaId}
    order by ativo desc, (papel = 'dono') desc, lower(nome) asc
  `;
  return somenteValidos(linhas);
}

export async function listarUsuariosAtivos(empresaId: string): Promise<Usuario[]> {
  const linhas = await sql<LinhaUsuario[]>`
    select id, nome, email, papel, ativo, permissoes, limite_propostas_assistente_dia, empresa_id, superadmin from usuarios
    where ativo and empresa_id = ${empresaId} order by (papel = 'dono') desc, lower(nome) asc
  `;
  return somenteValidos(linhas);
}

/**
 * Lê a pessoa pelo id, de qualquer empresa (uso da sessão). `ativo` só vale com a empresa ativa:
 * empresa desativada, ninguém dela entra (o superadmin sempre entra).
 */
export async function lerUsuario(id: string): Promise<Usuario | null> {
  if (!FORMATO_ID.test(id)) return null;
  const linhas = await sql<LinhaUsuario[]>`
    select u.id, u.nome, u.email, u.papel, (u.ativo and (e.ativa or u.superadmin)) as ativo, u.permissoes,
           u.limite_propostas_assistente_dia, u.empresa_id, u.superadmin
    from usuarios u join empresas e on e.id = u.empresa_id
    where u.id = ${id} limit 1
  `;
  const linha = linhas[0];
  return linha ? converter(linha) : null;
}

/** Lê a pessoa só se ela for da empresa informada (null se for de outra). */
export async function lerUsuarioDaEmpresa(empresaId: string, id: string): Promise<Usuario | null> {
  if (!FORMATO_ID.test(id)) return null;
  const linhas = await sql<LinhaUsuario[]>`
    select id, nome, email, papel, ativo, permissoes, limite_propostas_assistente_dia, empresa_id, superadmin
    from usuarios where id = ${id} and empresa_id = ${empresaId} limit 1
  `;
  const linha = linhas[0];
  return linha ? converter(linha) : null;
}

/** Para o login: o usuário e o hash da senha, ou null se o e-mail não existe. */
export async function lerCredenciais(email: string): Promise<{ usuario: Usuario; senhaHash: string } | null> {
  const linhas = await sql<(LinhaUsuario & { senha_hash: string })[]>`
    select u.id, u.nome, u.email, u.papel, (u.ativo and (e.ativa or u.superadmin)) as ativo, u.permissoes,
           u.limite_propostas_assistente_dia, u.empresa_id, u.superadmin, u.senha_hash
    from usuarios u join empresas e on e.id = u.empresa_id
    where u.email = ${normalizarEmail(email)} limit 1
  `;
  const linha = linhas[0];
  if (!linha) return null;
  const usuario = converter(linha);
  return usuario ? { usuario, senhaHash: linha.senha_hash } : null;
}

export async function lerSenhaHash(id: string): Promise<string | null> {
  if (!FORMATO_ID.test(id)) return null;
  const linhas = await sql<{ senha_hash: string }[]>`select senha_hash from usuarios where id = ${id} limit 1`;
  return linhas[0]?.senha_hash ?? null;
}

export async function criarUsuario(dados: {
  empresaId: string;
  nome: string;
  email: string;
  papel: Papel;
  senhaHash: string;
  /** Sem informar, vale o padrão do papel */
  permissoes?: Permissao[];
  limitePropostasAssistenteDia?: number;
}, executor: postgres.Sql = sql): Promise<Usuario> {
  const permissoes = normalizarPermissoes(dados.permissoes ?? permissoesPadrao(dados.papel));
  const limite = dados.limitePropostasAssistenteDia ?? LIMITE_ASSISTENTE_PADRAO;
  try {
    const linhas = await executor<LinhaUsuario[]>`
      insert into usuarios (empresa_id, nome, email, senha_hash, papel, permissoes, limite_propostas_assistente_dia)
      values (${dados.empresaId}, ${dados.nome.trim()}, ${normalizarEmail(dados.email)}, ${dados.senhaHash}, ${dados.papel},
              ${permissoes}::text[], ${limite})
      returning id, nome, email, papel, ativo, permissoes, limite_propostas_assistente_dia, empresa_id, superadmin
    `;
    const usuario = linhas[0] ? converter(linhas[0]) : null;
    if (!usuario) throw new Error("O usuário não foi gravado");
    return usuario;
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && e.code === "23505") throw new EmailJaCadastrado();
    throw e;
  }
}

/** Primeiro acesso: cria o dono (superadmin, na empresa mais antiga) só se a tabela ainda estiver vazia (uma única instrução, sem corrida). */
export async function criarDonoInicial(dados: {
  nome: string;
  email: string;
  senhaHash: string;
}): Promise<Usuario | null> {
  const linhas = await sql<LinhaUsuario[]>`
    insert into usuarios (empresa_id, nome, email, senha_hash, papel, superadmin)
    select (select id from empresas order by criada_em asc limit 1), ${dados.nome}, ${normalizarEmail(dados.email)}, ${dados.senhaHash}, 'dono', true
    where not exists (select 1 from usuarios) and exists (select 1 from empresas)
    returning id, nome, email, papel, ativo, permissoes, limite_propostas_assistente_dia, empresa_id, superadmin
  `;
  return linhas[0] ? converter(linhas[0]) : null;
}

/** Troca papel, permissões e limite. Nunca deixa o sistema sem um dono ativo. */
export async function atualizarAcessos(
  empresaId: string,
  id: string,
  dados: { papel: Papel; permissoes: Permissao[]; limitePropostasAssistenteDia: number },
): Promise<boolean> {
  if (!FORMATO_ID.test(id)) return false;
  const permissoes = normalizarPermissoes(dados.permissoes);
  const r = await sql`
    update usuarios
       set papel = ${dados.papel}, permissoes = ${permissoes}::text[], limite_propostas_assistente_dia = ${dados.limitePropostasAssistenteDia}
     where id = ${id} and empresa_id = ${empresaId}
       and (
         ${dados.papel === "dono"}
         or papel <> 'dono'
         or not ativo
         or exists (select 1 from usuarios outro where outro.empresa_id = ${empresaId} and outro.papel = 'dono' and outro.ativo and outro.id <> ${id})
       )
  `;
  return r.count > 0;
}

export async function definirSenhaUsuario(empresaId: string, id: string, senhaHash: string): Promise<boolean> {
  if (!FORMATO_ID.test(id)) return false;
  const r = await sql`update usuarios set senha_hash = ${senhaHash} where id = ${id} and empresa_id = ${empresaId}`;
  return r.count > 0;
}

/** Desativar nunca deixa o sistema sem um dono ativo. */
export async function definirAtivo(empresaId: string, id: string, ativo: boolean): Promise<boolean> {
  if (!FORMATO_ID.test(id)) return false;
  const r = await sql`
    update usuarios set ativo = ${ativo}
    where id = ${id} and empresa_id = ${empresaId}
      and (
        ${ativo}
        or papel <> 'dono'
        or exists (select 1 from usuarios outro where outro.empresa_id = ${empresaId} and outro.papel = 'dono' and outro.ativo and outro.id <> ${id})
      )
  `;
  return r.count > 0;
}

export async function excluirUsuario(empresaId: string, id: string): Promise<boolean> {
  if (!FORMATO_ID.test(id)) return false;
  const r = await sql`delete from usuarios where id = ${id} and empresa_id = ${empresaId}`;
  return r.count > 0;
}

/** E-mails dos usuários ativos com os ids dados (para avisos). */
export async function emailsDosUsuarios(empresaId: string, ids: string[]): Promise<string[]> {
  const validos = ids.filter((id) => FORMATO_ID.test(id));
  if (validos.length === 0) return [];
  const linhas = await sql<{ email: string }[]>`
    select email from usuarios where ativo and empresa_id = ${empresaId} and id in ${sql(validos)}
  `;
  return linhas.map((l) => l.email);
}

/** E-mails de todos os ativos da empresa, menos o do usuário informado. */
export async function emailsDosOutros(empresaId: string, exceto: string): Promise<string[]> {
  const linhas = await sql<{ email: string }[]>`
    select email from usuarios where ativo and empresa_id = ${empresaId} and id <> ${FORMATO_ID.test(exceto) ? exceto : ID_NULO}
  `;
  return linhas.map((l) => l.email);
}
