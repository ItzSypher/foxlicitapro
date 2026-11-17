import "server-only";
import { z } from "zod";
import { sql } from "@/db/client";
import {
  TIPOS_ALERTA_WA,
  lerPayload,
  payloadDoBotao,
  type AcaoBotao,
  type AlertaWa,
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
});

const colunasVinculo = () => sql`
  id, empresa_id, nome, papel, permissoes, whatsapp, aviso_whatsapp, wa_conversa_id, wa_ultima_entrada,
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
