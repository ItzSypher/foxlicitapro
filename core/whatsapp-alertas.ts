/**
 * Regras dos alertas de WhatsApp pelo Zernio (funções puras, sem banco nem rede; o relógio entra por parâmetro).
 * Janela de 24 h, horário permitido, faixas de prazo, destinatários, comandos, botões e leitura do webhook.
 */
import { NOTA_ALTA, diaDeSaoPaulo, textoRestante } from "@/core/avisos";
import { resumirObjeto } from "@/core/objeto";
import { ROTULO_ETAPA, ehEtapa } from "@/components/pipeline/tipos";
import { z } from "zod";

const MS_HORA = 3_600_000;
export const JANELA_MS = 24 * MS_HORA;
export const MARGEM_JANELA_MS = 30 * 60_000;
export const HORA_INICIO = 7;
export const HORA_FIM = 20;
const MAX_OBJETO = 120;
const MAX_LISTA_RESUMO = 8;
const MAX_LISTA_MANHA = 5;
const ETAPAS_ENCERRADAS: ReadonlyArray<string> = ["ganha", "perdida"];

/* ---------- janela e horário ---------- */

/** A conversa aceita texto livre enquanto a última mensagem da pessoa tem menos de 24 h (menos a margem de segurança). */
export function janelaAberta(ultimaEntrada: Date | null, agora: Date): boolean {
  if (ultimaEntrada === null) return false;
  return agora.getTime() - ultimaEntrada.getTime() < JANELA_MS - MARGEM_JANELA_MS;
}

const formatoHora = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  hour: "numeric",
  hourCycle: "h23",
});

/** Hora cheia (0 a 23) em São Paulo. */
export function horaDeSaoPaulo(agora: Date): number {
  const parte = formatoHora.formatToParts(agora).find((p) => p.type === "hour");
  return parte ? Number(parte.value) % 24 : 0;
}

/** Alertas só saem entre 7h e 20h59 (hora cheia de 7 a 20). */
export function dentroDoHorario(agora: Date): boolean {
  const hora = horaDeSaoPaulo(agora);
  return hora >= HORA_INICIO && hora <= HORA_FIM;
}

/** Mês civil em São Paulo, como AAAA-MM. */
export function mesDeSaoPaulo(agora: Date): string {
  return diaDeSaoPaulo(agora).slice(0, 7);
}

/* ---------- faixas de prazo ---------- */

export type FaixaPrazo = "prazo48" | "prazo24" | "prazo2";

/** (0, 2 h] prazo2; (2 h, 24 h] prazo24; (24 h, 48 h] prazo48; fora disso, null. */
export function faixaDoPrazo(encerramento: Date, agora: Date): FaixaPrazo | null {
  const restante = encerramento.getTime() - agora.getTime();
  if (Number.isNaN(restante) || restante <= 0) return null;
  if (restante <= 2 * MS_HORA) return "prazo2";
  if (restante <= 24 * MS_HORA) return "prazo24";
  if (restante <= 48 * MS_HORA) return "prazo48";
  return null;
}

/* ---------- alertas ---------- */

export const TIPOS_ALERTA_WA = ["prazo48", "prazo24", "prazo2", "radar", "sem_responsavel", "etapa", "aviso"] as const;
export type TipoAlertaWa = (typeof TIPOS_ALERTA_WA)[number];

export interface AlertaWa {
  usuarioId: string;
  tipo: TipoAlertaWa;
  /** Identifica o fato; a mesma chave não vira alerta de novo para a mesma pessoa */
  chave: string;
  texto: string;
  /** Item do pipeline, quando houver (usado nos botões) */
  itemId: string | null;
  /** Depois disso o alerta não vale mais */
  validade: Date | null;
}

export interface ItemAlerta {
  id: string;
  etapa: string;
  objeto: string;
  /** ISO 8601 */
  dataEncerramento: string;
  responsavelId: string | null;
}

export interface PessoaWa {
  id: string;
  /** aviso_whatsapp ligado e conversa vinculada */
  ativa: boolean;
}

export interface OportunidadeAlta {
  id: string;
  objeto: string;
  nota: number;
  /** ISO 8601 */
  dataEncerramento: string;
  link: string;
}

export interface MudancaEtapa {
  historicoId: string;
  itemId: string;
  objeto: string;
  de: string | null;
  para: string;
  /** Quem moveu o item */
  porId: string | null;
  responsavelId: string | null;
}

function cortar(texto: string, max: number): string {
  return texto.length <= max ? texto : `${texto.slice(0, max - 1).trimEnd()}…`;
}

function objetoCurto(objeto: string): string {
  return cortar(resumirObjeto(objeto), MAX_OBJETO);
}

function rotuloDaEtapa(etapa: string): string {
  return ehEtapa(etapa) ? ROTULO_ETAPA[etapa] : etapa;
}

function ativas(pessoas: ReadonlyArray<PessoaWa>): string[] {
  return pessoas.filter((p) => p.ativa).map((p) => p.id);
}

/** Item em jogo que fecha em até 48 h. Vai ao responsável (se ativo); sem responsável, a todas as pessoas ativas. */
export function alertasDePrazo(itens: ReadonlyArray<ItemAlerta>, pessoas: ReadonlyArray<PessoaWa>, agora: Date): AlertaWa[] {
  const ativos = ativas(pessoas);
  const alertas: AlertaWa[] = [];
  for (const item of itens) {
    if (ETAPAS_ENCERRADAS.includes(item.etapa)) continue;
    const encerramento = new Date(item.dataEncerramento);
    const faixa = faixaDoPrazo(encerramento, agora);
    if (faixa === null) continue;
    const destinos = item.responsavelId === null ? ativos : ativos.filter((id) => id === item.responsavelId);
    const texto = `⏰ Prazo em ${textoRestante(encerramento.getTime() - agora.getTime())}\n${objetoCurto(item.objeto)}`;
    for (const usuarioId of destinos) {
      alertas.push({ usuarioId, tipo: faixa, chave: `${faixa}:${item.id}`, texto, itemId: item.id, validade: encerramento });
    }
  }
  return alertas;
}

/** Oportunidade com nota alta, ainda aberta e fora do pipeline: todas as pessoas ativas. */
export function alertasDeRadar(
  oportunidades: ReadonlyArray<OportunidadeAlta>,
  pessoas: ReadonlyArray<PessoaWa>,
  jaNoPipeline: ReadonlySet<string>,
  agora: Date,
): AlertaWa[] {
  const ativos = ativas(pessoas);
  const vistos = new Set<string>();
  const alertas: AlertaWa[] = [];
  for (const o of oportunidades) {
    if (vistos.has(o.id) || jaNoPipeline.has(o.id)) continue;
    vistos.add(o.id);
    const encerramento = new Date(o.dataEncerramento);
    if (o.nota < NOTA_ALTA || Number.isNaN(encerramento.getTime()) || encerramento.getTime() <= agora.getTime()) continue;
    const texto = `🆕 Licitação nova, nota ${Math.round(o.nota)}\n${objetoCurto(o.objeto)}\n${o.link}`;
    for (const usuarioId of ativos) {
      alertas.push({ usuarioId, tipo: "radar", chave: `radar:${o.id}`, texto, itemId: null, validade: encerramento });
    }
  }
  return alertas;
}

/** Item em jogo sem responsável: lembrete para todas as pessoas ativas, no máximo um por dia. */
export function alertasSemResponsavel(itens: ReadonlyArray<ItemAlerta>, pessoas: ReadonlyArray<PessoaWa>, agora: Date): AlertaWa[] {
  const ativos = ativas(pessoas);
  const dia = diaDeSaoPaulo(agora);
  const alertas: AlertaWa[] = [];
  for (const item of itens) {
    if (ETAPAS_ENCERRADAS.includes(item.etapa) || item.responsavelId !== null) continue;
    const texto = `👤 Sem responsável\n${objetoCurto(item.objeto)}`;
    for (const usuarioId of ativos) {
      alertas.push({ usuarioId, tipo: "sem_responsavel", chave: `semresp:${item.id}:${dia}`, texto, itemId: item.id, validade: null });
    }
  }
  return alertas;
}

/** Mudança de etapa: avisa o responsável e os donos, menos quem moveu, só pessoas ativas. */
export function alertasDeEtapa(
  mudancas: ReadonlyArray<MudancaEtapa>,
  pessoas: ReadonlyArray<PessoaWa>,
  donoIds: ReadonlySet<string>,
): AlertaWa[] {
  const ativos = new Set(ativas(pessoas));
  const alertas: AlertaWa[] = [];
  for (const m of mudancas) {
    const destinos = new Set<string>(donoIds);
    if (m.responsavelId !== null) destinos.add(m.responsavelId);
    const de = m.de === null ? "Novo" : rotuloDaEtapa(m.de);
    const texto = `🔄 ${objetoCurto(m.objeto)}\n${de} → ${rotuloDaEtapa(m.para)}`;
    for (const usuarioId of destinos) {
      if (usuarioId === m.porId || !ativos.has(usuarioId)) continue;
      alertas.push({ usuarioId, tipo: "etapa", chave: `etapa:${m.historicoId}`, texto, itemId: m.itemId, validade: null });
    }
  }
  return alertas;
}

/* ---------- resumos ---------- */

type Grupo = "prazo" | "radar" | "sem_responsavel" | "etapa" | "aviso";

const GRUPOS: ReadonlyArray<{ grupo: Grupo; singular: string; plural: string }> = [
  { grupo: "prazo", singular: "prazo", plural: "prazos" },
  { grupo: "radar", singular: "licitação nova", plural: "licitações novas" },
  { grupo: "sem_responsavel", singular: "item sem responsável", plural: "itens sem responsável" },
  { grupo: "etapa", singular: "mudança de etapa", plural: "mudanças de etapa" },
  { grupo: "aviso", singular: "aviso", plural: "avisos" },
];

function grupoDoTipo(tipo: TipoAlertaWa): Grupo {
  return tipo === "prazo48" || tipo === "prazo24" || tipo === "prazo2" ? "prazo" : tipo;
}

/** Resumo da fila de quem voltou a falar: contagem por tipo, até 8 textos e "+N". Vazio se não há nada. */
export function textoDoResumo(alertas: ReadonlyArray<{ tipo: TipoAlertaWa; texto: string }>): string {
  if (alertas.length === 0) return "";
  const contagens = GRUPOS.map((g) => {
    const total = alertas.filter((a) => grupoDoTipo(a.tipo) === g.grupo).length;
    return total === 0 ? null : `${total} ${total === 1 ? g.singular : g.plural}`;
  }).filter((c): c is string => c !== null);
  const lista = alertas.slice(0, MAX_LISTA_RESUMO).map((a) => a.texto);
  const resto = alertas.length - lista.length;
  return [
    `Enquanto você estava fora: ${contagens.join(", ")}.`,
    lista.join("\n\n"),
    ...(resto > 0 ? [`+${resto}`] : []),
    "Responda *prazos* ou *pipeline* para ver mais.",
  ].join("\n\n");
}

/** Resumo das 7h: itens em jogo, os que fecham em 48 h (até 5) e os sem responsável. Vazio se não há item em jogo. */
export function textoResumoManha(itens: ReadonlyArray<ItemAlerta>, agora: Date): string {
  const emJogo = itens.filter((i) => !ETAPAS_ENCERRADAS.includes(i.etapa));
  if (emJogo.length === 0) return "";
  const fechando = emJogo
    .map((i) => ({ item: i, encerramento: new Date(i.dataEncerramento) }))
    .filter((x) => faixaDoPrazo(x.encerramento, agora) !== null)
    .sort((a, b) => a.encerramento.getTime() - b.encerramento.getTime());
  const semResponsavel = emJogo.filter((i) => i.responsavelId === null).length;
  const linhas = [`☀️ Bom dia! ${emJogo.length} ${emJogo.length === 1 ? "item em jogo" : "itens em jogo"}.`];
  if (fechando.length > 0) {
    linhas.push(`Fecham em 48 h: ${fechando.length}`);
    for (const x of fechando.slice(0, MAX_LISTA_MANHA)) {
      linhas.push(`• ${objetoCurto(x.item.objeto)} (${textoRestante(x.encerramento.getTime() - agora.getTime())})`);
    }
    if (fechando.length > MAX_LISTA_MANHA) linhas.push(`+${fechando.length - MAX_LISTA_MANHA}`);
  }
  if (semResponsavel > 0) linhas.push(`Sem responsável: ${semResponsavel}`);
  return linhas.join("\n");
}

/* ---------- comandos ---------- */

export type Comando =
  | { tipo: "ativar"; codigo: string }
  | { tipo: "pipeline" }
  | { tipo: "prazos" }
  | { tipo: "parar" }
  | { tipo: "voltar" }
  | { tipo: "sim" }
  | { tipo: "nao" }
  | { tipo: "livre"; texto: string };

function simplificar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[.!?,;:]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lê o que a pessoa escreveu, sem diferenciar acento, caixa e espaço extra. */
export function lerComando(texto: string): Comando {
  const limpo = simplificar(texto);
  const ativar = /^ativar\s+([a-z0-9]{6})$/.exec(limpo);
  if (ativar?.[1]) return { tipo: "ativar", codigo: ativar[1].toUpperCase() };
  switch (limpo) {
    case "pipeline":
      return { tipo: "pipeline" };
    case "prazos":
    case "prazo":
      return { tipo: "prazos" };
    case "parar":
    case "sair":
    case "stop":
      return { tipo: "parar" };
    case "voltar":
    case "receber alertas":
    case "continuar recebendo":
      return { tipo: "voltar" };
    case "sim":
    case "confirmo":
    case "s":
      return { tipo: "sim" };
    case "nao":
    case "n":
    case "cancelar":
      return { tipo: "nao" };
    default:
      return { tipo: "livre", texto: texto.trim() };
  }
}

/* ---------- botões ---------- */

export type AcaoBotao =
  | { tipo: "participar" | "atribuir" | "descartar"; itemId: string }
  | { tipo: "confirmar" }
  | { tipo: "cancelar" }
  | { tipo: "continuar" };

const PREFIXO_BOTAO: Readonly<Record<"participar" | "atribuir" | "descartar", string>> = {
  participar: "part",
  atribuir: "atr",
  descartar: "desc",
};

/** Texto que volta no webhook quando a pessoa toca o botão (máx. 256 caracteres). */
export function payloadDoBotao(acao: AcaoBotao): string {
  switch (acao.tipo) {
    case "participar":
    case "atribuir":
    case "descartar":
      return `${PREFIXO_BOTAO[acao.tipo]}:${acao.itemId}`;
    case "confirmar":
      return "sim";
    case "cancelar":
      return "nao";
    case "continuar":
      return "continuar";
  }
}

export function lerPayload(payload: string): AcaoBotao | null {
  if (payload === "sim") return { tipo: "confirmar" };
  if (payload === "nao") return { tipo: "cancelar" };
  if (payload === "continuar") return { tipo: "continuar" };
  const corte = payload.indexOf(":");
  if (corte < 0) return null;
  const prefixo = payload.slice(0, corte);
  const itemId = payload.slice(corte + 1);
  if (itemId === "") return null;
  if (prefixo === "part") return { tipo: "participar", itemId };
  if (prefixo === "atr") return { tipo: "atribuir", itemId };
  if (prefixo === "desc") return { tipo: "descartar", itemId };
  return null;
}

/** Botões do alerta (título de até 20 caracteres). Só alertas ligados a um item têm botões. */
export function botoesDoAlerta(tipo: TipoAlertaWa, itemId: string | null): Array<{ titulo: string; payload: string }> {
  if (itemId === null) return [];
  if (tipo === "radar" || tipo === "aviso") return [];
  return [
    { titulo: "Vou participar", payload: payloadDoBotao({ tipo: "participar", itemId }) },
    { titulo: "Atribuir a mim", payload: payloadDoBotao({ tipo: "atribuir", itemId }) },
    { titulo: "Descartar", payload: payloadDoBotao({ tipo: "descartar", itemId }) },
  ];
}

/* ---------- ativação ---------- */

const ALFABETO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TAMANHO_CODIGO = 6;

/** Código de 6 caracteres sem letras e números parecidos (0/O, 1/I). `aleatorio` devolve [0, 1). */
export function gerarCodigoAtivacao(aleatorio: () => number): string {
  let codigo = "";
  for (let i = 0; i < TAMANHO_CODIGO; i += 1) {
    const indice = Math.min(ALFABETO_CODIGO.length - 1, Math.floor(aleatorio() * ALFABETO_CODIGO.length));
    codigo += ALFABETO_CODIGO.charAt(indice);
  }
  return codigo;
}

/** Link que abre o WhatsApp da empresa já com "ATIVAR <código>" escrito. `numeroEmpresa` só com dígitos. */
export function linkAtivacao(numeroEmpresa: string, codigo: string): string {
  return `https://wa.me/${numeroEmpresa}?text=${encodeURIComponent(`ATIVAR ${codigo}`)}`;
}

/* ---------- webhook ---------- */

export interface MensagemRecebida {
  eventoId: string;
  contaId: string | null;
  conversationId: string;
  /** Só dígitos */
  remetente: string;
  nome: string;
  texto: string;
  payloadBotao: string | null;
}

const Registro = z.record(z.string(), z.unknown());
type Registro = z.infer<typeof Registro>;

function sub(origem: Registro | null, chave: string): Registro | null {
  if (origem === null) return null;
  const lido = Registro.safeParse(origem[chave]);
  return lido.success ? lido.data : null;
}

function campo(origem: Registro | null, chave: string): string | null {
  if (origem === null) return null;
  const valor = origem[chave];
  if (typeof valor === "string") return valor.trim() === "" ? null : valor;
  if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  return null;
}

function primeiro(...valores: Array<string | null>): string | null {
  for (const v of valores) if (v !== null) return v;
  return null;
}

function soDigitos(valor: string | null): string | null {
  if (valor === null) return null;
  const digitos = valor.replace(/\D/g, "");
  return digitos === "" ? null : digitos;
}

/**
 * Lê o corpo do webhook do Zernio. Só devolve mensagem recebida (`message.received`, direção de entrada
 * ou ausente). Tolerante: campo que não vem ou vem em outro formato não derruba a leitura, só deixa de valer.
 */
export function lerEventoRecebido(corpo: unknown, eventoIdCabecalho: string | null): MensagemRecebida | null {
  const raiz = Registro.safeParse(corpo);
  if (!raiz.success) return null;
  const r = raiz.data;
  if (r.event !== "message.received") return null;
  const mensagem = sub(r, "message");
  if (mensagem === null) return null;
  const direcao = campo(mensagem, "direction");
  if (direcao !== null && direcao !== "incoming") return null;

  const conta = sub(r, "account");
  const conversa = sub(r, "conversation");
  const remetenteObj = sub(mensagem, "sender");
  const metadata = sub(mensagem, "metadata");

  const eventoId = primeiro(campo(r, "id"), eventoIdCabecalho === null || eventoIdCabecalho.trim() === "" ? null : eventoIdCabecalho, campo(mensagem, "id"));
  const conversationId = primeiro(campo(mensagem, "conversationId"), campo(conversa, "id"));
  const remetente = soDigitos(primeiro(campo(remetenteObj, "id"), campo(remetenteObj, "phoneNumber"), campo(remetenteObj, "username")));
  if (eventoId === null || conversationId === null || remetente === null) return null;

  const payloadBotao = primeiro(
    campo(metadata, "buttonPayload"),
    campo(sub(metadata, "button"), "payload"),
    campo(sub(sub(metadata, "interactive"), "button_reply"), "id"),
    campo(sub(metadata, "buttonReply"), "id"),
    campo(metadata, "payload"),
    campo(mensagem, "payload"),
    campo(sub(mensagem, "postback"), "payload"),
    campo(sub(mensagem, "quickReply"), "payload"),
  );

  return {
    eventoId,
    contaId: primeiro(campo(conta, "accountId"), campo(conta, "id")),
    conversationId,
    remetente,
    nome: primeiro(campo(remetenteObj, "name"), campo(remetenteObj, "displayName")) ?? "",
    texto: primeiro(campo(mensagem, "text"), campo(mensagem, "content"), campo(mensagem, "body")) ?? "",
    payloadBotao,
  };
}
