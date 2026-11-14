import "server-only";
import { z } from "zod";
import { sql } from "@/db/client";
import {
  ORIGENS_PRECO,
  filtrarFornecedores,
  sugerirPrecos,
  type DadosFornecedor,
  type Fornecedor,
  type OrigemPreco,
  type PrecoFornecedor,
  type SugestaoPreco,
} from "@/core/fornecedores";

/** Toda consulta daqui filtra por empresa_id; o id do fornecedor sozinho nunca basta. */

const FORMATO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const linhaFornecedor = z.object({
  id: z.string(),
  nome: z.string(),
  cnpj: z.string().nullable(),
  contato: z.string(),
  telefone: z.string(),
  email: z.string(),
  site: z.string(),
  categorias: z.string(),
  observacao: z.string(),
  ativo: z.boolean(),
});

const linhaPreco = z.object({
  id: z.string(),
  fornecedor_id: z.string(),
  fornecedor_nome: z.string(),
  descricao: z.string(),
  unidade: z.string(),
  preco: z.coerce.number(),
  prazo_dias: z.number().nullable(),
  data: z.string(),
  origem: z.enum(ORIGENS_PRECO),
});

function paraPreco(linha: unknown): PrecoFornecedor {
  const l = linhaPreco.parse(linha);
  return {
    id: l.id,
    fornecedorId: l.fornecedor_id,
    fornecedorNome: l.fornecedor_nome,
    descricao: l.descricao,
    unidade: l.unidade,
    preco: l.preco,
    prazoDias: l.prazo_dias,
    data: l.data,
    origem: l.origem,
  };
}

export interface NovoPreco {
  descricao: string;
  unidade: string;
  preco: number;
  prazoDias: number | null;
  /** AAAA-MM-DD; sem data, vale hoje */
  data?: string;
  origem: OrigemPreco;
}

/** Todos da empresa, por nome; com `busca`, filtra sem acento. */
export async function listarFornecedores(empresaId: string, busca = ""): Promise<Fornecedor[]> {
  const linhas = await sql`
    select id, nome, cnpj, contato, telefone, email, site, categorias, observacao, ativo
    from fornecedores
    where empresa_id = ${empresaId}
    order by lower(nome) asc
  `;
  return filtrarFornecedores(
    linhas.map((l) => linhaFornecedor.parse(l)),
    busca,
  );
}

export async function lerFornecedor(empresaId: string, id: string): Promise<Fornecedor | null> {
  if (!FORMATO_ID.test(id)) return null;
  const linhas = await sql`
    select id, nome, cnpj, contato, telefone, email, site, categorias, observacao, ativo
    from fornecedores
    where empresa_id = ${empresaId} and id = ${id}
    limit 1
  `;
  return linhas[0] ? linhaFornecedor.parse(linhas[0]) : null;
}

export async function criarFornecedor(empresaId: string, d: DadosFornecedor): Promise<string> {
  const linhas = await sql<{ id: string }[]>`
    insert into fornecedores (empresa_id, nome, cnpj, contato, telefone, email, site, categorias, observacao, ativo)
    values (${empresaId}, ${d.nome}, ${d.cnpj}, ${d.contato}, ${d.telefone}, ${d.email}, ${d.site}, ${d.categorias}, ${d.observacao}, ${d.ativo})
    returning id
  `;
  const id = linhas[0]?.id;
  if (!id) throw new Error("O fornecedor não foi gravado");
  return id;
}

/** False quando o fornecedor não existe nesta empresa. */
export async function atualizarFornecedor(empresaId: string, id: string, d: DadosFornecedor): Promise<boolean> {
  if (!FORMATO_ID.test(id)) return false;
  const r = await sql`
    update fornecedores
    set nome = ${d.nome}, cnpj = ${d.cnpj}, contato = ${d.contato}, telefone = ${d.telefone}, email = ${d.email},
        site = ${d.site}, categorias = ${d.categorias}, observacao = ${d.observacao}, ativo = ${d.ativo},
        atualizado_em = now()
    where empresa_id = ${empresaId} and id = ${id}
  `;
  return r.count > 0;
}

/** Histórico do fornecedor, do mais novo ao mais antigo. */
export async function listarPrecos(empresaId: string, fornecedorId: string, limite = 300): Promise<PrecoFornecedor[]> {
  if (!FORMATO_ID.test(fornecedorId)) return [];
  const linhas = await sql`
    select p.id, p.fornecedor_id, f.nome as fornecedor_nome, p.descricao, p.unidade, p.preco,
           p.prazo_dias, p.data::text as data, p.origem
    from fornecedor_precos p
    join fornecedores f on f.id = p.fornecedor_id and f.empresa_id = p.empresa_id
    where p.empresa_id = ${empresaId} and p.fornecedor_id = ${fornecedorId}
    order by p.data desc, p.criado_em desc
    limit ${Math.max(1, Math.min(1000, Math.trunc(limite)))}
  `;
  return linhas.map(paraPreco);
}

/** False quando o fornecedor não é desta empresa: nada é gravado. */
export async function adicionarPreco(empresaId: string, fornecedorId: string, p: NovoPreco): Promise<boolean> {
  if (!FORMATO_ID.test(fornecedorId)) return false;
  const r = await sql`
    insert into fornecedor_precos (empresa_id, fornecedor_id, descricao, unidade, preco, prazo_dias, data, origem)
    select f.empresa_id, f.id, ${p.descricao}, ${p.unidade}, ${p.preco.toFixed(2)}, ${p.prazoDias},
           ${p.data ?? sql`current_date`}, ${p.origem}
    from fornecedores f
    where f.empresa_id = ${empresaId} and f.id = ${fornecedorId}
  `;
  return r.count > 0;
}

/** Preços recentes dos fornecedores ativos da empresa, do mais novo ao mais antigo. */
export async function listarPrecosRecentes(empresaId: string, limite = 1000): Promise<PrecoFornecedor[]> {
  const linhas = await sql`
    select p.id, p.fornecedor_id, f.nome as fornecedor_nome, p.descricao, p.unidade, p.preco,
           p.prazo_dias, p.data::text as data, p.origem
    from fornecedor_precos p
    join fornecedores f on f.id = p.fornecedor_id and f.empresa_id = p.empresa_id
    where p.empresa_id = ${empresaId} and f.ativo
    order by p.data desc, p.criado_em desc
    limit ${Math.max(1, Math.min(2000, Math.trunc(limite)))}
  `;
  return linhas.map(paraPreco);
}

/** Último e menor preço conhecidos para itens parecidos com a descrição. */
export async function sugerirPrecoParaDescricao(empresaId: string, descricao: string): Promise<SugestaoPreco | null> {
  return sugerirPrecos(descricao, await listarPrecosRecentes(empresaId));
}
