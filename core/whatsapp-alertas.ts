/**
 * Regras dos alertas de WhatsApp pelo Zernio (funções puras, sem banco nem rede; o relógio entra por parâmetro).
 * Janela de 24 h, horário permitido, perfil de alerta, prazos urgentes, resumo da manhã, comandos, botões e leitura do webhook.
 */
import { lerNumeroEscolhido } from "./whatsapp-propostas-lista";
import { diaDeSaoPaulo, textoRestante } from "@/core/avisos";
import { inicioDaSemana, type MetaConfig } from "@/core/meta";
import { BASE_PADRAO_APP } from "@/core/app-base";
import { caminhoInterno, lerLinksPncp } from "@/core/link-pncp";
import { chaveDeNumeroControle } from "@/core/proposta";
import { resumirObjeto } from "@/core/objeto";
import { ROTULO_ETAPA, ehEtapa } from "@/components/pipeline/tipos";
import { z } from "zod";

const MS_HORA = 3_600_000;
export const JANELA_MS = 24 * MS_HORA;
export const MARGEM_JANELA_MS = 30 * 60_000;
export const HORA_INICIO = 7;
export const HORA_FIM = 20;
/** Corte das linhas de aviso (pendências), que não são títulos de licitação. */
const MAX_OBJETO = 120;
/** Teto de segurança do título de uma licitação: só um objeto absurdo passa disso. */
const MAX_TITULO = 400;
const MAX_TEXTO_WA = 4000;
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

/* ---------- perfil de alerta ---------- */

/** Operacional: quem toca o dia a dia (prazos, pendências). Acompanhamento: quem só quer saber como vai. */
export const PERFIS_ALERTA = ["operacional", "acompanhamento"] as const;
export type PerfilAlerta = (typeof PERFIS_ALERTA)[number];

export interface EscolhasAlerta {
  perfil: PerfilAlerta;
  /** Prazo urgente (2 h e 24 h) dos itens do Pipeline, na hora */
  prazos: boolean;
  /** Resumo: licitações novas do ramo */
  novas: boolean;
  /** Resumo: itens que fecham em 48 h */
  fechando: boolean;
  /** Resumo: itens em disputa já encerrados, esperando o resultado */
  aguardando: boolean;
  /** Resumo: avisos para a pessoa (item atribuído, revisão de proposta...) */
  pendencias: boolean;
  /** Resumo: o que a equipe movimentou no Pipeline */
  movimentos: boolean;
  /** Resumo: itens que entraram em disputa */
  disputa: boolean;
  /** Resumo: licitações novas acima de `valorGrande` */
  grandes: boolean;
  /** Resumo: placar da meta da semana */
  meta: boolean;
  /** Em reais */
  valorGrande: number;
}

export const VALOR_GRANDE_PADRAO = 100_000;
export const VALOR_GRANDE_MAXIMO = 100_000_000;
export { inicioDaSemana };

/** Escolhas de cada perfil: o operacional recebe o dia a dia; o acompanhamento, só o placar. */
export function escolhasDoPerfil(perfil: PerfilAlerta, valorGrande: number = VALOR_GRANDE_PADRAO): EscolhasAlerta {
  const operacional = perfil === "operacional";
  return {
    perfil,
    prazos: operacional,
    novas: operacional,
    fechando: operacional,
    aguardando: operacional,
    pendencias: operacional,
    movimentos: !operacional,
    disputa: !operacional,
    grandes: !operacional,
    meta: true,
    valorGrande,
  };
}

/** Sem escolha gravada: o dono acompanha, gestor e jurídico operam. */
export function perfilPadrao(papel: string): PerfilAlerta {
  return papel === "dono" ? "acompanhamento" : "operacional";
}

const EscolhasGravadas = z
  .object({
    perfil: z.enum(PERFIS_ALERTA),
    prazos: z.boolean(),
    novas: z.boolean(),
    fechando: z.boolean(),
    aguardando: z.boolean(),
    pendencias: z.boolean(),
    movimentos: z.boolean(),
    disputa: z.boolean(),
    grandes: z.boolean(),
    meta: z.boolean(),
    valorGrande: z.number().finite().min(0).max(VALOR_GRANDE_MAXIMO),
  })
  .partial();

/** Lê o que está gravado; campo que falta ou veio errado usa o padrão do perfil (ou do papel). */
export function lerEscolhas(gravado: unknown, papel: string): EscolhasAlerta {
  const lido = EscolhasGravadas.safeParse(gravado);
  const parcial = lido.success ? lido.data : {};
  const base = escolhasDoPerfil(parcial.perfil ?? perfilPadrao(papel), parcial.valorGrande ?? VALOR_GRANDE_PADRAO);
  return { ...base, ...parcial, perfil: base.perfil, valorGrande: base.valorGrande };
}

/** O alerta entra na fila desta pessoa? Prazo urgente e aviso dependem da escolha; o resto não vai mais avulso. */
export function aceitaAlerta(escolhas: EscolhasAlerta, tipo: TipoAlertaWa): boolean {
  if (tipo === "prazo2" || tipo === "prazo24") return escolhas.prazos;
  if (tipo === "aviso") return escolhas.pendencias;
  return false;
}

/* ---------- alertas ---------- */

export const TIPOS_ALERTA_WA = ["prazo48", "prazo24", "prazo2", "radar", "sem_responsavel", "etapa", "aviso"] as const;
export type TipoAlertaWa = (typeof TIPOS_ALERTA_WA)[number];
/** Tipos que não saem mais avulsos; pendentes antigos destes tipos são descartados. */
export const TIPOS_AVULSOS_ANTIGOS: ReadonlyArray<TipoAlertaWa> = ["prazo48", "radar", "sem_responsavel", "etapa"];

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
  /** Valor estimado em reais (null ou ausente: sigiloso) */
  valor?: number | null;
}

export interface PessoaWa {
  id: string;
  /** aviso_whatsapp ligado e conversa vinculada */
  ativa: boolean;
  /** Quer o prazo urgente na hora */
  prazos: boolean;
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

/** Título da licitação inteiro (sem "…"), com o teto de segurança. */
function objetoCurto(objeto: string): string {
  return cortar(resumirObjeto(objeto), MAX_TITULO);
}

/** Link da página da licitação no sistema; id que não é número de controle do PNCP fica sem link. */
export function linkDaLicitacao(id: string): string | null {
  const chave = chaveDeNumeroControle(id);
  return chave === null ? null : `${BASE_PADRAO_APP}${caminhoInterno(chave)}`;
}

/** Linha do link logo abaixo do título (começa em quebra de linha); vazia sem link. */
function linhaDoLink(id: string): string {
  const link = linkDaLicitacao(id);
  return link === null ? "" : `\n${link}`;
}

/** Corta nos limites de linha (nunca no meio de um título ou link) quando o texto passa de `max`. */
function cortarEmLinhas(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  const dentro = texto.slice(0, max);
  const fim = dentro.lastIndexOf("\n");
  return (fim > 0 ? dentro.slice(0, fim) : dentro).trimEnd();
}

function rotuloDaEtapa(etapa: string): string {
  return ehEtapa(etapa) ? ROTULO_ETAPA[etapa] : etapa;
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? "";
}

/**
 * Item em jogo que fecha em até 24 h (faixas de 24 h e 2 h). Vai ao responsável, se ele quer prazos;
 * sem responsável (ou com um que não quer prazos), a todas as pessoas ativas que querem.
 * `empresa`: nome curto, só para itens de uma empresa que não é a da pessoa (gestor de várias empresas).
 */
export function alertasDePrazo(
  itens: ReadonlyArray<ItemAlerta>,
  pessoas: ReadonlyArray<PessoaWa>,
  agora: Date,
  empresa?: string,
): AlertaWa[] {
  const querem = pessoas.filter((p) => p.ativa && p.prazos).map((p) => p.id);
  const alertas: AlertaWa[] = [];
  for (const item of itens) {
    if (ETAPAS_ENCERRADAS.includes(item.etapa)) continue;
    const encerramento = new Date(item.dataEncerramento);
    const faixa = faixaDoPrazo(encerramento, agora);
    if (faixa !== "prazo2" && faixa !== "prazo24") continue;
    const responsavel = item.responsavelId === null ? null : querem.find((id) => id === item.responsavelId);
    const destinos = responsavel ? [responsavel] : querem;
    const onde = empresa === undefined ? "" : ` (${empresa})`;
    const texto = `⏰ Prazo em ${textoRestante(encerramento.getTime() - agora.getTime())}${onde}\n${objetoCurto(item.objeto)}${linhaDoLink(item.id)}`;
    for (const usuarioId of destinos) {
      alertas.push({ usuarioId, tipo: faixa, chave: `${faixa}:${item.id}`, texto, itemId: item.id, validade: encerramento });
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

/** Vários alertas numa mensagem só: contagem por tipo, até 8 textos e "+N". Vazio se não há nada. */
export function textoDoResumo(alertas: ReadonlyArray<{ tipo: TipoAlertaWa; texto: string }>): string {
  if (alertas.length === 0) return "";
  const contagens = GRUPOS.map((g) => {
    const total = alertas.filter((a) => grupoDoTipo(a.tipo) === g.grupo).length;
    return total === 0 ? null : `${total} ${total === 1 ? g.singular : g.plural}`;
  }).filter((c): c is string => c !== null);
  const montar = (limite: number): string => {
    const lista = alertas.slice(0, limite).map((a) => a.texto);
    const resto = alertas.length - lista.length;
    return [
      `Urgente: ${contagens.join(", ")}.`,
      lista.join("\n\n"),
      ...(resto > 0 ? [`+${resto}`] : []),
      "Responda *prazos* ou *pipeline* para ver mais.",
    ].join("\n\n");
  };
  // Passou de 4000: tira itens da lista em vez de cortar no meio de um título ou link.
  let limite = Math.min(MAX_LISTA_RESUMO, alertas.length);
  let texto = montar(limite);
  while (texto.length > MAX_TEXTO_WA && limite > 1) {
    limite -= 1;
    texto = montar(limite);
  }
  return cortarEmLinhas(texto, MAX_TEXTO_WA);
}

/** Licitação nova do ramo, com o que o resumo mostra. */
export interface NovaDoRamo {
  id: string;
  objeto: string;
  /** null: sigiloso ou não informado */
  valor: number | null;
  municipio: string;
  uf: string;
  modalidade: string;
  /** ISO 8601 */
  dataEncerramento: string;
  /** O que casou com o ramo, ex.: "Equipamentos e suprimentos de informática: toner" */
  bateu: string | null;
}

/** Movimento no Pipeline, com o nome de quem moveu. */
export interface MovimentoEquipe {
  itemId: string;
  objeto: string;
  de: string | null;
  para: string;
  porId: string | null;
  porNome: string | null;
}

/** Item que ganha uma proposta hoje: aparece numerado no resumo e vira botão "Gerar N". */
export interface PropostaDoDia {
  itemId: string;
  objeto: string;
  valor: number | null;
  /** ISO 8601 */
  dataEncerramento: string;
}

/** Etapas em que ainda falta a proposta. */
export const ETAPAS_DA_PROPOSTA: ReadonlyArray<string> = ["radar", "analisando", "cotando", "revisao_juridica", "proposta"];
export const MAX_PROPOSTAS_DO_DIA = 3;

/**
 * Itens que pedem proposta hoje: etapas anteriores à disputa, sem proposta aprovada, pronta ou enviada
 * (`comProposta`: ids dos itens que já têm), que fecham hoje ou amanhã (dia de São Paulo) e ainda não fecharam.
 * O mais próximo de fechar vem primeiro; no máximo `limite` (padrão 3).
 */
export function escolherPropostasDoDia(
  itens: ReadonlyArray<ItemAlerta>,
  comProposta: ReadonlySet<string>,
  agora: Date,
  limite: number = MAX_PROPOSTAS_DO_DIA,
): PropostaDoDia[] {
  const hoje = diaDeSaoPaulo(agora);
  const amanha = diaDeSaoPaulo(new Date(agora.getTime() + 24 * MS_HORA));
  return itens
    .map((i) => ({ item: i, fim: new Date(i.dataEncerramento).getTime() }))
    .filter((x) => {
      if (!ETAPAS_DA_PROPOSTA.includes(x.item.etapa) || comProposta.has(x.item.id)) return false;
      if (Number.isNaN(x.fim) || x.fim <= agora.getTime()) return false;
      const dia = diaDeSaoPaulo(new Date(x.fim));
      return dia === hoje || dia === amanha;
    })
    .sort((a, b) => a.fim - b.fim || a.item.id.localeCompare(b.item.id))
    .slice(0, limite)
    .map((x) => ({ itemId: x.item.id, objeto: x.item.objeto, valor: x.item.valor ?? null, dataEncerramento: x.item.dataEncerramento }));
}

/** Onde o resumo guarda as propostas do dia: "gerar N" usa a mesma lista, mesmo depois que algum item fecha. */
export function chavePropostasDoDia(usuarioId: string, dia: string): string {
  return `propdia:${usuarioId}:${dia}`;
}

/** Movimento de proposta (gerada, aprovada, enviada ou devolvida). */
export interface MovimentoProposta {
  propostaId: string;
  objeto: string;
  acao: "gerou" | "aprovou" | "enviou" | "devolveu";
  porId: string | null;
  porNome: string | null;
  /** Em reais */
  total: number;
}

export interface DadosResumoManha {
  usuarioId: string;
  nome: string;
  escolhas: EscolhasAlerta;
  /** Propostas para fazer hoje, numeradas na ordem (só o gestor recebe) */
  propostasHoje: ReadonlyArray<PropostaDoDia>;
  /** Propostas geradas, aprovadas ou enviadas nas últimas 24 h */
  propostasMovidas: ReadonlyArray<MovimentoProposta>;
  /** Novas do ramo que esta pessoa ainda não viu, da mais indicada para a menos */
  novas: ReadonlyArray<NovaDoRamo>;
  itens: ReadonlyArray<ItemAlerta>;
  /** Movimentos das últimas 24 h */
  movimentos: ReadonlyArray<MovimentoEquipe>;
  /** Avisos que esperam esta pessoa */
  pendencias: ReadonlyArray<string>;
  /** Itens distintos que chegaram em disputa desde segunda-feira */
  disputasNaSemana: number;
  /** Itens que chegaram em "ganha" desde segunda-feira, com o valor somado */
  vencidasNaSemana: VencidasDaSemana;
  /** Meta da semana da empresa */
  meta: MetaConfig;
}

export interface ResumoManha {
  /** Vazio: nada a dizer */
  texto: string;
  /** Novas que apareceram no texto (não voltam no próximo resumo) */
  novasMostradas: string[];
}

const formatoReais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function reais(valor: number): string {
  return formatoReais.format(valor).replace(/ /g, " ");
}

/** "100 mil", "1,5 milhão" */
function reaisCurto(valor: number): string {
  if (valor >= 1_000_000) {
    const milhoes = (valor / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    return `R$ ${milhoes} ${valor >= 2_000_000 ? "milhões" : "milhão"}`;
  }
  if (valor >= 1_000) return `R$ ${(valor / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return reais(valor);
}

const formatoQuando = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "20/11 às 14h" ou "20/11 às 14h30", em São Paulo. */
export function quandoFecha(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "sem data";
  const partes = formatoQuando.formatToParts(data);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value ?? "";
  const minuto = parte("minute");
  return `${parte("day")}/${parte("month")} às ${parte("hour")}h${minuto === "00" ? "" : minuto}`;
}

function linhaDaNova(n: NovaDoRamo, posicao: number): string {
  const onde = [n.municipio, n.uf].filter((p) => p !== "").join("/");
  const detalhes = [n.valor === null ? "Valor sigiloso" : reais(n.valor), onde, cortar(n.modalidade, 30)].filter((p) => p !== "");
  const fecha = `Fecha ${quandoFecha(n.dataEncerramento)}${n.bateu ? ` · Bateu: ${n.bateu}` : ""}`;
  return `${posicao}. *${objetoCurto(n.objeto)}*${linhaDoLink(n.id)}\n${detalhes.join(" · ")}\n${fecha}`;
}

function linhaDoMovimento(m: MovimentoEquipe): string {
  const quem = m.porNome ? `${primeiroNome(m.porNome)}: ` : "";
  const trecho = m.de !== null && m.de !== m.para ? `${rotuloDaEtapa(m.de)} → ${rotuloDaEtapa(m.para)}` : rotuloDaEtapa(m.para);
  return `• ${quem}${objetoCurto(m.objeto)} (${trecho})${linhaDoLink(m.itemId)}`;
}

function linhaDaPropostaMovida(m: MovimentoProposta): string {
  const quem = m.porNome ? primeiroNome(m.porNome) : "Alguém";
  const valor = m.total > 0 ? ` (${reais(m.total)})` : "";
  return `• ${quem} ${m.acao} a proposta de ${objetoCurto(m.objeto)}${valor}`;
}

/** "14h" ou "9h30": só a hora de uma data ISO, em São Paulo. */
function horaDeFechar(iso: string): string {
  return quandoFecha(iso).split(" às ")[1] ?? "";
}

/** "hoje às 14h" ou "amanhã às 9h30", em São Paulo. */
function quandoFechaRelativo(iso: string, agora: Date): string {
  const dia = diaDeSaoPaulo(new Date(iso));
  const onde = dia === diaDeSaoPaulo(agora) ? "hoje" : "amanhã";
  return `${onde} às ${horaDeFechar(iso)}`;
}

function linhaDaPropostaDoDia(p: PropostaDoDia, posicao: number, agora: Date): string {
  const valor = p.valor === null ? "Valor sigiloso" : reais(p.valor);
  return `${posicao}. *${objetoCurto(p.objeto)}*${linhaDoLink(p.itemId)}\n${valor} · fecha ${quandoFechaRelativo(p.dataEncerramento, agora)}`;
}

function comResto(linhas: string[], total: number): string[] {
  return total > linhas.length ? [...linhas, `+${total - linhas.length}`] : linhas;
}

/** Item que ainda não chegou à disputa e fecha primeiro: o que priorizar para a meta. */
export function itemParaPriorizar(itens: ReadonlyArray<ItemAlerta>, agora: Date): ItemAlerta | null {
  let melhor: { item: ItemAlerta; fim: number } | null = null;
  for (const item of itens) {
    if (!ETAPAS_DA_PROPOSTA.includes(item.etapa)) continue;
    const fim = new Date(item.dataEncerramento).getTime();
    if (Number.isNaN(fim) || fim <= agora.getTime()) continue;
    if (melhor === null || fim < melhor.fim) melhor = { item, fim };
  }
  return melhor === null ? null : melhor.item;
}

/** Licitações vencidas na semana (entraram em "ganha") e a soma dos valores; `estimado` quando algum valor não vem de proposta. */
export interface VencidasDaSemana {
  vencidas: number;
  valor: number;
  estimado: boolean;
}

/** " · 2 vencidas (R$ 12.500)"; vazio sem vencidas. */
function textoDasVencidas(v: VencidasDaSemana | null): string {
  if (v === null || v.vencidas <= 0) return "";
  const rotulo = `${v.vencidas} ${v.vencidas === 1 ? "vencida" : "vencidas"}`;
  return v.valor > 0 ? ` · ${rotulo} (${v.estimado ? "~" : ""}${reais(v.valor)})` : ` · ${rotulo}`;
}

/**
 * "Meta: 2/5 disputas · faltam 3 até domingo". Com o mínimo batido o alvo passa a ser o ideal.
 * `priorizar`: o que fecha primeiro, só quando ainda falta para o mínimo.
 */
export function textoDaMeta(
  feitas: number,
  meta: MetaConfig,
  priorizar: { objeto: string; restanteMs: number; id?: string } | null = null,
  vencidas: VencidasDaSemana | null = null,
): string {
  const ganhas = textoDasVencidas(vencidas);
  if (feitas >= meta.ideal) return `🎯 Meta: ${feitas}/${meta.ideal} disputas · ideal batido!${ganhas}`;
  if (feitas >= meta.minimo) {
    const faltam = meta.ideal - feitas;
    return `🎯 Meta: ${feitas}/${meta.ideal} disputas · mínimo batido, ${faltam === 1 ? "falta 1" : `faltam ${faltam}`} até domingo para o ideal${ganhas}`;
  }
  const faltam = meta.minimo - feitas;
  const placar = `🎯 Meta: ${feitas}/${meta.minimo} disputas · ${faltam === 1 ? "falta 1" : `faltam ${faltam}`} até domingo${ganhas}`;
  if (priorizar === null) return placar;
  const link = priorizar.id === undefined ? "" : linhaDoLink(priorizar.id);
  return `${placar}\nPriorize: ${objetoCurto(priorizar.objeto)} (fecha em ${textoRestante(priorizar.restanteMs)})${link}`;
}

/** As partes do resumo (cada uma é um trecho com título e lista) e as novas que apareceram nelas. */
export interface PartesResumo {
  partes: string[];
  novasMostradas: string[];
}

/**
 * Cada parte só entra se tiver o que dizer; a meta entra sempre que escolhida.
 * `reducao`: quantos itens tirar de cada lista (mínimo 1 por lista), para a mensagem caber sem cortar título ou link.
 */
export function partesDoResumoManha(d: DadosResumoManha, agora: Date, reducao: number = 0): PartesResumo {
  const e = d.escolhas;
  const maxResumo = Math.max(1, MAX_LISTA_RESUMO - reducao);
  const maxManha = Math.max(1, MAX_LISTA_MANHA - reducao);
  const partes: string[] = [];
  const mostradas = new Set<string>();

  if (e.pendencias && d.propostasHoje.length > 0) {
    const linhas = d.propostasHoje.map((p, i) => linhaDaPropostaDoDia(p, i + 1, agora));
    const instrucao = "Responda *gerar 1* (ou toque no botão) que eu monto o rascunho.";
    const titulo = `📝 Propostas para hoje: ${d.propostasHoje.length}`;
    partes.push([titulo, ...linhas, instrucao].join("\n\n"));
  }

  if (e.novas && d.novas.length > 0) {
    const lista = d.novas.slice(0, maxResumo);
    for (const n of lista) mostradas.add(n.id);
    const titulo = `🆕 ${d.novas.length} ${d.novas.length === 1 ? "nova do seu ramo" : "novas do seu ramo"}`;
    partes.push([titulo, ...comResto(lista.map((n, i) => linhaDaNova(n, i + 1)), d.novas.length)].join("\n\n"));
  }

  if (e.grandes) {
    const grandes = d.novas.filter((n) => n.valor !== null && n.valor >= e.valorGrande);
    if (grandes.length > 0) {
      const lista = grandes.slice(0, maxManha);
      for (const n of lista) mostradas.add(n.id);
      const titulo = `💰 Acima de ${reaisCurto(e.valorGrande)}: ${grandes.length}`;
      partes.push([titulo, ...comResto(lista.map((n, i) => linhaDaNova(n, i + 1)), grandes.length)].join("\n\n"));
    }
  }

  const emJogo = d.itens.filter((i) => !ETAPAS_ENCERRADAS.includes(i.etapa));

  if (e.fechando) {
    const fechando = emJogo
      .map((i) => ({ item: i, encerramento: new Date(i.dataEncerramento) }))
      .filter((x) => faixaDoPrazo(x.encerramento, agora) !== null)
      .sort((a, b) => a.encerramento.getTime() - b.encerramento.getTime());
    if (fechando.length > 0) {
      const linhas = fechando
        .slice(0, maxManha)
        .map((x) => `• ${objetoCurto(x.item.objeto)} (em ${textoRestante(x.encerramento.getTime() - agora.getTime())})${linhaDoLink(x.item.id)}`);
      partes.push([`⏰ Fecham em 48 h: ${fechando.length}`, ...comResto(linhas, fechando.length)].join("\n"));
    }
  }

  if (e.aguardando) {
    const aguardando = emJogo.filter((i) => {
      const fim = new Date(i.dataEncerramento).getTime();
      return i.etapa === "disputa" && !Number.isNaN(fim) && fim <= agora.getTime();
    });
    if (aguardando.length > 0) {
      const linhas = aguardando.slice(0, maxManha).map((i) => `• ${objetoCurto(i.objeto)}${linhaDoLink(i.id)}`);
      partes.push([`⌛ Aguardando resultado: ${aguardando.length}`, ...comResto(linhas, aguardando.length)].join("\n"));
    }
  }

  if (e.pendencias && d.pendencias.length > 0) {
    const linhas = d.pendencias.slice(0, maxManha).map((t) => `• ${cortar(t.split("\n")[0] ?? t, MAX_OBJETO)}`);
    partes.push([`📌 Para você: ${d.pendencias.length}`, ...comResto(linhas, d.pendencias.length)].join("\n"));
  }

  if (e.movimentos) {
    const daEquipe = d.movimentos.filter((m) => m.porId !== d.usuarioId);
    if (daEquipe.length > 0) {
      const linhas = daEquipe.slice(0, maxResumo).map(linhaDoMovimento);
      const titulo = `👥 A equipe moveu ${daEquipe.length} ${daEquipe.length === 1 ? "item" : "itens"} nas últimas 24 h`;
      partes.push([titulo, ...comResto(linhas, daEquipe.length)].join("\n"));
    }
  }

  if (e.movimentos) {
    const daEquipe = d.propostasMovidas.filter((m) => m.porId !== d.usuarioId);
    if (daEquipe.length > 0) {
      const linhas = daEquipe.slice(0, maxResumo).map(linhaDaPropostaMovida);
      partes.push([`📄 Propostas nas últimas 24 h: ${daEquipe.length}`, ...comResto(linhas, daEquipe.length)].join("\n"));
    }
  }

  if (e.disputa) {
    const vistos = new Set<string>();
    const entraram = d.movimentos.filter((m) => {
      if (m.para !== "disputa" || vistos.has(m.itemId)) return false;
      vistos.add(m.itemId);
      return true;
    });
    if (entraram.length > 0) {
      const linhas = entraram.slice(0, maxManha).map((m) => `• ${objetoCurto(m.objeto)}${linhaDoLink(m.itemId)}`);
      partes.push([`🏁 Entraram em disputa: ${entraram.length}`, ...comResto(linhas, entraram.length)].join("\n"));
    }
  }

  if (e.meta) {
    const prioridade = e.perfil === "operacional" && d.disputasNaSemana < d.meta.minimo ? itemParaPriorizar(d.itens, agora) : null;
    const priorizar = prioridade === null ? null : { objeto: prioridade.objeto, restanteMs: new Date(prioridade.dataEncerramento).getTime() - agora.getTime(), id: prioridade.id };
    partes.push(textoDaMeta(d.disputasNaSemana, d.meta, priorizar, d.vencidasNaSemana));
  }

  return { partes, novasMostradas: [...mostradas] };
}

function saudacaoDaManha(nome: string): string {
  return primeiroNome(nome) === "" ? "☀️ Bom dia!" : `☀️ Bom dia, ${primeiroNome(nome)}!`;
}

/**
 * Resumo das 7h, montado pelas escolhas da pessoa. Cada parte só entra se tiver o que dizer;
 * a meta entra sempre que escolhida. Sem nenhuma parte, texto vazio.
 */
export function textoResumoManha(d: DadosResumoManha, agora: Date): ResumoManha {
  let reducao = 0;
  let { partes, novasMostradas } = partesDoResumoManha(d, agora, reducao);
  if (partes.length === 0) return { texto: "", novasMostradas: [] };
  let texto = [saudacaoDaManha(d.nome), ...partes].join("\n\n");
  // Passou de 4000: tira itens das listas em vez de cortar no meio de um título ou link.
  while (texto.length > MAX_TEXTO_WA && reducao < MAX_LISTA_RESUMO) {
    reducao += 1;
    ({ partes, novasMostradas } = partesDoResumoManha(d, agora, reducao));
    texto = [saudacaoDaManha(d.nome), ...partes].join("\n\n");
  }
  return { texto: cortarEmLinhas(texto, MAX_TEXTO_WA), novasMostradas };
}

/** Parte do resumo de uma empresa, com o nome curto dela. */
export interface BlocoResumo {
  empresa: string;
  partes: ReadonlyArray<string>;
}

function textoDoBloco(empresa: string, partes: ReadonlyArray<string>, omitidos: number): string {
  return [`🏢 *${empresa}*`, ...partes, ...(omitidos > 0 ? [`e mais ${omitidos} no sistema`] : [])].join("\n\n");
}

/** Tira a última entrada da lista de uma parte (título na primeira linha). Sem lista que sobre, a parte some. */
function tirarUltimaEntrada(parte: string): { parte: string | null; perdidos: number } {
  const separador = parte.includes("\n\n") ? "\n\n" : "\n";
  const entradas = parte.split(separador);
  const ultima = entradas.pop() ?? "";
  const resto = /^\+(\d+)$/.exec(ultima);
  const perdidos = resto?.[1] ? Number(resto[1]) : 1;
  // Em lista de uma linha por entrada, a linha do link pertence ao título de cima: sai junto.
  if (separador === "\n" && /^https?:\/\//.test(ultima) && entradas.length > 1) entradas.pop();
  return entradas.length <= 1 ? { parte: null, perdidos } : { parte: entradas.join(separador), perdidos };
}

/** Encolhe o bloco até caber: corta o fim das listas (da última parte para a primeira) e avisa quantas entradas ficaram de fora. */
function ajustarBloco(bloco: BlocoResumo, orcamento: number): string {
  const partes = [...bloco.partes];
  let omitidos = 0;
  while (partes.length > 0 && textoDoBloco(bloco.empresa, partes, omitidos).length > orcamento) {
    const indice = partes.length - 1;
    const { parte, perdidos } = tirarUltimaEntrada(partes[indice] ?? "");
    omitidos += perdidos;
    if (parte === null) partes.pop();
    else partes[indice] = parte;
  }
  return textoDoBloco(bloco.empresa, partes, omitidos);
}

/**
 * Uma mensagem só para a pessoa com um bloco por empresa (cabeçalho com o nome curto dela). Cabe em `max`
 * caracteres: blocos curtos ficam inteiros e os longos dividem o espaço que sobra, com as listas cortadas
 * e "e mais N no sistema". Sem blocos com conteúdo, texto vazio.
 */
export function juntarResumos(nome: string, blocos: ReadonlyArray<BlocoResumo>, max: number = MAX_TEXTO_WA): string {
  const comConteudo = blocos.filter((b) => b.partes.length > 0);
  if (comConteudo.length === 0) return "";
  const saudacao = saudacaoDaManha(nome);
  const completos = comConteudo.map((b) => textoDoBloco(b.empresa, b.partes, 0).length);
  let sobra = max - saudacao.length - 2 * comConteudo.length;
  let pendentes = comConteudo.map((_, i) => i);
  const orcamentos = new Map<number, number>();
  while (pendentes.length > 0) {
    const parcela = Math.floor(sobra / pendentes.length);
    const cabem = pendentes.filter((i) => (completos[i] ?? 0) <= parcela);
    if (cabem.length === 0) {
      for (const i of pendentes) orcamentos.set(i, parcela);
      break;
    }
    for (const i of cabem) {
      orcamentos.set(i, completos[i] ?? 0);
      sobra -= completos[i] ?? 0;
    }
    pendentes = pendentes.filter((i) => !cabem.includes(i));
  }
  const textos = comConteudo.map((b, i) => ajustarBloco(b, orcamentos.get(i) ?? 0));
  return cortarEmLinhas([saudacao, ...textos].join("\n\n"), max);
}

/* ---------- modelos aprovados (janela fechada) ---------- */

/** Nomes dos modelos utilitários da Meta; as variáveis WA_TEMPLATE_RESUMO_7H e WA_TEMPLATE_ANDAMENTO_15H sobrescrevem. */
export const MODELO_RESUMO_7H = "foxlicita_resumo_7h";
export const MODELO_ANDAMENTO_15H = "foxlicita_andamento_15h";
/** A Meta recusa parâmetro longo demais; ficamos bem abaixo do limite. */
export const MAX_PARAMETRO_MODELO = 180;

export type CanalDeEnvio = "texto" | "modelo" | "nenhum";

/** Janela aberta: texto completo. Fechada: só modelo aprovado, e só com os modelos ligados. */
export function escolherCanal(aberta: boolean, modelosLigados: boolean): CanalDeEnvio {
  if (aberta) return "texto";
  return modelosLigados ? "modelo" : "nenhum";
}

/** Parâmetro de modelo: sem quebra de linha, tab nem espaço repetido, nunca vazio, curto. */
export function parametroDoModelo(texto: string): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo === "" ? "sem novidades" : cortar(limpo, MAX_PARAMETRO_MODELO);
}

/** Primeiro nome para o {{1}} dos modelos. */
export function nomeParaModelo(nome: string): string {
  return parametroDoModelo(primeiroNome(nome) === "" ? "equipe" : primeiroNome(nome));
}

function contar(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

function fechaHoje(i: ItemAlerta, agora: Date): boolean {
  const fim = new Date(i.dataEncerramento).getTime();
  return !Number.isNaN(fim) && fim > agora.getTime() && diaDeSaoPaulo(new Date(fim)) === diaDeSaoPaulo(agora);
}

/** "meta 2 de 5": o alvo é o mínimo até batê-lo e o ideal depois. */
function metaCurta(feitas: number, meta: MetaConfig): string {
  return `meta ${feitas} de ${feitas >= meta.minimo ? meta.ideal : meta.minimo}`;
}

/** Uma linha curta do resumo das 7h para o {{2}} do modelo, ex.: "3 prazos hoje, 2 propostas para fazer, meta 2 de 5". */
export function linhaCurtaResumo(d: DadosResumoManha, agora: Date): string {
  const e = d.escolhas;
  const partes: string[] = [];
  if (e.fechando) {
    const n = d.itens.filter((i) => !ETAPAS_ENCERRADAS.includes(i.etapa) && fechaHoje(i, agora)).length;
    if (n > 0) partes.push(contar(n, "prazo hoje", "prazos hoje"));
  }
  if (e.pendencias && d.propostasHoje.length > 0) {
    partes.push(contar(d.propostasHoje.length, "proposta para fazer", "propostas para fazer"));
  }
  if (e.pendencias && d.pendencias.length > 0) partes.push(contar(d.pendencias.length, "aviso", "avisos"));
  if (e.novas && d.novas.length > 0) partes.push(contar(d.novas.length, "nova do ramo", "novas do ramo"));
  if (e.movimentos) {
    const daEquipe = d.movimentos.filter((m) => m.porId !== d.usuarioId).length;
    if (daEquipe > 0) partes.push(contar(daEquipe, "movimento da equipe", "movimentos da equipe"));
  }
  if (e.meta) partes.push(metaCurta(d.disputasNaSemana, d.meta));
  return parametroDoModelo(partes.length === 0 ? "sem pendências hoje" : partes.join(", "));
}

/* ---------- andamento do dia (15h) ---------- */

export interface DadosAndamento {
  usuarioId: string;
  nome: string;
  escolhas: EscolhasAlerta;
  /** Propostas geradas, aprovadas, enviadas ou devolvidas hoje */
  propostas: ReadonlyArray<MovimentoProposta>;
  /** Mudanças de etapa de hoje */
  movimentos: ReadonlyArray<MovimentoEquipe>;
  /** Itens que fecham hoje ou amanhã e ainda não têm proposta */
  semProposta: ReadonlyArray<PropostaDoDia>;
  /** Itens de prazos que ficaram na fila sem aviso (janela fechada) e ainda valem */
  prazosPendentes: ReadonlyArray<ItemAlerta>;
  /** Avisos que esperam esta pessoa */
  pendencias: ReadonlyArray<string>;
  /** Itens do Pipeline ainda em jogo */
  emJogo: number;
  disputasNaSemana: number;
  vencidasNaSemana: VencidasDaSemana;
  meta: MetaConfig;
}

/** Início do dia (00h) em São Paulo. */
export function inicioDoDia(agora: Date): Date {
  return new Date(`${diaDeSaoPaulo(agora)}T00:00:00-03:00`);
}

const ROTULO_ACAO: ReadonlyArray<{ acao: MovimentoProposta["acao"]; singular: string; plural: string }> = [
  { acao: "gerou", singular: "gerada", plural: "geradas" },
  { acao: "aprovou", singular: "aprovada", plural: "aprovadas" },
  { acao: "enviou", singular: "enviada", plural: "enviadas" },
  { acao: "devolveu", singular: "devolvida", plural: "devolvidas" },
];

/** "1 gerada, 2 enviadas"; null sem nenhuma. */
function textoDasAcoes(propostas: ReadonlyArray<MovimentoProposta>): string | null {
  const partes = ROTULO_ACAO.map((r) => {
    const n = propostas.filter((p) => p.acao === r.acao).length;
    return n === 0 ? null : contar(n, r.singular, r.plural);
  }).filter((p): p is string => p !== null);
  return partes.length === 0 ? null : partes.join(", ");
}

/** Um item por mudança: o mesmo item movido duas vezes no dia conta uma. */
function itensMovidos(movimentos: ReadonlyArray<MovimentoEquipe>): MovimentoEquipe[] {
  const vistos = new Set<string>();
  return movimentos.filter((m) => {
    if (vistos.has(m.itemId)) return false;
    vistos.add(m.itemId);
    return true;
  });
}

/** Uma linha curta do andamento das 15h para o {{2}} do modelo. */
export function linhaCurtaAndamento(d: DadosAndamento): string {
  const partes: string[] = [];
  const acoes = textoDasAcoes(d.propostas);
  partes.push(acoes === null ? "nenhuma proposta mexida" : `propostas: ${acoes}`);
  const etapas = itensMovidos(d.movimentos).length;
  if (etapas > 0) partes.push(contar(etapas, "item mudou de etapa", "itens mudaram de etapa"));
  if (d.semProposta.length > 0) {
    partes.push(contar(d.semProposta.length, "fecha hoje ou amanhã sem proposta", "fecham hoje ou amanhã sem proposta"));
  }
  if (d.escolhas.meta) partes.push(metaCurta(d.disputasNaSemana, d.meta));
  return parametroDoModelo(partes.join(", "));
}

/**
 * Andamento do dia, curto e em linhas: propostas de hoje, mudanças de etapa, o que fecha hoje ou amanhã sem proposta,
 * prazos e avisos que ficaram na fila e a meta da semana. Vazio quando não há nada em jogo nem nada aconteceu.
 */
export function textoAndamento(d: DadosAndamento, agora: Date): string {
  const movidos = itensMovidos(d.movimentos);
  const algo =
    d.propostas.length > 0 || movidos.length > 0 || d.semProposta.length > 0 || d.prazosPendentes.length > 0 || d.pendencias.length > 0 || d.emJogo > 0;
  if (!algo) return "";
  // Passou de 4000: tira itens das listas em vez de cortar no meio de um título ou link.
  let texto = montarAndamento(d, movidos, agora, MAX_LISTA_MANHA);
  for (let limite = MAX_LISTA_MANHA - 1; texto.length > MAX_TEXTO_WA && limite >= 1; limite -= 1) {
    texto = montarAndamento(d, movidos, agora, limite);
  }
  return cortarEmLinhas(texto, MAX_TEXTO_WA);
}

function montarAndamento(d: DadosAndamento, movidos: ReadonlyArray<MovimentoEquipe>, agora: Date, limite: number): string {
  const nome = primeiroNome(d.nome);
  const linhas: string[] = [nome === "" ? "📊 Andamento do dia" : `📊 Andamento do dia, ${nome}`];

  const acoes = textoDasAcoes(d.propostas);
  linhas.push(acoes === null ? "⚠️ Nenhuma proposta mexida hoje" : `✅ Propostas hoje: ${acoes}`);

  if (movidos.length === 0) {
    linhas.push("⚠️ Nenhum item mudou de etapa hoje");
  } else {
    linhas.push(`✅ Mudaram de etapa: ${movidos.length}`);
    linhas.push(...comResto(movidos.slice(0, limite).map(linhaDoMovimento), movidos.length));
  }

  if (d.semProposta.length > 0) {
    linhas.push(`⚠️ Fecham hoje ou amanhã sem proposta: ${d.semProposta.length}`);
    const itens = d.semProposta
      .slice(0, limite)
      .map((p) => `• ${objetoCurto(p.objeto)} (${quandoFechaRelativo(p.dataEncerramento, agora)})${linhaDoLink(p.itemId)}`);
    linhas.push(...comResto(itens, d.semProposta.length));
  }

  if (d.prazosPendentes.length > 0) {
    linhas.push(`⏰ Prazos que ficaram sem aviso: ${d.prazosPendentes.length}`);
    const itens = d.prazosPendentes
      .slice(0, limite)
      .map((i) => `• ${objetoCurto(i.objeto)} (em ${textoRestante(new Date(i.dataEncerramento).getTime() - agora.getTime())})${linhaDoLink(i.id)}`);
    linhas.push(...comResto(itens, d.prazosPendentes.length));
  }

  if (d.pendencias.length > 0) {
    linhas.push(`📌 Para você: ${d.pendencias.length}`);
    const itens = d.pendencias.slice(0, limite).map((t) => `• ${cortar(t.split("\n")[0] ?? t, MAX_OBJETO)}`);
    linhas.push(...comResto(itens, d.pendencias.length));
  }

  if (d.escolhas.meta) linhas.push(textoDaMeta(d.disputasNaSemana, d.meta, null, d.vencidasNaSemana));
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
  /** Pedido para pôr licitações no Pipeline pelo link; `texto` é a mensagem inteira */
  | { tipo: "analisar"; texto: string }
  /** "gerar 2" / "gerar proposta 2": monta o rascunho da proposta de número N da lista do dia (null: sem número) */
  | { tipo: "gerar"; numero: number | null }
  /** Cumprimento curto: responde sem chamar o assistente */
  | { tipo: "saudacao" }
  /** "resumo" / "ver resumo" (botão do modelo das 7h): manda o resumo completo do dia */
  | { tipo: "ver_resumo" }
  /** "andamento" / "ver andamento" (botão do modelo das 15h): manda o andamento completo do dia */
  | { tipo: "ver_andamento" }
  /** "propostas": lista numerada das propostas que pedem ação */
  | { tipo: "propostas" }
  /** Número sozinho ("3"): escolhe da última lista de propostas */
  | { tipo: "numero"; numero: number }
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

const PEDIDO_GERAR = /^gerar(?:\s+(?:a\s+)?proposta)?(?:\s+(?:n\s*)?(\d{1,2}))?$/;
const SAUDACOES: ReadonlySet<string> = new Set(["oi", "oii", "ola", "alo", "opa", "bom dia", "boa tarde", "boa noite", "ok"]);

const PEDIDO_ANALISAR = /^(?:analisar|analisa|analise|adicionar|adiciona)(?:\s|$)/;
const MAX_PALAVRAS_SOBRANDO = 3;

/** "analisar <link>", ou só o link colado (com no máximo umas palavrinhas junto). Pergunta longa com link segue para o assistente. */
function pedeAnalise(limpo: string, texto: string): boolean {
  if (PEDIDO_ANALISAR.test(limpo)) return true;
  if (lerLinksPncp(texto).length === 0) return false;
  const sobra = texto.split(/\s+/).filter((t) => t !== "" && lerLinksPncp(t).length === 0);
  return sobra.length <= MAX_PALAVRAS_SOBRANDO;
}

/** Lê o que a pessoa escreveu, sem diferenciar acento, caixa e espaço extra. */
export function lerComando(texto: string): Comando {
  const limpo = simplificar(texto);
  const ativar = /^ativar\s+([a-z0-9]{6})$/.exec(limpo);
  if (ativar?.[1]) return { tipo: "ativar", codigo: ativar[1].toUpperCase() };
  const gerar = PEDIDO_GERAR.exec(limpo);
  if (gerar) return { tipo: "gerar", numero: gerar[1] === undefined ? null : Number(gerar[1]) };
  if (SAUDACOES.has(limpo)) return { tipo: "saudacao" };
  const numero = lerNumeroEscolhido(limpo);
  if (numero !== null) return { tipo: "numero", numero };
  switch (limpo) {
    case "proposta":
    case "propostas":
    case "minhas propostas":
    case "ver propostas":
      return { tipo: "propostas" };
    case "resumo":
    case "ver resumo":
      return { tipo: "ver_resumo" };
    case "andamento":
    case "ver andamento":
      return { tipo: "ver_andamento" };
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
      if (pedeAnalise(limpo, texto)) return { tipo: "analisar", texto: texto.trim() };
      return { tipo: "livre", texto: texto.trim() };
  }
}

/* ---------- botões ---------- */

export type AcaoBotao =
  | { tipo: "participar" | "atribuir" | "descartar" | "gerar"; itemId: string }
  /** Aprova o rascunho pelo mesmo caminho da tela de propostas */
  | { tipo: "aprovar"; propostaId: string }
  | { tipo: "confirmar" }
  | { tipo: "cancelar" }
  | { tipo: "continuar" }
  /** Botões dos modelos das 7h e das 15h (janela fechada) */
  | { tipo: "ver_resumo" }
  | { tipo: "ver_andamento" };

const PREFIXO_BOTAO: Readonly<Record<"participar" | "atribuir" | "descartar" | "gerar", string>> = {
  participar: "part",
  atribuir: "atr",
  descartar: "desc",
  gerar: "ger",
};

/** Texto que volta no webhook quando a pessoa toca o botão (máx. 256 caracteres). */
export function payloadDoBotao(acao: AcaoBotao): string {
  switch (acao.tipo) {
    case "participar":
    case "atribuir":
    case "descartar":
    case "gerar":
      return `${PREFIXO_BOTAO[acao.tipo]}:${acao.itemId}`;
    case "aprovar":
      return `apr:${acao.propostaId}`;
    case "confirmar":
      return "sim";
    case "cancelar":
      return "nao";
    case "continuar":
      return "continuar";
    case "ver_resumo":
      return "ver_resumo";
    case "ver_andamento":
      return "ver_andamento";
  }
}

export function lerPayload(payload: string): AcaoBotao | null {
  if (payload === "sim") return { tipo: "confirmar" };
  if (payload === "nao") return { tipo: "cancelar" };
  if (payload === "continuar") return { tipo: "continuar" };
  if (payload === "ver_resumo") return { tipo: "ver_resumo" };
  if (payload === "ver_andamento") return { tipo: "ver_andamento" };
  const corte = payload.indexOf(":");
  if (corte < 0) return null;
  const prefixo = payload.slice(0, corte);
  const itemId = payload.slice(corte + 1);
  if (itemId === "") return null;
  if (prefixo === "part") return { tipo: "participar", itemId };
  if (prefixo === "atr") return { tipo: "atribuir", itemId };
  if (prefixo === "desc") return { tipo: "descartar", itemId };
  if (prefixo === "ger") return { tipo: "gerar", itemId };
  if (prefixo === "apr") return { tipo: "aprovar", propostaId: itemId };
  return null;
}

const MAX_TITULO_BOTAO = 20;

/** "Atribuir a Paulo" com o responsável padrão da empresa; sem ele, "Atribuir a mim". Até 20 caracteres. */
export function tituloAtribuir(responsavelPadrao: string | null): string {
  const nome = responsavelPadrao === null ? "" : primeiroNome(responsavelPadrao);
  return nome === "" ? "Atribuir a mim" : cortar(`Atribuir a ${nome}`, MAX_TITULO_BOTAO);
}

/**
 * Botões do alerta (título de até 20 caracteres). Só alertas ligados a um item têm botões.
 * `responsavelPadrao`: nome de quem recebe o item no "Atribuir a ..." (null: quem tocou).
 */
export function botoesDoAlerta(
  tipo: TipoAlertaWa,
  itemId: string | null,
  responsavelPadrao: string | null = null,
): Array<{ titulo: string; payload: string }> {
  if (itemId === null) return [];
  if (tipo === "radar" || tipo === "aviso") return [];
  return [
    { titulo: "Vou participar", payload: payloadDoBotao({ tipo: "participar", itemId }) },
    { titulo: tituloAtribuir(responsavelPadrao), payload: payloadDoBotao({ tipo: "atribuir", itemId }) },
    { titulo: "Descartar", payload: payloadDoBotao({ tipo: "descartar", itemId }) },
  ];
}

/** Botões do resumo das 7h: "Gerar 1/2/3" (um por proposta do dia) e, se sobrar lugar, "Continuar recebendo". Máx. 3. */
export function botoesDoResumoManha(propostas: ReadonlyArray<{ itemId: string }>): Array<{ titulo: string; payload: string }> {
  const gerar = propostas.slice(0, MAX_PROPOSTAS_DO_DIA).map((p, i) => ({
    titulo: `Gerar ${i + 1}`,
    payload: payloadDoBotao({ tipo: "gerar", itemId: p.itemId }),
  }));
  return gerar.length < MAX_PROPOSTAS_DO_DIA ? [...gerar, { titulo: "Continuar recebendo", payload: "continuar" }] : gerar;
}

/** Resposta ao "gerar N": objeto, valor total do rascunho, itens e o link para revisar. */
export function textoRascunhoPronto(p: { objeto: string; total: number; itens: number; link: string; reaproveitado: boolean; podeAprovar: boolean }): string {
  const abertura = p.reaproveitado ? "📝 Esse rascunho já estava pronto" : "📝 Rascunho pronto";
  const itens = `${p.itens} ${p.itens === 1 ? "item" : "itens"}`;
  return [
    abertura,
    `*${objetoCurto(p.objeto)}*`,
    `Valor total: ${reais(p.total)} · ${itens}`,
    p.link,
    p.podeAprovar ? "Revise e aprove pelo link (ou toque em Aprovar)." : "Revise e aprove pelo link.",
  ].join("\n");
}

/** Aviso ao dono: "Paulo gerou a proposta de Toner (R$ 12.500): <link>". */
/** O que aconteceu com a proposta: gerou/aprovou (WhatsApp ou tela), subiu para revisão, enviou no portal, registrou externa. */
export type AcaoAvisoProposta = "gerou" | "aprovou" | "subiu" | "enviou" | "registrou";

/** Situação de custo da proposta para o aviso: prejuízo em reais (0 sem prejuízo) e itens sem custo informado. */
export interface CustoDaProposta {
  prejuizo: number;
  itensSemCusto: number;
}

/** Linha de alerta do aviso: o prejuízo, ou o custo que falta; null quando está tudo certo. */
export function linhaAvisoCusto(c: CustoDaProposta | null | undefined): string | null {
  if (!c) return null;
  if (c.prejuizo > 0) return `⚠️ Prejuízo de ${reais(c.prejuizo)}`;
  if (c.itensSemCusto > 0) return `Custo não informado em ${c.itensSemCusto} ${c.itensSemCusto === 1 ? "item" : "itens"}`;
  return null;
}

/**
 * `leitura`: link do documento que abre sem login (só no "subiu", para ler antes de aprovar).
 * `custo`: quando a proposta dá prejuízo ou falta custo, o aviso ganha uma linha (só no "subiu" e no "gerou").
 */
export function textoAvisoAoDono(p: {
  nome: string;
  acao: AcaoAvisoProposta;
  objeto: string;
  total: number;
  link: string;
  leitura?: string | null;
  custo?: CustoDaProposta | null;
}): string {
  const quem = primeiroNome(p.nome) === "" ? "Alguém da equipe" : primeiroNome(p.nome);
  const objeto = objetoCurto(p.objeto);
  const valor = p.total > 0 ? ` (${reais(p.total)})` : "";
  const alerta = linhaAvisoCusto(p.custo);
  switch (p.acao) {
    case "subiu":
      return [
        `📄 ${quem} subiu a proposta de ${objeto}${valor} para você revisar.`,
        ...(alerta ? [alerta] : []),
        ...(p.leitura ? [`Ler o documento (abre sem login): ${p.leitura}`] : []),
        `Aprovar ou devolver no sistema: ${p.link}`,
        "Leu e está certa? Toque em *Aprovar*.",
      ].join("\n");
    case "enviou":
      return `📤 ${quem} enviou no portal a proposta de ${objeto}${valor}.
Comprovante e detalhes: ${p.link}`;
    case "registrou":
      return `📤 ${quem} registrou uma proposta enviada fora do sistema: ${objeto}${valor}.
Ver: ${p.link}`;
    case "gerou":
      return [`${quem} ${p.acao} a proposta de ${objeto}${valor}: ${p.link}`, ...(alerta ? [alerta] : [])].join("\n");
    case "aprovou":
      return `${quem} ${p.acao} a proposta de ${objeto}${valor}: ${p.link}`;
  }
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

  // No webhook o Zernio põe o metadata na raiz do evento; na caixa de entrada, dentro da mensagem.
  const metadataRaiz = sub(r, "metadata");

  const payloadBotao = primeiro(
    // Formato confirmado no Zernio: toque em botão de resposta chega em metadata.interactiveId (interactiveType "button_reply").
    campo(metadataRaiz, "interactiveId"),
    campo(metadata, "interactiveId"),
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
