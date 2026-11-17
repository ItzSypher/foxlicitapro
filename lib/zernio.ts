import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * WhatsApp pelo Zernio (conversas individuais). Só ativa com ZERNIO_API_KEY e ZERNIO_WHATSAPP_ACCOUNT_ID;
 * sem elas, não envia e não quebra nada. Nada aqui lança: a falha volta no resultado.
 * Nunca registra a chave, cabeçalhos nem corpo de resposta: o log só leva o status e um código curto.
 */

const BASE = "https://zernio.com/api/v1";
const TIMEOUT_MS = 10_000;
const MAX_BOTOES = 3;
const MAX_TITULO_BOTAO = 20;
const EVENTO_RECEBIDA = "message.received";
const NOME_WEBHOOK = "foxlicita-whatsapp";

export interface ResultadoZernio {
  ok: boolean;
  erro?: string;
  messageId?: string;
  conversationId?: string;
}

export interface BotaoZernio {
  titulo: string;
  payload: string;
}

function chave(): string | null {
  const valor = process.env.ZERNIO_API_KEY?.trim();
  return valor ? valor : null;
}

function conta(): string | null {
  const valor = process.env.ZERNIO_WHATSAPP_ACCOUNT_ID?.trim();
  return valor ? valor : null;
}

export function zernioConfigurado(): boolean {
  return chave() !== null && conta() !== null;
}

const Registro = z.record(z.string(), z.unknown());
type Registro = z.infer<typeof Registro>;

function registro(valor: unknown): Registro | null {
  const lido = Registro.safeParse(valor);
  return lido.success ? lido.data : null;
}

function cadeia(origem: Registro | null, campo: string): string | null {
  const valor = origem?.[campo];
  if (typeof valor === "string" && valor !== "") return valor;
  if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  return null;
}

interface Resposta {
  ok: boolean;
  status: number;
  corpo: unknown;
  erro?: string;
}

/** Código curto de erro vindo do Zernio, só se for um token pequeno (nunca texto livre). */
function codigoCurto(corpo: unknown): string | null {
  const r = registro(corpo);
  const candidato = cadeia(r, "code") ?? cadeia(registro(r?.error), "code");
  return candidato !== null && /^[\w.-]{1,40}$/.test(candidato) ? candidato : null;
}

async function chamar(rotulo: string, metodo: "GET" | "POST" | "PUT", caminho: string, corpo?: unknown): Promise<Resposta> {
  const token = chave();
  if (token === null) return { ok: false, status: 0, corpo: null, erro: "zernio não configurado" };
  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (corpo !== undefined) headers["Content-Type"] = "application/json";
    const resposta = await fetch(`${BASE}${caminho}`, {
      method: metodo,
      headers,
      ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    let json: unknown = null;
    try {
      json = await resposta.json();
    } catch {
      json = null;
    }
    if (!resposta.ok) {
      const codigo = codigoCurto(json);
      console.error(`[zernio] ${rotulo} falhou: status ${resposta.status}${codigo ? ` (${codigo})` : ""}`);
      return { ok: false, status: resposta.status, corpo: json, erro: `falha ${resposta.status}` };
    }
    return { ok: true, status: resposta.status, corpo: json };
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    console.error(`[zernio] ${rotulo} sem resposta${timeout ? " (tempo esgotado)" : ""}`);
    return { ok: false, status: 0, corpo: null, erro: timeout ? "tempo esgotado" : "falha ao enviar" };
  }
}

/** Procura os ids na resposta, que pode vir solta ou dentro de `data`, `message` e `conversation`. */
function lerIds(corpo: unknown): { messageId?: string; conversationId?: string } {
  const raiz = registro(corpo);
  const data = registro(raiz?.data);
  const origens = [raiz, data];
  let messageId: string | null = null;
  let conversationId: string | null = null;
  for (const o of origens) {
    messageId ??= cadeia(o, "messageId") ?? cadeia(registro(o?.message), "id") ?? cadeia(registro(o?.message), "_id");
    conversationId ??=
      cadeia(o, "conversationId") ?? cadeia(registro(o?.conversation), "id") ?? cadeia(registro(o?.conversation), "_id");
  }
  return {
    ...(messageId !== null ? { messageId } : {}),
    ...(conversationId !== null ? { conversationId } : {}),
  };
}

function resultado(r: Resposta): ResultadoZernio {
  if (!r.ok) return { ok: false, ...(r.erro ? { erro: r.erro } : {}) };
  return { ok: true, ...lerIds(r.corpo) };
}

/** Texto livre (vale com a janela de 24 h aberta). Até 3 botões de resposta rápida. */
export async function enviarTexto(conversationId: string, texto: string, botoes?: ReadonlyArray<BotaoZernio>): Promise<ResultadoZernio> {
  const accountId = conta();
  if (accountId === null || chave() === null) return { ok: false, erro: "zernio não configurado" };
  if (conversationId === "") return { ok: false, erro: "sem conversa" };
  const lista = (botoes ?? []).slice(0, MAX_BOTOES).map((b) => ({
    type: "postback",
    title: b.titulo.slice(0, MAX_TITULO_BOTAO),
    payload: b.payload,
  }));
  const r = await chamar("enviarTexto", "POST", `/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, {
    accountId,
    message: texto,
    ...(lista.length > 0 ? { buttons: lista } : {}),
  });
  return resultado(r);
}

/** Template aprovado (abre conversa com a janela fechada; é cobrado). `numero` só com dígitos. */
export async function enviarTemplate(numero: string, nome: string, idioma: string, parametros: ReadonlyArray<string>): Promise<ResultadoZernio> {
  const accountId = conta();
  if (accountId === null || chave() === null) return { ok: false, erro: "zernio não configurado" };
  if (numero === "") return { ok: false, erro: "sem número" };
  const r = await chamar("enviarTemplate", "POST", "/inbox/conversations", {
    accountId,
    participantId: numero,
    templateName: nome,
    templateLanguage: idioma,
    templateParams: parametros,
  });
  return resultado(r);
}

/** "Digitando..." para a pessoa. Melhor esforço: falha não importa. */
export async function mostrarDigitando(conversationId: string): Promise<void> {
  const accountId = conta();
  if (accountId === null || chave() === null || conversationId === "") return;
  await chamar("mostrarDigitando", "POST", `/inbox/conversations/${encodeURIComponent(conversationId)}/typing`, { accountId });
}

const WebhookSchema = z
  .object({
    _id: z.string().optional(),
    id: z.string().optional(),
    url: z.string().optional(),
    events: z.array(z.string()).optional(),
  })
  .passthrough();
type WebhookLido = z.infer<typeof WebhookSchema>;

/** A lista pode vir em `webhooks`, em `data` (inclusive `data.webhooks`) ou solta. */
function listaDeWebhooks(corpo: unknown): WebhookLido[] {
  const raiz = registro(corpo);
  const candidatos: unknown[] = [corpo, raiz?.webhooks, raiz?.data, registro(raiz?.data)?.webhooks];
  for (const c of candidatos) {
    const lista = z.array(z.unknown()).safeParse(c);
    if (!lista.success) continue;
    const webhooks: WebhookLido[] = [];
    for (const e of lista.data) {
      const w = WebhookSchema.safeParse(e);
      if (w.success) webhooks.push(w.data);
    }
    return webhooks;
  }
  return [];
}

/**
 * Garante que o webhook de mensagens recebidas está registrado no Zernio. Se já existe um com a mesma URL,
 * não cria outro (e tenta incluir o evento, se faltar). `criado` diz se foi preciso criar.
 */
export async function garantirWebhook(url: string, segredo: string): Promise<{ ok: boolean; criado: boolean; erro?: string }> {
  const accountId = conta();
  if (accountId === null || chave() === null) return { ok: false, criado: false, erro: "zernio não configurado" };
  const atual = await chamar("webhooks.listar", "GET", "/webhooks/settings");
  if (!atual.ok) return { ok: false, criado: false, ...(atual.erro ? { erro: atual.erro } : {}) };

  const existente = listaDeWebhooks(atual.corpo).find((w) => w.url === url);
  if (existente) {
    const id = existente._id ?? existente.id;
    const eventos = existente.events ?? [];
    if (id && !eventos.includes(EVENTO_RECEBIDA)) {
      // Melhor esforço: se a API não aceitar, o webhook continua registrado como estava.
      await chamar("webhooks.atualizar", "PUT", "/webhooks/settings", { _id: id, events: [...eventos, EVENTO_RECEBIDA] });
    }
    return { ok: true, criado: false };
  }

  const criado = await chamar("webhooks.criar", "POST", "/webhooks/settings", {
    name: NOME_WEBHOOK,
    url,
    events: [EVENTO_RECEBIDA],
    secret: segredo,
    accountIds: [accountId],
  });
  if (!criado.ok) return { ok: false, criado: false, ...(criado.erro ? { erro: criado.erro } : {}) };
  return { ok: true, criado: true };
}

/**
 * Confere a assinatura do webhook: HMAC-SHA256 em hexadecimal do corpo cru, comparado em tempo constante.
 * Aceita o prefixo "sha256=" caso o Zernio o envie.
 */
export function assinaturaValida(corpoCru: string, assinatura: string | null, segredo: string): boolean {
  if (assinatura === null || segredo === "") return false;
  const recebida = assinatura.trim().replace(/^sha256=/i, "").toLowerCase();
  const esperada = createHmac("sha256", segredo).update(corpoCru, "utf8").digest("hex");
  const a = Buffer.from(recebida, "utf8");
  const b = Buffer.from(esperada, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
