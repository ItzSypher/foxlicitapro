import "server-only";
import { z } from "zod";
import { sql } from "@/db/client";
import {
  TIPOS_ALERTA_WA,
  TIPOS_AVULSOS_ANTIGOS,
  lerEscolhas,
  lerPayload,
  payloadDoBotao,
  type AcaoBotao,
  type AlertaWa,
  type EscolhasAlerta,
  type MudancaEtapa,
  type TipoAlertaWa,
} from "@/core/whatsapp-alertas";

const FORMATO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIAS_EVENTOS = 7;

export interface VinculoWa {
  usuarioId: string;
  empresaId: string;
  nome: string;
  papel: string;
  permissoes: string[];
  /** 55DDDNUMERO ou null */
  whatsapp: string | null;
  avisoWhatsapp: boolean;
  conversaId: string | null;
  ultimaEntrada: Date | null;
  /** Dia (AAAA-MM-DD, São Paulo) do último template enviado */
  ultimoTemplate: string | null;
  /** Perfil de alerta e o que a pessoa escolheu receber */
  escolhas: EscolhasAlerta;
}

export interface AlertaPendente {
  id: string;
  tipo: TipoAlertaWa;
  texto: string;
  itemId: string | null;
}

const vinculoSchema = z.object({
  id: z.string(),
  empresa_id: z.string(),
  nome: z.string(),
  papel: z.string(),
  permissoes: z.array(z.string()),
  whatsapp: z.string().nullable(),
  aviso_whatsapp: z.boolean(),
  wa_conversa_id: z.string().nullable(),
  wa_ultima_entrada: z.date().nullable(),
  wa_ultimo_template: z.string().nullable(),
  wa_perfil_alerta: z.unknown(),
});

const colunasVinculo = () => sql`
  id, empresa_id, nome, papel, permissoes, whatsapp, aviso_whatsapp, wa_conversa_id, wa_ultima_entrada, wa_perfil_alerta,
  to_char(wa_ultimo_template, 'YYYY-MM-DD') as wa_ultimo_template
`;

function paraVinculo(linha: unknown): VinculoWa {
  const l = vinculoSchema.parse(linha);
  return {
    usuarioId: l.id,
    empresaId: l.empresa_id,
    nome: l.nome,
    papel: l.papel,
    permissoes: l.permissoes,
    whatsapp: l.whatsapp,
    avisoWhatsapp: l.aviso_whatsapp,
    conversaId: l.wa_conversa_id,
    ultimaEntrada: l.wa_ultima_entrada,
    ultimoTemplate: l.wa_ultimo_template,
    escolhas: lerEscolhas(l.wa_perfil_alerta, l.papel),
  };
}

function violouUnico(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && e.code === "23505";
}

/* ---------- vínculo ---------- */

/** Pessoa ativa dona deste número (55DDDNUMERO). */
export async function lerVinculoPorNumero(numero: string): Promise<VinculoWa | null> {
  if (numero === "") return null;
  const linhas = await sql`select ${colunasVinculo()} from usuarios where whatsapp = ${numero} and ativo limit 1`;
  return linhas[0] ? paraVinculo(linhas[0]) : null;
}

export async function lerVinculoPorUsuario(usuarioId: string): Promise<VinculoWa | null> {
  if (!FORMATO_ID.test(usuarioId)) return null;
  const linhas = await sql`select ${colunasVinculo()} from usuarios where id = ${usuarioId} limit 1`;
  return linhas[0] ? paraVinculo(linhas[0]) : null;
}

/** Pessoas ativas que escolheram receber alertas e já têm conversa vinculada. */
export async function listarVinculosAtivos(empresaId: string): Promise<VinculoWa[]> {
  const linhas = await sql`
    select ${colunasVinculo()} from usuarios
    where empresa_id = ${empresaId} and ativo and aviso_whatsapp and wa_conversa_id is not null
    order by (papel = 'dono') desc, lower(nome) asc
  `;
  return linhas.map(paraVinculo);
}

/**
 * Gestores de várias empresas que acessam esta empresa por usuario_empresas (não a equipe própria dela),
 * ativos, com alertas ligados e conversa vinculada. Falha se a tabela usuario_empresas ainda não existe.
 */
export async function listarVinculosGestoresExtras(empresaId: string): Promise<VinculoWa[]> {
  const linhas = await sql`
    select ${colunasVinculo()} from usuarios
    where ativo and aviso_whatsapp and wa_conversa_id is not null and empresa_id <> ${empresaId}
      and id in (select usuario_id from usuario_empresas where empresa_id = ${empresaId})
    order by lower(nome) asc
  `;
  return linhas.map(paraVinculo);
}

/** Pessoas ativas da empresa com WhatsApp ligado (com os alertas pausados ou não), para a tela de situação. */
export async function listarVinculosDaEmpresa(empresaId: string): Promise<VinculoWa[]> {
  const linhas = await sql`
    select ${colunasVinculo()} from usuarios
    where empresa_id = ${empresaId} and ativo and whatsapp is not null
    order by (papel = 'dono') desc, lower(nome) asc
  `;
  return linhas.map(paraVinculo);
}

const resumoSchema = z.object({ usuario_id: z.string(), valor: z.string() });

/** Quando saiu o último resumo da manhã de cada pessoa da empresa (ISO). Quem nunca recebeu não aparece. */
export async function lerUltimosResumos(empresaId: string): Promise<Map<string, string>> {
  const linhas = await sql`
    select distinct on (u.id) u.id as usuario_id, c.valor
    from usuarios u
    join wa_config c on c.chave like 'manha:' || u.id::text || ':%'
    where u.empresa_id = ${empresaId}
    order by u.id, c.chave desc
  `;
  const mapa = new Map<string, string>();
  for (const linha of linhas) {
    const l = resumoSchema.safeParse(linha);
    if (l.success) mapa.set(l.data.usuario_id, l.data.valor);
  }
  return mapa;
}

export interface AvisoRecente {
  id: string;
  usuarioNome: string;
  tipo: string;
  status: string;
  /** Quando saiu; sem envio, quando entrou na fila */
  quando: Date;
}

const avisoRecenteSchema = z.object({
  id: z.string(),
  nome: z.string(),
  tipo: z.string(),
  status: z.string(),
  quando: z.date(),
});

/** Os avisos mais recentes da empresa. Licitações novas do resumo (uma linha por item) ficam de fora. */
export async function listarAvisosRecentes(empresaId: string, limite: number): Promise<AvisoRecente[]> {
  const linhas = await sql`
    select a.id, u.nome, a.tipo, a.status, coalesce(a.enviado_em, a.criado_em) as quando
    from wa_alertas a
    join usuarios u on u.id = a.usuario_id
    where a.empresa_id = ${empresaId} and a.tipo <> 'radar'
    order by coalesce(a.enviado_em, a.criado_em) desc
    limit ${Math.max(1, Math.trunc(limite))}
  `;
  const avisos: AvisoRecente[] = [];
  for (const linha of linhas) {
    const l = avisoRecenteSchema.safeParse(linha);
    if (l.success) avisos.push({ id: l.data.id, usuarioNome: l.data.nome, tipo: l.data.tipo, status: l.data.status, quando: l.data.quando });
  }
  return avisos;
}

/** Guarda o código de ativação da pessoa. Falso se a pessoa não é desta empresa ou o código já está em uso. */
export async function definirCodigo(empresaId: string, usuarioId: string, codigo: string, expira: Date): Promise<boolean> {
  if (!FORMATO_ID.test(usuarioId)) return false;
  try {
    const r = await sql`
      update usuarios set wa_codigo = ${codigo}, wa_codigo_expira = ${expira.toISOString()}::timestamptz
      where id = ${usuarioId} and empresa_id = ${empresaId} and ativo
    `;
    return r.count > 0;
  } catch (e) {
    if (violouUnico(e)) return false;
    throw e;
  }
}

/** Liga o número à pessoa dona do código (válido e não expirado). O número não pode estar em outra pessoa. */
export async function ativarPorCodigo(
  codigo: string,
  numero: string,
  conversaId: string,
  agora: Date,
): Promise<{ ok: true; vinculo: VinculoWa } | { ok: false; motivo: "codigo" | "numero_em_uso" }> {
  const instante = agora.toISOString();
  let linhas: Array<{ id: string }>;
  try {
    linhas = await sql<{ id: string }[]>`
      update usuarios
      set whatsapp = ${numero}, wa_conversa_id = ${conversaId}, wa_ultima_entrada = ${instante}::timestamptz,
          aviso_whatsapp = true, wa_codigo = null, wa_codigo_expira = null
      where wa_codigo = ${codigo} and wa_codigo_expira > ${instante}::timestamptz and ativo
      returning id
    `;
  } catch (e) {
    if (violouUnico(e)) return { ok: false, motivo: "numero_em_uso" };
    throw e;
  }
  const id = linhas[0]?.id;
  if (id === undefined) return { ok: false, motivo: "codigo" };
  const vinculo = await lerVinculoPorUsuario(id);
  return vinculo ? { ok: true, vinculo } : { ok: false, motivo: "codigo" };
}

/** A pessoa escreveu: guarda a conversa e abre a janela de 24 h. */
export async function registrarEntrada(usuarioId: string, conversaId: string, agora: Date): Promise<void> {
  if (!FORMATO_ID.test(usuarioId)) return;
  await sql`
    update usuarios set wa_conversa_id = ${conversaId}, wa_ultima_entrada = ${agora.toISOString()}::timestamptz
    where id = ${usuarioId}
  `;
}

export async function definirAvisoWhatsapp(usuarioId: string, ativo: boolean): Promise<void> {
  if (!FORMATO_ID.test(usuarioId)) return;
  await sql`update usuarios set aviso_whatsapp = ${ativo} where id = ${usuarioId}`;
}

/** Desfaz o vínculo: zera número, conversa e a escolha de receber. */
export async function desligarWhatsapp(empresaId: string, usuarioId: string): Promise<void> {
  if (!FORMATO_ID.test(usuarioId)) return;
  await sql`
    update usuarios
    set whatsapp = null, wa_conversa_id = null, wa_ultima_entrada = null, aviso_whatsapp = false,
        wa_codigo = null, wa_codigo_expira = null
    where id = ${usuarioId} and empresa_id = ${empresaId}
  `;
}

/** `dia` no formato AAAA-MM-DD (São Paulo). */
export async function marcarTemplateEnviado(usuarioId: string, dia: string): Promise<void> {
  if (!FORMATO_ID.test(usuarioId)) return;
  await sql`update usuarios set wa_ultimo_template = ${dia}::date where id = ${usuarioId}`;
}

/* ---------- perfil de alerta e responsável padrão ---------- */

/** Grava o perfil de alerta e as escolhas da pessoa. */
export async function salvarEscolhasAlerta(empresaId: string, usuarioId: string, escolhas: EscolhasAlerta): Promise<boolean> {
  if (!FORMATO_ID.test(usuarioId)) return false;
  const dados = { ...escolhas };
  const r = await sql`
    update usuarios set wa_perfil_alerta = ${sql.json(dados)}
    where id = ${usuarioId} and empresa_id = ${empresaId}
  `;
  return r.count > 0;
}

export interface ResponsavelPadrao {
  id: string;
  nome: string;
}

/** Quem recebe o item no "Atribuir a ..." dos alertas; null se não definido ou a pessoa não está ativa. */
export async function lerResponsavelPadrao(empresaId: string): Promise<ResponsavelPadrao | null> {
  const linhas = await sql<{ id: string; nome: string }[]>`
    select u.id::text as id, u.nome from empresas e
    join usuarios u on u.id = e.wa_responsavel_padrao and u.empresa_id = e.id and u.ativo
    where e.id = ${empresaId}
  `;
  return linhas[0] ?? null;
}

/** Define (ou limpa, com null) o responsável padrão. Falso se a pessoa não é ativa desta empresa. */
export async function definirResponsavelPadrao(empresaId: string, usuarioId: string | null): Promise<boolean> {
  if (usuarioId !== null) {
    if (!FORMATO_ID.test(usuarioId)) return false;
    const pessoa = await sql`select 1 from usuarios where id = ${usuarioId} and empresa_id = ${empresaId} and ativo`;
    if (pessoa.length === 0) return false;
  }
  const r = await sql`update empresas set wa_responsavel_padrao = ${usuarioId} where id = ${empresaId}`;
  return r.count > 0;
}

/* ---------- fila de alertas ---------- */

/** Grava os alertas; o que a pessoa já recebeu (mesma chave) é ignorado. Devolve só os novos. */
export async function enfileirarAlertas(empresaId: string, alertas: ReadonlyArray<AlertaWa>): Promise<AlertaWa[]> {
  const novos: AlertaWa[] = [];
  for (const a of alertas) {
    if (!FORMATO_ID.test(a.usuarioId)) continue;
    const linhas = await sql`
      insert into wa_alertas (empresa_id, usuario_id, tipo, chave, texto, item_id, validade)
      values (${empresaId}, ${a.usuarioId}, ${a.tipo}, ${a.chave}, ${a.texto}, ${a.itemId},
              ${a.validade === null ? null : a.validade.toISOString()}::timestamptz)
      on conflict (usuario_id, chave) do nothing
      returning id
    `;
    if (linhas.length > 0) novos.push(a);
  }
  return novos;
}

const pendenteSchema = z.object({
  id: z.string(),
  tipo: z.enum(TIPOS_ALERTA_WA),
  texto: z.string(),
  item_id: z.string().nullable(),
});

/** Alertas que esperam envio e ainda valem, do mais antigo ao mais novo. */
export async function listarPendentes(usuarioId: string, agora: Date): Promise<AlertaPendente[]> {
  if (!FORMATO_ID.test(usuarioId)) return [];
  const linhas = await sql`
    select id, tipo, texto, item_id from wa_alertas
    where usuario_id = ${usuarioId} and status = 'pendente'
      and (validade is null or validade > ${agora.toISOString()}::timestamptz)
    order by criado_em asc
  `;
  const pendentes: AlertaPendente[] = [];
  for (const linha of linhas) {
    const l = pendenteSchema.safeParse(linha);
    if (l.success) pendentes.push({ id: l.data.id, tipo: l.data.tipo, texto: l.data.texto, itemId: l.data.item_id });
  }
  return pendentes;
}

export async function marcarEnviados(ids: ReadonlyArray<string>, agora: Date): Promise<void> {
  const validos = ids.filter((id) => FORMATO_ID.test(id));
  if (validos.length === 0) return;
  await sql`
    update wa_alertas set status = 'enviado', enviado_em = ${agora.toISOString()}::timestamptz
    where id in ${sql(validos)}
  `;
}

/** Pendentes cuja validade já passou viram descartados. Devolve quantos. */
export async function descartarVencidos(agora: Date): Promise<number> {
  const r = await sql`
    update wa_alertas set status = 'descartado'
    where status = 'pendente' and validade is not null and validade <= ${agora.toISOString()}::timestamptz
  `;
  return r.count;
}

/** Pendentes de tipos que não saem mais avulsos (Radar, sem responsável, etapa, 48 h) viram descartados. */
export async function descartarAvulsosAntigos(): Promise<number> {
  const r = await sql`
    update wa_alertas set status = 'descartado'
    where status = 'pendente' and tipo in ${sql([...TIPOS_AVULSOS_ANTIGOS])}
  `;
  return r.count;
}

/** Grava como já enviados (o resumo da manhã mostrou). Mesma chave para a mesma pessoa é ignorada. */
export async function registrarEnviados(empresaId: string, alertas: ReadonlyArray<AlertaWa>, agora: Date): Promise<void> {
  for (const a of alertas) {
    if (!FORMATO_ID.test(a.usuarioId)) continue;
    await sql`
      insert into wa_alertas (empresa_id, usuario_id, tipo, chave, texto, item_id, validade, status, enviado_em)
      values (${empresaId}, ${a.usuarioId}, ${a.tipo}, ${a.chave}, ${a.texto}, ${a.itemId},
              ${a.validade === null ? null : a.validade.toISOString()}::timestamptz, 'enviado', ${agora.toISOString()}::timestamptz)
      on conflict (usuario_id, chave) do nothing
    `;
  }
}

/** Das chaves dadas, as que esta pessoa já tem (enviadas, pendentes ou descartadas). */
export async function chavesRegistradas(usuarioId: string, chaves: ReadonlyArray<string>): Promise<Set<string>> {
  if (!FORMATO_ID.test(usuarioId) || chaves.length === 0) return new Set();
  const linhas = await sql<{ chave: string }[]>`
    select chave from wa_alertas where usuario_id = ${usuarioId} and chave in ${sql([...chaves])}
  `;
  return new Set(linhas.map((l) => l.chave));
}

/* ---------- eventos do webhook ---------- */

/** Verdadeiro se o evento é novo; falso se já foi processado (o Zernio reenvia). */
export async function registrarEvento(id: string): Promise<boolean> {
  const linhas = await sql`insert into wa_eventos (id) values (${id}) on conflict do nothing returning id`;
  return linhas.length > 0;
}

/** Apaga os eventos com mais de 7 dias. Devolve quantos. */
export async function limparEventos(agora: Date): Promise<number> {
  const corte = new Date(agora.getTime() - DIAS_EVENTOS * 24 * 3_600_000);
  const r = await sql`delete from wa_eventos where recebido_em < ${corte.toISOString()}::timestamptz`;
  return r.count;
}

/* ---------- ação que espera "Confirma?" ---------- */

/** Uma por pessoa: a nova troca a anterior. */
export async function gravarPendencia(usuarioId: string, acao: AcaoBotao, expira: Date): Promise<void> {
  if (!FORMATO_ID.test(usuarioId)) return;
  const dados = { payload: payloadDoBotao(acao) };
  await sql`
    insert into wa_pendencias (usuario_id, acao, expira_em)
    values (${usuarioId}, ${sql.json(dados)}, ${expira.toISOString()}::timestamptz)
    on conflict (usuario_id) do update set acao = excluded.acao, expira_em = excluded.expira_em
  `;
}

const pendenciaSchema = z.object({ acao: z.object({ payload: z.string() }) });

export async function lerPendencia(usuarioId: string, agora: Date): Promise<AcaoBotao | null> {
  if (!FORMATO_ID.test(usuarioId)) return null;
  const linhas = await sql`
    select acao from wa_pendencias
    where usuario_id = ${usuarioId} and expira_em > ${agora.toISOString()}::timestamptz
  `;
  const l = pendenciaSchema.safeParse(linhas[0]);
  return l.success ? lerPayload(l.data.acao.payload) : null;
}

export async function apagarPendencia(usuarioId: string): Promise<void> {
  if (!FORMATO_ID.test(usuarioId)) return;
  await sql`delete from wa_pendencias where usuario_id = ${usuarioId}`;
}

/* ---------- configuração e contadores ---------- */

export async function lerConfig(chave: string): Promise<string | null> {
  const linhas = await sql<{ valor: string }[]>`select valor from wa_config where chave = ${chave}`;
  return linhas[0]?.valor ?? null;
}

export async function gravarConfig(chave: string, valor: string): Promise<void> {
  await sql`
    insert into wa_config (chave, valor) values (${chave}, ${valor})
    on conflict (chave) do update set valor = excluded.valor, atualizado_em = now()
  `;
}

/** Soma `n` ao contador (cria em `n` se não existe) e devolve o total. */
export async function somarContador(chave: string, n: number): Promise<number> {
  const inteiro = Math.trunc(n);
  const linhas = await sql<{ valor: string }[]>`
    insert into wa_config (chave, valor) values (${chave}, ${String(inteiro)})
    on conflict (chave) do update
      set valor = (wa_config.valor::bigint + ${inteiro}::bigint)::text, atualizado_em = now()
    returning valor
  `;
  return Number(linhas[0]?.valor ?? inteiro);
}

/* ---------- mudanças de etapa e donos ---------- */

const mudancaSchema = z.object({
  historico_id: z.string(),
  item_id: z.string(),
  objeto: z.string(),
  de: z.string().nullable(),
  para: z.string(),
  por_id: z.string().nullable(),
  responsavel: z.string().nullable(),
});

/** Movimentos do pipeline depois de `desde`, com o objeto do item e o responsável atual. */
export async function listarMudancasDesde(empresaId: string, desde: Date): Promise<MudancaEtapa[]> {
  const linhas = await sql`
    select h.id::text as historico_id, h.item_id, h.de, h.para, h.usuario_id::text as por_id,
           i.responsavel::text as responsavel, coalesce(i.dados->>'objeto', '') as objeto
    from pipeline_historico h
    join pipeline_itens i on i.empresa_id = h.empresa_id and i.id = h.item_id
    where h.empresa_id = ${empresaId} and h.em > ${desde.toISOString()}::timestamptz
    order by h.em asc, h.id asc
  `;
  return linhas.map((linha) => {
    const l = mudancaSchema.parse(linha);
    return {
      historicoId: l.historico_id,
      itemId: l.item_id,
      objeto: l.objeto,
      de: l.de,
      para: l.para,
      porId: l.por_id,
      responsavelId: l.responsavel,
    };
  });
}

/** Pessoas ativas com papel de dono. */
export async function idsDonos(empresaId: string): Promise<Set<string>> {
  const linhas = await sql<{ id: string }[]>`select id from usuarios where empresa_id = ${empresaId} and ativo and papel = 'dono'`;
  return new Set(linhas.map((l) => l.id));
}
