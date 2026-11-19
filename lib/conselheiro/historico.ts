/**
 * Regras puras do histórico do chat: título da conversa, formato das datas e o que volta para a tela.
 * Sem rede e sem banco; usadas no servidor e no navegador.
 */

export type PapelMensagem = "usuario" | "assistente";

export interface MensagemConversa {
  papel: PapelMensagem;
  texto: string;
}

/** Linha da lista de conversas. Datas em ISO para atravessar o servidor e o navegador. */
export interface ResumoConversa {
  id: string;
  titulo: string;
  atualizadoEm: string;
  mensagens: number;
}

export interface ConversaAberta {
  id: string;
  titulo: string;
  mensagens: MensagemConversa[];
}

export const MAX_TITULO = 80;
/** Quantas conversas a lista mostra. */
export const MAX_CONVERSAS_NA_LISTA = 30;
/** Quantas mensagens voltam ao continuar uma conversa (as mais recentes). */
export const MAX_MENSAGENS_AO_CONTINUAR = 40;
/** O chat aceita até 2000 caracteres na pergunta; a resposta é cortada aqui por segurança. */
export const MAX_TEXTO_GRAVADO = 20_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Id de conversa no formato do banco; qualquer outra coisa é recusada antes da consulta. */
export function idDeConversaValido(id: unknown): id is string {
  return typeof id === "string" && UUID.test(id);
}

/** Título a partir da primeira pergunta: uma linha, sem espaços repetidos, cortado na palavra. */
export function tituloDaConversa(pergunta: string): string {
  const limpo = pergunta.replace(/\s+/g, " ").trim();
  if (limpo === "") return "Conversa sem título";
  if (limpo.length <= MAX_TITULO) return limpo;
  const corte = limpo.slice(0, MAX_TITULO - 1);
  const espaco = corte.lastIndexOf(" ");
  const base = espaco >= MAX_TITULO / 2 ? corte.slice(0, espaco) : corte;
  return `${base.replace(/[\s.,;:!?-]+$/, "")}…`;
}

/** Texto pronto para gravar: sem espaços nas pontas e dentro do limite da coluna. */
export function textoParaGravar(texto: string): string {
  const limpo = texto.trim();
  return limpo.length > MAX_TEXTO_GRAVADO ? limpo.slice(0, MAX_TEXTO_GRAVADO) : limpo;
}

const dataHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const horaSo = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", timeStyle: "short" });
const diaBrasilia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

/** "hoje, 14:05" para conversas do dia; "17/11/2026, 09:30" para as demais. */
export function quandoFoi(iso: string, agora: Date = new Date()): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return diaBrasilia.format(data) === diaBrasilia.format(agora) ? `hoje, ${horaSo.format(data)}` : dataHora.format(data);
}
