/**
 * Regras dos alertas de WhatsApp pelo Zernio (funções puras, sem banco nem rede; o relógio entra por parâmetro).
 * Janela de 24 h, horário permitido, perfil de alerta, prazos urgentes, resumo da manhã, comandos, botões e leitura do webhook.
 */
import { diaDeSaoPaulo, textoRestante } from "@/core/avisos";
import { inicioDaSemana, type MetaConfig } from "@/core/meta";
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

function objetoCurto(objeto: string, max: number = MAX_OBJETO): string {
  return cortar(resumirObjeto(objeto), max);
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
    const texto = `⏰ Prazo em ${textoRestante(encerramento.getTime() - agora.getTime())}${onde}\n${objetoCurto(item.objeto)}`;
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
  const lista = alertas.slice(0, MAX_LISTA_RESUMO).map((a) => a.texto);
  const resto = alertas.length - lista.length;
  return [
    `Urgente: ${contagens.join(", ")}.`,
    lista.join("\n\n"),
    ...(resto > 0 ? [`+${resto}`] : []),
    "Responda *prazos* ou *pipeline* para ver mais.",
  ].join("\n\n");
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

export interface DadosResumoManha {
  usuarioId: string;
  nome: string;
  escolhas: EscolhasAlerta;
  /** Novas do ramo que esta pessoa ainda não viu, da mais indicada para a menos */
  novas: ReadonlyArray<NovaDoRamo>;
  itens: ReadonlyArray<ItemAlerta>;
  /** Movimentos das últimas 24 h */
  movimentos: ReadonlyArray<MovimentoEquipe>;
  /** Avisos que esperam esta pessoa */
  pendencias: ReadonlyArray<string>;
  /** Itens distintos que chegaram em disputa desde segunda-feira */
  disputasNaSemana: number;
  /** Meta da semana da empresa */
  meta: MetaConfig;
}

export interface ResumoManha {
  /** Vazio: nada a dizer */
  texto: string;
  /** Novas que apareceram no texto (não voltam no próximo resumo) */
  novasMostradas: string[];
}

const MAX_TEXTO_WA = 4000;
const MAX_OBJETO_LISTA = 90;

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
  return `${posicao}. *${objetoCurto(n.objeto, MAX_OBJETO_LISTA)}*\n${detalhes.join(" · ")}\n${fecha}`;
}

function linhaDoMovimento(m: MovimentoEquipe): string {
  const quem = m.porNome ? `${primeiroNome(m.porNome)}: ` : "";
  return `• ${quem}${objetoCurto(m.objeto, MAX_OBJETO_LISTA)} → ${rotuloDaEtapa(m.para)}`;
}

function comResto(linhas: string[], total: number): string[] {
  return total > linhas.length ? [...linhas, `+${total - linhas.length}`] : linhas;
}

function textoDaMeta(feitas: number, meta: MetaConfig): string {
  const placar = `🎯 Meta da semana: ${feitas} de ${meta.ideal} (mínimo ${meta.minimo})`;
  if (feitas >= meta.ideal) return `${placar}. Ideal batido!`;
  if (feitas >= meta.minimo) return `${placar}. Meta batida!`;
  const faltam = meta.minimo - feitas;
  return `${placar}. ${faltam === 1 ? "Falta 1" : `Faltam ${faltam}`} para o mínimo.`;
}

/** As partes do resumo (cada uma é um trecho com título e lista) e as novas que apareceram nelas. */
export interface PartesResumo {
  partes: string[];
  novasMostradas: string[];
}

/** Cada parte só entra se tiver o que dizer; a meta entra sempre que escolhida. */
export function partesDoResumoManha(d: DadosResumoManha, agora: Date): PartesResumo {
  const e = d.escolhas;
  const partes: string[] = [];
  const mostradas = new Set<string>();

  if (e.novas && d.novas.length > 0) {
    const lista = d.novas.slice(0, MAX_LISTA_RESUMO);
    for (const n of lista) mostradas.add(n.id);
    const titulo = `🆕 ${d.novas.length} ${d.novas.length === 1 ? "nova do seu ramo" : "novas do seu ramo"}`;
    partes.push([titulo, ...comResto(lista.map((n, i) => linhaDaNova(n, i + 1)), d.novas.length)].join("\n\n"));
  }

  if (e.grandes) {
    const grandes = d.novas.filter((n) => n.valor !== null && n.valor >= e.valorGrande);
    if (grandes.length > 0) {
      const lista = grandes.slice(0, MAX_LISTA_MANHA);
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
        .slice(0, MAX_LISTA_MANHA)
        .map((x) => `• ${objetoCurto(x.item.objeto, MAX_OBJETO_LISTA)} (em ${textoRestante(x.encerramento.getTime() - agora.getTime())})`);
      partes.push([`⏰ Fecham em 48 h: ${fechando.length}`, ...comResto(linhas, fechando.length)].join("\n"));
    }
  }

  if (e.aguardando) {
    const aguardando = emJogo.filter((i) => {
      const fim = new Date(i.dataEncerramento).getTime();
      return i.etapa === "disputa" && !Number.isNaN(fim) && fim <= agora.getTime();
    });
    if (aguardando.length > 0) {
      const linhas = aguardando.slice(0, MAX_LISTA_MANHA).map((i) => `• ${objetoCurto(i.objeto, MAX_OBJETO_LISTA)}`);
      partes.push([`⌛ Aguardando resultado: ${aguardando.length}`, ...comResto(linhas, aguardando.length)].join("\n"));
    }
  }

  if (e.pendencias && d.pendencias.length > 0) {
    const linhas = d.pendencias.slice(0, MAX_LISTA_MANHA).map((t) => `• ${cortar(t.split("\n")[0] ?? t, MAX_OBJETO)}`);
    partes.push([`📌 Para você: ${d.pendencias.length}`, ...comResto(linhas, d.pendencias.length)].join("\n"));
  }

  if (e.movimentos) {
    const daEquipe = d.movimentos.filter((m) => m.porId !== d.usuarioId);
    if (daEquipe.length > 0) {
      const linhas = daEquipe.slice(0, MAX_LISTA_RESUMO).map(linhaDoMovimento);
      const titulo = `👥 A equipe moveu ${daEquipe.length} ${daEquipe.length === 1 ? "item" : "itens"} nas últimas 24 h`;
      partes.push([titulo, ...comResto(linhas, daEquipe.length)].join("\n"));
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
      const linhas = entraram.slice(0, MAX_LISTA_MANHA).map((m) => `• ${objetoCurto(m.objeto, MAX_OBJETO_LISTA)}`);
      partes.push([`🏁 Entraram em disputa: ${entraram.length}`, ...comResto(linhas, entraram.length)].join("\n"));
    }
  }

  if (e.meta) partes.push(textoDaMeta(d.disputasNaSemana, d.meta));

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
  const { partes, novasMostradas } = partesDoResumoManha(d, agora);
  if (partes.length === 0) return { texto: "", novasMostradas: [] };
  return { texto: cortar([saudacaoDaManha(d.nome), ...partes].join("\n\n"), MAX_TEXTO_WA), novasMostradas };
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
  return cortar([saudacao, ...textos].join("\n\n"), max);
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
