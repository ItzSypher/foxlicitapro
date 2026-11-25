import "server-only";
import { z } from "zod";
import { sql } from "@/db/client";
import { TIPOS_ACERVO, TIPOS_ARQUIVO_ACERVO, type DadosAcervo, type DocumentoAcervo, type TipoArquivoAcervo } from "@/core/acervo";

/** Toda consulta daqui filtra por empresa_id; o id do documento sozinho nunca basta. */

const FORMATO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const linhaDocumento = z.object({
  id: z.string(),
  tipo: z.enum(TIPOS_ACERVO),
  titulo: z.string(),
  emissor: z.string().nullable(),
  emissor_cnpj: z.string().nullable(),
  descricao: z.string().nullable(),
  areas: z.array(z.string()),
  valor: z.number().nullable(),
  periodo_inicio: z.string().nullable(),
  periodo_fim: z.string().nullable(),
  emitido_em: z.string().nullable(),
  validade: z.string().nullable(),
  arquivo_tipo: z.enum(TIPOS_ARQUIVO_ACERVO).nullable(),
  arquivo_nome: z.string().nullable(),
  arquivo_tamanho: z.number().nullable(),
  atestado_id: z.string().nullable(),
  criado_em: z.date(),
});

function paraDocumento(linha: unknown): DocumentoAcervo {
  const l = linhaDocumento.parse(linha);
  return {
    id: l.id,
    tipo: l.tipo,
    titulo: l.titulo,
    emissor: l.emissor ?? "",
    emissorCnpj: l.emissor_cnpj,
    descricao: l.descricao ?? "",
    areas: l.areas,
    valor: l.valor,
    periodoInicio: l.periodo_inicio,
    periodoFim: l.periodo_fim,
    emitidoEm: l.emitido_em,
    validade: l.validade,
    arquivoTipo: l.arquivo_tipo,
    arquivoNome: l.arquivo_nome,
    arquivoTamanho: l.arquivo_tamanho,
    atestadoId: l.atestado_id,
    criadoEm: l.criado_em.toISOString(),
  };
}

function vazioParaNulo(valor: string): string | null {
  return valor.trim() === "" ? null : valor.trim();
}

/** Documentos da empresa, os mais recentes primeiro, sem o conteúdo do arquivo (que pode ter 4 MB). Datas viram AAAA-MM-DD. */
export async function listarAcervo(empresaId: string): Promise<DocumentoAcervo[]> {
  const linhas = await sql`
    select id, tipo, titulo, emissor, emissor_cnpj, descricao, areas, valor::float8 as valor,
           periodo_inicio::text as periodo_inicio, periodo_fim::text as periodo_fim,
           emitido_em::text as emitido_em, validade::text as validade,
           arquivo_tipo, arquivo_nome, arquivo_tamanho, atestado_id, criado_em
    from acervo_documentos
    where empresa_id = ${empresaId}
    order by criado_em desc
  `;
  return linhas.map(paraDocumento);
}

export async function lerDocumentoAcervo(empresaId: string, id: string): Promise<DocumentoAcervo | null> {
  if (!FORMATO_ID.test(id)) return null;
  const linhas = await sql`
    select id, tipo, titulo, emissor, emissor_cnpj, descricao, areas, valor::float8 as valor,
           periodo_inicio::text as periodo_inicio, periodo_fim::text as periodo_fim,
           emitido_em::text as emitido_em, validade::text as validade,
           arquivo_tipo, arquivo_nome, arquivo_tamanho, atestado_id, criado_em
    from acervo_documentos
    where empresa_id = ${empresaId} and id = ${id}
    limit 1
  `;
  return linhas.length === 0 ? null : paraDocumento(linhas[0]);
}

export interface ArquivoParaGravar {
  bytes: Uint8Array;
  tipo: TipoArquivoAcervo;
  nome: string;
}

export interface NovoDocumentoAcervo extends DadosAcervo {
  arquivo?: ArquivoParaGravar | null;
  /** Quando o documento nasce de um atestado assinado no sistema */
  atestadoId?: string | null;
  criadoPor?: string | null;
}

/** Cria o documento e devolve o id. A empresa vem sempre de quem chama (a sessão), nunca do formulário. */
export async function inserirNoAcervo(empresaId: string, d: NovoDocumentoAcervo): Promise<string> {
  const arquivo = d.arquivo ?? null;
  const linhas = await sql`
    insert into acervo_documentos (
      empresa_id, tipo, titulo, emissor, emissor_cnpj, descricao, areas, valor,
      periodo_inicio, periodo_fim, emitido_em, validade,
      arquivo, arquivo_tipo, arquivo_nome, arquivo_tamanho, atestado_id, criado_por
    ) values (
      ${empresaId}, ${d.tipo}, ${d.titulo}, ${vazioParaNulo(d.emissor)}, ${d.emissorCnpj}, ${vazioParaNulo(d.descricao)},
      ${d.areas}::text[], ${d.valor},
      ${d.periodoInicio}, ${d.periodoFim}, ${d.emitidoEm}, ${d.validade},
      ${arquivo === null ? null : Buffer.from(arquivo.bytes)}, ${arquivo?.tipo ?? null}, ${arquivo?.nome ?? null}, ${arquivo?.bytes.length ?? null},
      ${d.atestadoId ?? null}, ${d.criadoPor ?? null}
    )
    returning id
  `;
  return z.object({ id: z.string() }).parse(linhas[0]).id;
}

export const criarDocumentoAcervo = inserirNoAcervo;

/**
 * Atualiza os dados. `arquivo`: undefined mantém o atual, null remove, objeto troca.
 * Devolve false se o documento não é desta empresa.
 */
export async function atualizarDocumentoAcervo(
  empresaId: string,
  id: string,
  d: DadosAcervo,
  arquivo?: ArquivoParaGravar | null,
): Promise<boolean> {
  if (!FORMATO_ID.test(id)) return false;
  const trocaArquivo = arquivo !== undefined;
  const linhas = await sql`
    update acervo_documentos set
      tipo = ${d.tipo}, titulo = ${d.titulo}, emissor = ${vazioParaNulo(d.emissor)}, emissor_cnpj = ${d.emissorCnpj},
      descricao = ${vazioParaNulo(d.descricao)}, areas = ${d.areas}::text[], valor = ${d.valor},
      periodo_inicio = ${d.periodoInicio}, periodo_fim = ${d.periodoFim}, emitido_em = ${d.emitidoEm}, validade = ${d.validade},
      arquivo = case when ${trocaArquivo} then ${arquivo ? Buffer.from(arquivo.bytes) : null}::bytea else arquivo end,
      arquivo_tipo = case when ${trocaArquivo} then ${arquivo?.tipo ?? null}::text else arquivo_tipo end,
      arquivo_nome = case when ${trocaArquivo} then ${arquivo?.nome ?? null}::text else arquivo_nome end,
      arquivo_tamanho = case when ${trocaArquivo} then ${arquivo?.bytes.length ?? null}::integer else arquivo_tamanho end,
      atualizado_em = now()
    where empresa_id = ${empresaId} and id = ${id}
    returning id
  `;
  return linhas.length > 0;
}

export async function excluirDocumentoAcervo(empresaId: string, id: string): Promise<boolean> {
  if (!FORMATO_ID.test(id)) return false;
  const linhas = await sql`
    delete from acervo_documentos
    where empresa_id = ${empresaId} and id = ${id}
    returning id
  `;
  return linhas.length > 0;
}

export interface ArquivoLido {
  bytes: Buffer;
  tipo: TipoArquivoAcervo;
  nome: string;
}

const linhaArquivo = z.object({
  arquivo: z.instanceof(Uint8Array),
  arquivo_tipo: z.enum(TIPOS_ARQUIVO_ACERVO),
  arquivo_nome: z.string().nullable(),
});

/** Bytes, tipo e nome do arquivo; null se o documento não é da empresa ou não tem arquivo. */
export async function lerArquivoAcervo(empresaId: string, id: string): Promise<ArquivoLido | null> {
  if (!FORMATO_ID.test(id)) return null;
  const linhas = await sql`
    select arquivo, arquivo_tipo, arquivo_nome
    from acervo_documentos
    where empresa_id = ${empresaId} and id = ${id} and arquivo is not null and arquivo_tipo is not null
    limit 1
  `;
  if (linhas.length === 0) return null;
  const l = linhaArquivo.parse(linhas[0]);
  return { bytes: Buffer.from(l.arquivo), tipo: l.arquivo_tipo, nome: l.arquivo_nome ?? "documento" };
}
