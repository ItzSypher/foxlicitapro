import "server-only";
import { sql } from "@/db/client";
import { ehIdEmpresa } from "@/core/empresa-ativa";
import { normalizarEmail } from "@/db/usuarios";

export interface EmpresaAcessivel {
  id: string;
  /** Nome fantasia, ou a razão social se não houver */
  nome: string;
  razaoSocial: string;
  /** true se é a empresa do cadastro da pessoa */
  propria: boolean;
}

export interface GestorDaEmpresa {
  usuarioId: string;
  nome: string;
  email: string;
  ativo: boolean;
  /** Empresa de origem da pessoa (cadastro dela) */
  empresaOrigemId: string;
}

/** Empresas ativas que a pessoa acessa: a própria primeiro, depois as de usuario_empresas por nome. */
export async function listarEmpresasAcessiveis(usuarioId: string): Promise<EmpresaAcessivel[]> {
  if (!ehIdEmpresa(usuarioId)) return [];
  const linhas = await sql<{ id: string; razao_social: string; nome_fantasia: string | null; propria: boolean }[]>`
    select e.id, e.razao_social, e.nome_fantasia, (e.id = u.empresa_id) as propria
    from usuarios u
    join empresas e on e.ativa and (e.id = u.empresa_id or e.id in (select ue.empresa_id from usuario_empresas ue where ue.usuario_id = u.id))
    where u.id = ${usuarioId}
    order by (e.id = u.empresa_id) desc, lower(coalesce(nullif(trim(e.nome_fantasia), ''), e.razao_social)) asc
  `;
  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome_fantasia?.trim() || l.razao_social,
    razaoSocial: l.razao_social,
    propria: l.propria,
  }));
}

/** Ids das empresas ativas acessadas só por usuario_empresas (sem a própria). Usado pela sessão. */
export async function listarIdsEmpresasExtras(usuarioId: string): Promise<string[]> {
  if (!ehIdEmpresa(usuarioId)) return [];
  const linhas = await sql<{ id: string }[]>`
    select e.id from usuario_empresas ue join empresas e on e.id = ue.empresa_id
    where ue.usuario_id = ${usuarioId} and e.ativa
  `;
  return linhas.map((l) => l.id);
}

/** A pessoa acessa a empresa (própria ou por usuario_empresas)? Só conta empresa ativa. */
export async function usuarioAcessaEmpresa(usuarioId: string, empresaId: string): Promise<boolean> {
  if (!ehIdEmpresa(usuarioId) || !ehIdEmpresa(empresaId)) return false;
  const linhas = await sql<{ ok: boolean }[]>`
    select true as ok
    from empresas e
    where e.id = ${empresaId} and e.ativa
      and (
        exists (select 1 from usuarios u where u.id = ${usuarioId} and u.empresa_id = e.id)
        or exists (select 1 from usuario_empresas ue where ue.usuario_id = ${usuarioId} and ue.empresa_id = e.id)
      )
    limit 1
  `;
  return linhas.length > 0;
}

/** Dá à pessoa acesso à empresa. Idempotente; false se a pessoa ou a empresa não existem. */
export async function adicionarAcessoEmpresa(usuarioId: string, empresaId: string): Promise<boolean> {
  if (!ehIdEmpresa(usuarioId) || !ehIdEmpresa(empresaId)) return false;
  const linhas = await sql<{ usuario_id: string }[]>`
    insert into usuario_empresas (usuario_id, empresa_id)
    select u.id, e.id from usuarios u, empresas e where u.id = ${usuarioId} and e.id = ${empresaId}
    on conflict do nothing
    returning usuario_id
  `;
  if (linhas.length > 0) return true;
  // Sem linha nova: ou já existia (ok) ou a pessoa/empresa não existe.
  const existente = await sql`select 1 from usuario_empresas where usuario_id = ${usuarioId} and empresa_id = ${empresaId}`;
  return existente.length > 0;
}

export async function removerAcessoEmpresa(usuarioId: string, empresaId: string): Promise<boolean> {
  if (!ehIdEmpresa(usuarioId) || !ehIdEmpresa(empresaId)) return false;
  const r = await sql`delete from usuario_empresas where usuario_id = ${usuarioId} and empresa_id = ${empresaId}`;
  return r.count > 0;
}

/** Gestores de várias empresas que acessam esta empresa por usuario_empresas (não inclui a equipe própria dela). */
export async function listarGestoresDaEmpresa(empresaId: string): Promise<GestorDaEmpresa[]> {
  if (!ehIdEmpresa(empresaId)) return [];
  const linhas = await sql<{ id: string; nome: string; email: string; ativo: boolean; empresa_id: string }[]>`
    select u.id, u.nome, u.email, u.ativo, u.empresa_id
    from usuario_empresas ue join usuarios u on u.id = ue.usuario_id
    where ue.empresa_id = ${empresaId}
    order by lower(u.nome) asc
  `;
  return linhas.map((l) => ({ usuarioId: l.id, nome: l.nome, email: l.email, ativo: l.ativo, empresaOrigemId: l.empresa_id }));
}

/** Gestores de todas as empresas numa consulta só (tela do administrador), agrupados por empresa. */
export async function listarGestoresPorEmpresa(): Promise<Map<string, GestorDaEmpresa[]>> {
  const linhas = await sql<{ id: string; nome: string; email: string; ativo: boolean; empresa_id: string; acesso_empresa_id: string }[]>`
    select u.id, u.nome, u.email, u.ativo, u.empresa_id, ue.empresa_id as acesso_empresa_id
    from usuario_empresas ue join usuarios u on u.id = ue.usuario_id
    order by lower(u.nome) asc
  `;
  const mapa = new Map<string, GestorDaEmpresa[]>();
  for (const l of linhas) {
    const lista = mapa.get(l.acesso_empresa_id) ?? [];
    lista.push({ usuarioId: l.id, nome: l.nome, email: l.email, ativo: l.ativo, empresaOrigemId: l.empresa_id });
    mapa.set(l.acesso_empresa_id, lista);
  }
  return mapa;
}

export type ResultadoGestorPorEmail = "ok" | "sem_usuario" | "ja_e_da_empresa";

/** Dá acesso pelo e-mail de uma pessoa já cadastrada (de qualquer empresa). */
export async function adicionarGestorPorEmail(empresaId: string, email: string): Promise<ResultadoGestorPorEmail> {
  const linhas = await sql<{ id: string; empresa_id: string }[]>`
    select id, empresa_id from usuarios where email = ${normalizarEmail(email)} limit 1
  `;
  const pessoa = linhas[0];
  if (!pessoa) return "sem_usuario";
  if (pessoa.empresa_id === empresaId) return "ja_e_da_empresa";
  const gravou = await adicionarAcessoEmpresa(pessoa.id, empresaId);
  return gravou ? "ok" : "sem_usuario";
}
