import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type postgres from "postgres";
import { sql } from "@/db/client";
import {
  DIAS_VALIDADE_LINK,
  LIMITE_ARQUIVO_BYTES,
  conteudoParaHash,
  ehStatusAtestado,
  gerarCodigo,
  normalizarCodigo,
  podeAssinar,
  podeEditar,
  type AssinaturaCliente,
  type DadosAtestado,
  type StatusAtestado,
} from "@/core/atestados";

/** Toda consulta logada filtra por empresa_id; o id sozinho nunca basta. As públicas partem do token ou do código. */

const FORMATO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/;

type Tx = postgres.TransactionSql;

const sha256 = (dado: string | Buffer): string => createHash("sha256").update(dado).digest("hex");

interface LinhaAtestado {
  id: string;
  empresa_id: string;
  cliente_nome: string;
  cliente_cnpj: string | null;
  cliente_endereco: string | null;
  responsavel_nome: string | null;
  responsavel_cargo: string | null;
  responsavel_contato: string | null;
  objeto: string;
  areas: string[];
  periodo_inicio: string | null;
  periodo_fim: string | null;
  valor: number | null;
  texto: string;
  status: string;
  token: string | null;
  token_expira: Date | null;
  codigo: string | null;
  assinado_em: Date | null;
  assinante_nome: string | null;
  assinante_cargo: string | null;
  assinatura_ip: string | null;
  assinatura_agente: string | null;
  conteudo_hash: string | null;
  tem_arquivo: boolean;
  criado_em: Date;
}

/** Sem as colunas pesadas (assinatura em imagem e PDF); elas só saem onde o documento é desenhado. */
const colunas = () => sql`id, empresa_id, cliente_nome, cliente_cnpj, cliente_endereco, responsavel_nome, responsavel_cargo,
  responsavel_contato, objeto, areas, to_char(periodo_inicio, 'YYYY-MM-DD') as periodo_inicio,
  to_char(periodo_fim, 'YYYY-MM-DD') as periodo_fim, valor::float8 as valor, texto, status, token, token_expira, codigo,
  assinado_em, assinante_nome, assinante_cargo, assinatura_ip, assinatura_agente, conteudo_hash,
  (arquivo_assinado is not null) as tem_arquivo, criado_em`;

export interface Atestado {
  id: string;
  empresaId: string;
  clienteNome: string;
  clienteCnpj: string | null;
  clienteEndereco: string | null;
  responsavelNome: string | null;
  responsavelCargo: string | null;
  responsavelContato: string | null;
  objeto: string;
  areas: string[];
  periodoInicio: string | null;
  periodoFim: string | null;
  valor: number | null;
  texto: string;
  status: StatusAtestado;
  token: string | null;
  /** Link ainda dentro do prazo */
  linkValido: boolean;
  tokenExpira: string | null;
  codigo: string | null;
  assinadoEm: string | null;
  assinanteNome: string | null;
  assinanteCargo: string | null;
  assinaturaIp: string | null;
  assinaturaAgente: string | null;
  conteudoHash: string | null;
  temArquivoAssinado: boolean;
  criadoEm: string;
}

function converter(l: LinhaAtestado, agora: Date = new Date()): Atestado {
  return {
    id: l.id,
    empresaId: l.empresa_id,
    clienteNome: l.cliente_nome,
    clienteCnpj: l.cliente_cnpj,
    clienteEndereco: l.cliente_endereco,
    responsavelNome: l.responsavel_nome,
    responsavelCargo: l.responsavel_cargo,
    responsavelContato: l.responsavel_contato,
    objeto: l.objeto,
    areas: l.areas,
    periodoInicio: l.periodo_inicio,
    periodoFim: l.periodo_fim,
    valor: l.valor,
    texto: l.texto,
    status: ehStatusAtestado(l.status) ? l.status : "rascunho",
    token: l.token,
    linkValido: l.token !== null && l.token_expira !== null && l.token_expira.getTime() > agora.getTime(),
    tokenExpira: l.token_expira ? l.token_expira.toISOString() : null,
    codigo: l.codigo,
    assinadoEm: l.assinado_em ? l.assinado_em.toISOString() : null,
    assinanteNome: l.assinante_nome,
    assinanteCargo: l.assinante_cargo,
    assinaturaIp: l.assinatura_ip,
    assinaturaAgente: l.assinatura_agente,
    conteudoHash: l.conteudo_hash,
    temArquivoAssinado: l.tem_arquivo === true,
    criadoEm: l.criado_em.toISOString(),
  };
}

export async function criarAtestado(empresaId: string, usuarioId: string | null, d: DadosAtestado): Promise<string> {
  const linhas = await sql<{ id: string }[]>`
    insert into atestados (empresa_id, cliente_nome, cliente_cnpj, cliente_endereco, responsavel_nome, responsavel_cargo,
      responsavel_contato, objeto, areas, periodo_inicio, periodo_fim, valor, texto, criado_por)
    values (${empresaId}, ${d.clienteNome}, ${d.clienteCnpj}, ${d.clienteEndereco}, ${d.responsavelNome}, ${d.responsavelCargo},
      ${d.responsavelContato}, ${d.objeto}, ${d.areas}::text[], ${d.periodoInicio}, ${d.periodoFim}, ${d.valor}, ${d.texto}, ${usuarioId})
    returning id
  `;
  return linhas[0].id;
}

/**
 * Só rascunho e aguardando mudam. Editar um atestado que já foi enviado o devolve a rascunho e derruba o link:
 * o cliente nunca assina um texto diferente do que leu.
 */
export async function atualizarAtestado(empresaId: string, id: string, d: DadosAtestado): Promise<boolean> {
  if (!FORMATO_ID.test(id)) return false;
  const linhas = await sql<{ id: string }[]>`
    update atestados set cliente_nome = ${d.clienteNome}, cliente_cnpj = ${d.clienteCnpj}, cliente_endereco = ${d.clienteEndereco},
      responsavel_nome = ${d.responsavelNome}, responsavel_cargo = ${d.responsavelCargo}, responsavel_contato = ${d.responsavelContato},
      objeto = ${d.objeto}, areas = ${d.areas}::text[], periodo_inicio = ${d.periodoInicio}, periodo_fim = ${d.periodoFim},
      valor = ${d.valor}, texto = ${d.texto}, status = 'rascunho', token = null, token_expira = null, atualizado_em = now()
    where empresa_id = ${empresaId} and id = ${id} and status in ('rascunho', 'aguardando')
    returning id
  `;
  return linhas.length > 0;
}

export async function listarAtestados(empresaId: string): Promise<Atestado[]> {
  const linhas = await sql<LinhaAtestado[]>`
    select ${colunas()} from atestados where empresa_id = ${empresaId} order by criado_em desc limit 200
  `;
  const agora = new Date();
  return linhas.map((l) => converter(l, agora));
}

export async function lerAtestado(empresaId: string, id: string): Promise<Atestado | null> {
  if (!FORMATO_ID.test(id)) return null;
  const linhas = await sql<LinhaAtestado[]>`select ${colunas()} from atestados where empresa_id = ${empresaId} and id = ${id} limit 1`;
  return linhas[0] ? converter(linhas[0]) : null;
}

/** Imagem da assinatura do cliente (data URL); null se ainda não assinou. */
export async function lerAssinaturaDoAtestado(empresaId: string, id: string): Promise<string | null> {
  if (!FORMATO_ID.test(id)) return null;
  const linhas = await sql<{ assinatura: string | null }[]>`
    select assinatura from atestados where empresa_id = ${empresaId} and id = ${id} limit 1
  `;
  return linhas[0]?.assinatura ?? null;
}

/**
 * Link do cliente. Aguardando com link ainda válido por mais de um dia devolve o mesmo (a menos que `renovar`);
 * senão gera token novo de 32 bytes em base64url, vale 30 dias e deixa o atestado aguardando.
 */
export async function gerarLink(
  empresaId: string,
  id: string,
  renovar = false,
): Promise<{ token: string; expira: string } | null> {
  if (!FORMATO_ID.test(id)) return null;
  const atual = await sql<Array<{ status: string; token: string | null; token_expira: Date | null }>>`
    select status, token, token_expira from atestados where empresa_id = ${empresaId} and id = ${id} limit 1
  `;
  const a = atual[0];
  if (!a || !ehStatusAtestado(a.status) || !podeEditar(a.status)) return null;
  if (!renovar && a.status === "aguardando" && a.token && a.token_expira && a.token_expira.getTime() > Date.now() + 86_400_000) {
    return { token: a.token, expira: a.token_expira.toISOString() };
  }
  const token = randomBytes(32).toString("base64url");
  const linhas = await sql<{ token_expira: Date }[]>`
    update atestados
    set token = ${token}, token_expira = now() + make_interval(days => ${DIAS_VALIDADE_LINK}::int),
        status = 'aguardando', atualizado_em = now()
    where empresa_id = ${empresaId} and id = ${id} and status in ('rascunho', 'aguardando')
    returning token_expira
  `;
  const expira = linhas[0]?.token_expira;
  return expira ? { token, expira: expira.toISOString() } : null;
}

export async function cancelarAtestado(empresaId: string, id: string): Promise<boolean> {
  if (!FORMATO_ID.test(id)) return false;
  const linhas = await sql<{ id: string }[]>`
    update atestados set status = 'cancelado', token = null, token_expira = null, atualizado_em = now()
    where empresa_id = ${empresaId} and id = ${id} and status in ('rascunho', 'aguardando')
    returning id
  `;
  return linhas.length > 0;
}

// ---------- página pública do cliente ----------

export interface AtestadoPublico {
  empresaId: string;
  status: "aguardando" | "assinado";
  /** Aguardando com o prazo do link vencido */
  expirado: boolean;
  clienteNome: string;
  clienteCnpj: string | null;
  clienteEndereco: string | null;
  responsavelNome: string | null;
  responsavelCargo: string | null;
  texto: string;
  codigo: string | null;
  assinadoEm: string | null;
  assinanteNome: string | null;
  assinanteCargo: string | null;
  /** Data URL da assinatura (só depois de assinado) */
  assinatura: string | null;
}

interface LinhaPublica {
  empresa_id: string;
  status: string;
  token_expira: Date | null;
  cliente_nome: string;
  cliente_cnpj: string | null;
  cliente_endereco: string | null;
  responsavel_nome: string | null;
  responsavel_cargo: string | null;
  texto: string;
  codigo: string | null;
  assinado_em: Date | null;
  assinante_nome: string | null;
  assinante_cargo: string | null;
  assinatura: string | null;
}

/** Aguardando ou assinado; rascunho e cancelado não aparecem. Só o que o documento precisa (nada de IP, CPF ou contato). */
export async function lerPorToken(token: string): Promise<AtestadoPublico | null> {
  if (!FORMATO_TOKEN.test(token)) return null;
  const linhas = await sql<LinhaPublica[]>`
    select empresa_id, status, token_expira, cliente_nome, cliente_cnpj, cliente_endereco, responsavel_nome, responsavel_cargo,
      texto, codigo, assinado_em, assinante_nome, assinante_cargo, assinatura
    from atestados
    where token = ${token} and status in ('aguardando', 'assinado')
    limit 1
  `;
  const l = linhas[0];
  if (!l) return null;
  const assinado = l.status === "assinado";
  return {
    empresaId: l.empresa_id,
    status: assinado ? "assinado" : "aguardando",
    expirado: !assinado && !(l.token_expira && l.token_expira.getTime() > Date.now()),
    clienteNome: l.cliente_nome,
    clienteCnpj: l.cliente_cnpj,
    clienteEndereco: l.cliente_endereco,
    responsavelNome: l.responsavel_nome,
    responsavelCargo: l.responsavel_cargo,
    texto: l.texto,
    codigo: l.codigo,
    assinadoEm: l.assinado_em ? l.assinado_em.toISOString() : null,
    assinanteNome: l.assinante_nome,
    assinanteCargo: l.assinante_cargo,
    assinatura: assinado ? l.assinatura : null,
  };
}

/** Código curto único: confere no banco dentro da transação (a restrição unique cobre a corrida). */
async function novoCodigo(tx: Tx): Promise<string> {
  for (let tentativa = 0; tentativa < 8; tentativa += 1) {
    const codigo = gerarCodigo(randomBytes(8));
    const existe = await tx`select 1 from atestados where codigo = ${codigo} limit 1`;
    if (existe.length === 0) return codigo;
  }
  throw new Error("Não foi possível gerar um código único.");
}

/** Cria ou atualiza o item do acervo ligado ao atestado, lendo tudo do próprio atestado (inclusive o PDF). */
async function sincronizarAcervo(tx: Tx, id: string): Promise<void> {
  const atualizados = await tx<{ id: string }[]>`
    update acervo_documentos d set
      titulo = left('Atestado — ' || a.cliente_nome, 200), emissor = a.cliente_nome, emissor_cnpj = a.cliente_cnpj,
      descricao = a.objeto, areas = a.areas, valor = a.valor, periodo_inicio = a.periodo_inicio, periodo_fim = a.periodo_fim,
      arquivo = a.arquivo_assinado,
      arquivo_tipo = case when a.arquivo_assinado is null then null else 'application/pdf' end,
      arquivo_nome = case when a.arquivo_assinado is null then null else 'Atestado-' || coalesce(a.codigo, 'assinado') || '.pdf' end,
      arquivo_tamanho = octet_length(a.arquivo_assinado),
      atualizado_em = now()
    from atestados a
    where a.id = ${id} and d.atestado_id = a.id and d.empresa_id = a.empresa_id
    returning d.id
  `;
  if (atualizados.length > 0) return;
  await tx`
    insert into acervo_documentos (empresa_id, tipo, titulo, emissor, emissor_cnpj, descricao, areas, valor, periodo_inicio,
      periodo_fim, emitido_em, arquivo, arquivo_tipo, arquivo_nome, arquivo_tamanho, atestado_id, criado_por)
    select a.empresa_id, 'atestado', left('Atestado — ' || a.cliente_nome, 200), a.cliente_nome, a.cliente_cnpj, a.objeto, a.areas,
      a.valor, a.periodo_inicio, a.periodo_fim,
      (coalesce(a.assinado_em, now()) at time zone 'America/Sao_Paulo')::date,
      a.arquivo_assinado,
      case when a.arquivo_assinado is null then null else 'application/pdf' end,
      case when a.arquivo_assinado is null then null else 'Atestado-' || coalesce(a.codigo, 'assinado') || '.pdf' end,
      octet_length(a.arquivo_assinado), a.id, a.criado_por
    from atestados a where a.id = ${id}
  `;
}

export type ResultadoAssinatura =
  | { ok: true; codigo: string }
  | { ok: false; motivo: "indisponivel" | "expirado" | "ja-assinado" };

interface LinhaParaAssinar {
  id: string;
  empresa_id: string;
  cliente_nome: string;
  cliente_cnpj: string | null;
  objeto: string;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  valor: number | null;
  texto: string;
  status: string;
  token_expira: Date | null;
}

/**
 * Assina pelo link. Transação: trava a linha, confere status e prazo, grava assinatura, IP, navegador, SHA-256 e código,
 * muda para assinado e registra o atestado no acervo da empresa.
 */
export async function assinar(
  token: string,
  assinante: AssinaturaCliente,
  origem: { ip: string; agente: string },
): Promise<ResultadoAssinatura> {
  if (!FORMATO_TOKEN.test(token)) return { ok: false, motivo: "indisponivel" };
  return sql.begin(async (tx): Promise<ResultadoAssinatura> => {
    const linhas = await tx<LinhaParaAssinar[]>`
      select id, empresa_id, cliente_nome, cliente_cnpj, objeto, to_char(periodo_inicio, 'YYYY-MM-DD') as periodo_inicio,
        to_char(periodo_fim, 'YYYY-MM-DD') as periodo_fim, valor::float8 as valor, texto, status, token_expira
      from atestados where token = ${token} for update
    `;
    const a = linhas[0];
    if (!a || a.status === "cancelado" || a.status === "rascunho") return { ok: false, motivo: "indisponivel" };
    if (a.status === "assinado") return { ok: false, motivo: "ja-assinado" };
    const agora = new Date();
    if (!podeAssinar("aguardando", a.token_expira, agora)) return { ok: false, motivo: "expirado" };

    const codigo = await novoCodigo(tx);
    const hash = sha256(
      conteudoParaHash({
        empresaId: a.empresa_id,
        clienteNome: a.cliente_nome,
        clienteCnpj: a.cliente_cnpj,
        objeto: a.objeto,
        periodoInicio: a.periodo_inicio,
        periodoFim: a.periodo_fim,
        valor: a.valor,
        texto: a.texto,
        assinanteNome: assinante.nome,
        assinanteCargo: assinante.cargo,
        assinadoEm: agora.toISOString(),
      }),
    );
    await tx`
      update atestados set status = 'assinado', assinado_em = ${agora}, codigo = ${codigo}, assinante_nome = ${assinante.nome},
        assinante_cargo = ${assinante.cargo}, assinante_documento = ${assinante.documento}, assinatura = ${assinante.assinatura},
        assinatura_ip = ${origem.ip.slice(0, 64)}, assinatura_agente = ${origem.agente.slice(0, 400)}, conteudo_hash = ${hash},
        atualizado_em = now()
      where id = ${a.id}
    `;
    await sincronizarAcervo(tx, a.id);
    return { ok: true, codigo };
  });
}

// ---------- verificação pública ----------

export interface VerificacaoAtestado {
  codigo: string;
  clienteNome: string;
  clienteCnpj: string | null;
  emissora: string;
  assinadoEm: string;
  /** null quando o PDF foi assinado fora do sistema */
  assinanteNome: string | null;
  assinanteCargo: string | null;
  hash: string;
  /** O conteúdo guardado ainda gera o mesmo hash; null quando o PDF foi assinado fora */
  integro: boolean | null;
}

interface LinhaVerificacao extends LinhaParaAssinar {
  codigo: string;
  assinado_em: Date;
  assinante_nome: string | null;
  assinante_cargo: string | null;
  conteudo_hash: string;
  emissora: string;
}

/** Só dados não sensíveis: nada de CPF, IP, contato ou imagem da assinatura. */
export async function lerPorCodigo(bruto: string): Promise<VerificacaoAtestado | null> {
  const codigo = normalizarCodigo(bruto);
  if (codigo === null) return null;
  const linhas = await sql<LinhaVerificacao[]>`
    select a.id, a.empresa_id, a.cliente_nome, a.cliente_cnpj, a.objeto, to_char(a.periodo_inicio, 'YYYY-MM-DD') as periodo_inicio,
      to_char(a.periodo_fim, 'YYYY-MM-DD') as periodo_fim, a.valor::float8 as valor, a.texto, a.status, a.token_expira,
      a.codigo, a.assinado_em, a.assinante_nome, a.assinante_cargo, a.conteudo_hash, e.razao_social as emissora
    from atestados a join empresas e on e.id = a.empresa_id
    where a.codigo = ${codigo} and a.status = 'assinado' and a.conteudo_hash is not null and a.assinado_em is not null
    limit 1
  `;
  const l = linhas[0];
  if (!l) return null;
  const doSistema = l.assinante_nome !== null && l.assinante_cargo !== null;
  const integro = doSistema
    ? sha256(
        conteudoParaHash({
          empresaId: l.empresa_id,
          clienteNome: l.cliente_nome,
          clienteCnpj: l.cliente_cnpj,
          objeto: l.objeto,
          periodoInicio: l.periodo_inicio,
          periodoFim: l.periodo_fim,
          valor: l.valor,
          texto: l.texto,
          assinanteNome: l.assinante_nome ?? "",
          assinanteCargo: l.assinante_cargo ?? "",
          assinadoEm: l.assinado_em.toISOString(),
        }),
      ) === l.conteudo_hash
    : null;
  return {
    codigo: l.codigo,
    clienteNome: l.cliente_nome,
    clienteCnpj: l.cliente_cnpj,
    emissora: l.emissora,
    assinadoEm: l.assinado_em.toISOString(),
    assinanteNome: l.assinante_nome,
    assinanteCargo: l.assinante_cargo,
    hash: l.conteudo_hash,
    integro,
  };
}

// ---------- PDF assinado fora do sistema (gov.br) ----------

export type ResultadoArquivo = { ok: true } | { ok: false; motivo: "nao-encontrado" | "cancelado" | "grande" | "formato" };

/**
 * Guarda o PDF assinado fora (até 4 MB). Em atestado já assinado na tela, só anexa. Em rascunho ou aguardando,
 * conta como assinado fora do sistema: ganha código e o hash do próprio PDF, e o link do cliente deixa de valer.
 * O acervo da empresa recebe (ou atualiza) o documento com o arquivo.
 */
export async function anexarArquivoAssinado(empresaId: string, id: string, bytes: Buffer): Promise<ResultadoArquivo> {
  if (!FORMATO_ID.test(id)) return { ok: false, motivo: "nao-encontrado" };
  if (bytes.length > LIMITE_ARQUIVO_BYTES) return { ok: false, motivo: "grande" };
  if (bytes.length < 5 || bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return { ok: false, motivo: "formato" };
  return sql.begin(async (tx): Promise<ResultadoArquivo> => {
    const linhas = await tx<{ status: string }[]>`
      select status from atestados where empresa_id = ${empresaId} and id = ${id} for update
    `;
    const status = linhas[0]?.status;
    if (status === undefined) return { ok: false, motivo: "nao-encontrado" };
    if (status === "cancelado") return { ok: false, motivo: "cancelado" };
    if (status === "assinado") {
      await tx`
        update atestados set arquivo_assinado = ${bytes}, arquivo_assinado_tipo = 'application/pdf', atualizado_em = now()
        where id = ${id}
      `;
    } else {
      const codigo = await novoCodigo(tx);
      await tx`
        update atestados set arquivo_assinado = ${bytes}, arquivo_assinado_tipo = 'application/pdf', status = 'assinado',
          assinado_em = now(), codigo = ${codigo}, conteudo_hash = ${sha256(bytes)}, token = null, token_expira = null,
          atualizado_em = now()
        where id = ${id}
      `;
    }
    await sincronizarAcervo(tx, id);
    return { ok: true };
  });
}

/** PDF assinado fora, para baixar. */
export async function lerArquivoAssinado(empresaId: string, id: string): Promise<Buffer | null> {
  if (!FORMATO_ID.test(id)) return null;
  const linhas = await sql<{ arquivo_assinado: Buffer | null }[]>`
    select arquivo_assinado from atestados where empresa_id = ${empresaId} and id = ${id} limit 1
  `;
  return linhas[0]?.arquivo_assinado ?? null;
}
