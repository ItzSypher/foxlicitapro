import { sql } from "./client";

/** Auxiliar só dos testes de banco: cria uma empresa descartável e a remove com tudo que ficou ligado a ela. */
export async function criarEmpresaDeTeste(): Promise<string> {
  const digitos = `9${String(Date.now()).slice(-9)}${String(Math.floor(Math.random() * 1e4)).padStart(4, "0")}`;
  const linhas = await sql<{ id: string }[]>`
    insert into empresas (cnpj, razao_social, porte, uf, municipio, cnaes, regioes)
    values (${digitos}, ${`EMPRESA DE TESTE ${digitos}`}, 'me', 'RJ', 'Nova Iguaçu', '[]'::jsonb, '["nova-iguacu"]'::jsonb)
    returning id
  `;
  const id = linhas[0]?.id;
  if (!id) throw new Error("A empresa de teste não foi criada");
  return id;
}

export async function removerEmpresaDeTeste(id: string): Promise<void> {
  await sql`delete from revisao_juridica_passos where empresa_id = ${id}`;
  await sql`delete from pipeline_comentarios where empresa_id = ${id}`;
  await sql`delete from pipeline_historico where empresa_id = ${id}`;
  await sql`delete from cotacoes where empresa_id = ${id}`;
  await sql`delete from fornecedor_precos where empresa_id = ${id}`;
  await sql`delete from fornecedores where empresa_id = ${id}`;
  await sql`delete from propostas where empresa_id = ${id}`;
  await sql`delete from palavras_chave where empresa_id = ${id}`;
  await sql`delete from preferencias where empresa_id = ${id}`;
  await sql`delete from resumo_envios where empresa_id = ${id}`;
  await sql`delete from pipeline_itens where empresa_id = ${id}`;
  await sql`delete from usuarios where empresa_id = ${id}`;
  await sql`delete from empresas where id = ${id}`;
}
