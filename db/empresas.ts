import "server-only";
import type postgres from "postgres";
import { z } from "zod";
import { sql } from "@/db/client";
import { formatarCnpj, somenteDigitos, type EmpresaConsultada } from "@/core/brasilapi";
import { ehPorte, ehRegiao, type CnaePerfil, type PerfilEmpresa } from "@/core/perfil";
import type { Regiao } from "@/core/types";
import { criarUsuario } from "@/db/usuarios";
import type { Usuario } from "@/core/types-equipe";

const FORMATO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CnpjJaCadastrado extends Error {
  constructor() {
    super("Já existe uma empresa com esse CNPJ.");
    this.name = "CnpjJaCadastrado";
  }
}

const cnaeSchema = z.object({
  codigo: z.string().min(1).max(20),
  descricao: z.string().max(300),
  frente: z.enum(["servicos", "produtos"]),
  principal: z.boolean().default(false),
});

export const cnaesSchema = z.array(cnaeSchema).max(120);

interface LinhaEmpresa {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  porte: string;
  uf: string;
  municipio: string;
  cnaes: unknown;
  regioes: unknown;
  ativa: boolean;
  criada_em: Date;
  data_abertura: string | null;
  endereco: string | null;
  cep: string | null;
  telefone: string | null;
  email_contato: string | null;
  responsavel: string | null;
}

const colunas = () => sql`id, cnpj, razao_social, nome_fantasia, porte, uf, municipio, cnaes, regioes, ativa, criada_em,
  to_char(data_abertura, 'YYYY-MM-DD') as data_abertura, endereco, cep, telefone, email_contato, responsavel`;

export interface Empresa extends PerfilEmpresa {
  ativa: boolean;
  criadaEm: string;
}

function lerRegioes(bruto: unknown): Regiao[] {
  return Array.isArray(bruto) ? bruto.filter(ehRegiao) : [];
}

function converter(l: LinhaEmpresa): Empresa {
  const cnaes = cnaesSchema.safeParse(l.cnaes);
  return {
    id: l.id,
    cnpj: formatarCnpj(l.cnpj),
    razaoSocial: l.razao_social,
    nomeFantasia: l.nome_fantasia,
    porte: ehPorte(l.porte) ? l.porte : "demais",
    uf: l.uf,
    municipio: l.municipio,
    dataAbertura: l.data_abertura,
    cnaes: cnaes.success ? cnaes.data : [],
    regioes: lerRegioes(l.regioes),
    endereco: l.endereco,
    cep: l.cep,
    telefone: l.telefone,
    email: l.email_contato,
    responsavel: l.responsavel,
    ativa: l.ativa,
    criadaEm: l.criada_em.toISOString(),
  };
}

/** Perfil de uma empresa; null se o id não existe. O id vem da sessão, nunca do cliente. */
export async function lerEmpresa(id: string): Promise<Empresa | null> {
  if (!FORMATO_ID.test(id)) return null;
  const linhas = await sql<LinhaEmpresa[]>`select ${colunas()} from empresas where id = ${id} limit 1`;
  return linhas[0] ? converter(linhas[0]) : null;
}

export async function listarEmpresas(): Promise<Array<Empresa & { usuarios: number }>> {
  const linhas = await sql<Array<LinhaEmpresa & { usuarios: number }>>`
    select ${colunas()}, (select count(*)::int from usuarios u where u.empresa_id = empresas.id and u.ativo) as usuarios
    from empresas order by ativa desc, lower(razao_social) asc
  `;
  return linhas.map((l) => ({ ...converter(l), usuarios: l.usuarios }));
}

export async function listarIdsEmpresasAtivas(): Promise<string[]> {
  const linhas = await sql<{ id: string }[]>`select id from empresas where ativa order by criada_em asc`;
  return linhas.map((l) => l.id);
}

export interface NovaEmpresa extends Omit<EmpresaConsultada, "cnpj"> {
  cnpj: string;
  regioes: Regiao[];
}

/** Cria a empresa e o primeiro dono dela na mesma transação (ou nenhum dos dois). */
export async function criarEmpresaComDono(
  nova: NovaEmpresa,
  dono: { nome: string; email: string; senhaHash: string },
): Promise<{ empresa: Empresa; dono: Usuario }> {
  const cnaes = cnaesSchema.parse(nova.cnaes);
  const cnaesJson = JSON.parse(JSON.stringify(cnaes)) as postgres.JSONValue;
  const regioesJson = JSON.parse(JSON.stringify(nova.regioes.filter(ehRegiao))) as postgres.JSONValue;
  const digitos = somenteDigitos(nova.cnpj);
  try {
    return await sql.begin(async (tx) => {
      const linhas = await tx<LinhaEmpresa[]>`
        insert into empresas (cnpj, razao_social, nome_fantasia, porte, uf, municipio, cnaes, regioes, data_abertura,
                              endereco, cep, telefone, email_contato)
        values (${digitos}, ${nova.razaoSocial}, ${nova.nomeFantasia}, ${nova.porte}, ${nova.uf}, ${nova.municipio},
                ${tx.json(cnaesJson)}, ${tx.json(regioesJson)}, ${nova.dataAbertura}, ${nova.endereco}, ${nova.cep},
                ${nova.telefone}, ${nova.email})
        returning ${colunas()}
      `;
      const empresa = linhas[0] ? converter(linhas[0]) : null;
      if (!empresa) throw new Error("A empresa não foi gravada");
      const criado = await criarUsuario(
        { empresaId: empresa.id, nome: dono.nome, email: dono.email, papel: "dono", senhaHash: dono.senhaHash },
        tx as unknown as postgres.Sql,
      );
      return { empresa, dono: criado };
    });
  } catch (e) {
    if (typeof e === "object" && e !== null && "constraint_name" in e && e.constraint_name === "empresas_cnpj_key") {
      throw new CnpjJaCadastrado();
    }
    throw e;
  }
}

/** Desativada, ninguém da empresa entra. */
export async function definirEmpresaAtiva(id: string, ativa: boolean): Promise<boolean> {
  if (!FORMATO_ID.test(id)) return false;
  const r = await sql`update empresas set ativa = ${ativa} where id = ${id}`;
  return r.count > 0;
}

export interface EdicaoEmpresa {
  nomeFantasia: string | null;
  cnaes: CnaePerfil[];
  regioes: Regiao[];
}

/** Tela "Empresa" do dono: nome fantasia, CNAEs/frentes e regiões. O id é o da sessão. */
export async function atualizarPerfilEmpresa(empresaId: string, dados: EdicaoEmpresa): Promise<boolean> {
  if (!FORMATO_ID.test(empresaId)) return false;
  const cnaes = cnaesSchema.parse(dados.cnaes);
  const cnaesJson = JSON.parse(JSON.stringify(cnaes)) as postgres.JSONValue;
  const regioesJson = JSON.parse(JSON.stringify(dados.regioes.filter(ehRegiao))) as postgres.JSONValue;
  const fantasia = dados.nomeFantasia?.trim() ? dados.nomeFantasia.trim().slice(0, 120) : null;
  const r = await sql`
    update empresas
       set nome_fantasia = ${fantasia}, cnaes = ${sql.json(cnaesJson)}, regioes = ${sql.json(regioesJson)}
     where id = ${empresaId}
  `;
  return r.count > 0;
}

/** Remove uma empresa sem dados (uso de limpeza de testes). Falha se ainda houver dados ligados a ela. */
export async function excluirEmpresaVazia(id: string): Promise<boolean> {
  if (!FORMATO_ID.test(id)) return false;
  const r = await sql`delete from empresas where id = ${id}`;
  return r.count > 0;
}
