/**
 * Regras da central de avisos (funções puras, sem banco nem rede; o relógio entra por parâmetro).
 * Nada aqui chama o assistente: só dados que o painel já tem.
 */
import { calcularCaixa, type LimitesCaixa } from "@/core/caixa";
import type { FichaEdital } from "@/core/ficha";
import { resumirObjeto } from "@/core/objeto";
import type { Permissao } from "@/core/permissoes";
import type { OportunidadeComScore } from "@/core/types";

const MS_HORA = 3_600_000;
export const JANELA_DISPUTA_MS = 48 * MS_HORA;
export const PROPOSTA_PARADA_MS = 24 * MS_HORA;
/** Nota do Radar a partir da qual uma oportunidade "Para você" vira aviso */
export const NOTA_ALTA = 80;
/** Capital "baixo": até esta fração do máximo que o dono aceita pagar antes de receber */
export const FRACAO_CAPITAL_BAIXO = 0.5;
/** Quantos dias para trás a deduplicação olha */
export const JANELA_DEDUP_DIAS = 7;
const MAX_TEXTO = 140;

export type TipoAviso =
  | "disputa_48h"
  | "oportunidade"
  | "ficha_caixa"
  | "proposta_parada"
  | "proposta_revisao"
  | "proposta_revisada"
  | "item_atribuido"
  | "juridico_pendente";

/** Quem deve receber o aviso. */
export type AlvoAviso =
  | { tipo: "todos" }
  | { tipo: "pessoa"; usuarioId: string }
  | { tipo: "permissao"; permissao: Permissao };

export interface AvisoNovo {
  alvo: AlvoAviso;
  /** Pessoa que não recebe (quem fez a ação) */
  exceto?: string;
  tipo: TipoAviso;
  titulo: string;
  corpo: string;
  /** Caminho dentro do painel, ex.: "/pipeline" */
  link: string | null;
  /** Identifica o fato; o mesmo fato não vira aviso de novo dentro da janela de deduplicação */
  chave: string;
}

export interface AvisoExistente {
  chave: string;
  /** null = aviso para todos */
  usuarioId: string | null;
}

const formatoDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Dia civil em São Paulo, como AAAA-MM-DD. */
export function diaDeSaoPaulo(data: Date): string {
  return formatoDia.format(data);
}

function cortar(texto: string, max: number): string {
  return texto.length <= max ? texto : `${texto.slice(0, max - 1).trimEnd()}…`;
}

function objetoCurto(objeto: string): string {
  return cortar(resumirObjeto(objeto), MAX_TEXTO);
}

function alvoDoResponsavel(responsavelId: string | null): AlvoAviso {
  return responsavelId ? { tipo: "pessoa", usuarioId: responsavelId } : { tipo: "todos" };
}

/** "5 h", "2 d", "1 d 3 h". Nunca menos de 1 h. */
export function textoRestante(ms: number): string {
  const horas = Math.max(1, Math.round(ms / MS_HORA));
  if (horas < 24) return `${horas} h`;
  const dias = Math.floor(horas / 24);
  const resto = horas % 24;
  return resto === 0 ? `${dias} d` : `${dias} d ${resto} h`;
}

const ETAPAS_ENCERRADAS: ReadonlyArray<string> = ["ganha", "perdida"];

/* ---------- geração (cron diário) ---------- */

export interface ItemParaDisputa {
  id: string;
  etapa: string;
  objeto: string;
  /** ISO 8601 */
  dataEncerramento: string;
  responsavelId: string | null;
}

/** Item do pipeline ainda em jogo que fecha em até 48 h. Vai para o responsável; sem responsável, para todos. */
export function avisosDeDisputa(itens: ReadonlyArray<ItemParaDisputa>, agora: Date): AvisoNovo[] {
  const avisos: AvisoNovo[] = [];
  for (const i of itens) {
    if (ETAPAS_ENCERRADAS.includes(i.etapa)) continue;
    const restante = Date.parse(i.dataEncerramento) - agora.getTime();
    if (Number.isNaN(restante) || restante <= 0 || restante > JANELA_DISPUTA_MS) continue;
    avisos.push({
      alvo: alvoDoResponsavel(i.responsavelId),
      tipo: "disputa_48h",
      titulo: `Disputa em ${textoRestante(restante)}`,
      corpo: objetoCurto(i.objeto),
      link: "/pipeline",
      chave: `disputa:${i.id}`,
    });
  }
  return avisos;
}

/** "Para você" com nota alta e ainda aberta. `jaNoPipeline` evita avisar do que a equipe já pegou. */
export function avisosDeOportunidade(
  recomendadas: ReadonlyArray<OportunidadeComScore>,
  jaNoPipeline: ReadonlySet<string>,
  agora: Date,
): AvisoNovo[] {
  const vistos = new Set<string>();
  const avisos: AvisoNovo[] = [];
  for (const o of recomendadas) {
    if (vistos.has(o.id) || jaNoPipeline.has(o.id)) continue;
    vistos.add(o.id);
    if (o.score.total < NOTA_ALTA || Date.parse(o.dataEncerramento) <= agora.getTime()) continue;
    avisos.push({
      alvo: { tipo: "todos" },
      tipo: "oportunidade",
      titulo: `Nova oportunidade para você, nota ${Math.round(o.score.total)}`,
      corpo: objetoCurto(o.objeto),
      link: `/licitacao/${o.orgaoCnpj}/${o.anoCompra}/${o.sequencialCompra}`,
      chave: `oportunidade:${o.id}`,
    });
  }
  return avisos;
}

export interface ItemComFichaConferida {
  id: string;
  etapa: string;
  objeto: string;
  valorEstimado: number | null;
  ficha: FichaEdital;
  responsavelId: string | null;
}

/** Ficha conferida que casa com o foco do dono: receita mensal e/ou capital de giro baixo. */
export function avisosDeFicha(itens: ReadonlyArray<ItemComFichaConferida>, limites: LimitesCaixa, agora: Date): AvisoNovo[] {
  const avisos: AvisoNovo[] = [];
  for (const i of itens) {
    if (ETAPAS_ENCERRADAS.includes(i.etapa)) continue;
    const caixa = calcularCaixa({
      custoTotal: null,
      prazoEntregaDias: i.ficha.prazoEntregaDias.valor,
      prazoPagamentoDias: i.ficha.prazoPagamentoDias.valor,
      medicaoMensal: i.ficha.medicaoMensal.valor,
      pagamentoAntecipado: i.ficha.pagamentoAntecipado.valor,
      valorContrato: i.valorEstimado,
      mesesContrato: null,
      inicio: agora,
      limites,
    });
    const maximo = limites.capitalMaximo;
    const capitalBaixo =
      caixa.capital !== null &&
      maximo !== null &&
      maximo > 0 &&
      !caixa.avaliacao.excede &&
      caixa.capital.valor <= maximo * FRACAO_CAPITAL_BAIXO;
    if (!caixa.receitaMensal && !capitalBaixo) continue;
    const titulo =
      caixa.receitaMensal && capitalBaixo
        ? "Receita mensal e pouco capital de giro"
        : caixa.receitaMensal
          ? "Receita mensal com ficha conferida"
          : "Pouco capital de giro com ficha conferida";
    avisos.push({
      alvo: alvoDoResponsavel(i.responsavelId),
      tipo: "ficha_caixa",
      titulo,
      corpo: objetoCurto(i.objeto),
      link: "/pipeline",
      chave: `ficha:${i.id}`,
    });
  }
  return avisos;
}

export interface PropostaParaAviso {
  id: string;
  titulo: string;
  status: string;
  /** ISO 8601: quando entrou no status atual */
  atualizadoEm: string;
  criadoPor: string | null;
}

/** Proposta parada em revisão há mais de 24 h: avisa quem aprova (menos a autora). */
export function avisosDePropostaParada(propostas: ReadonlyArray<PropostaParaAviso>, agora: Date): AvisoNovo[] {
  const avisos: AvisoNovo[] = [];
  for (const p of propostas) {
    if (p.status !== "em_revisao") continue;
    const parada = agora.getTime() - Date.parse(p.atualizadoEm);
    if (Number.isNaN(parada) || parada < PROPOSTA_PARADA_MS) continue;
    avisos.push({
      alvo: { tipo: "permissao", permissao: "aprovar_propostas" },
      ...(p.criadoPor ? { exceto: p.criadoPor } : {}),
      tipo: "proposta_parada",
      titulo: `Proposta parada há ${textoRestante(parada)} na revisão`,
      corpo: cortar(p.titulo, MAX_TEXTO),
      link: `/propostas/${p.id}`,
      chave: `proposta_parada:${p.id}:${p.atualizadoEm}`,
    });
  }
  return avisos;
}

/* ---------- eventos ---------- */

export function avisoPropostaEmRevisao(p: { id: string; titulo: string; autorId: string; autorNome: string; em: Date }): AvisoNovo {
  return {
    alvo: { tipo: "todos" },
    exceto: p.autorId,
    tipo: "proposta_revisao",
    titulo: "Proposta para revisar",
    corpo: `${p.autorNome} enviou a proposta "${cortar(p.titulo, MAX_TEXTO)}" para revisão.`,
    link: `/propostas/${p.id}`,
    chave: `proposta_revisao:${p.id}:${p.em.getTime()}`,
  };
}

/** Null quando quem revisa é a própria autora ou a proposta não tem autora. */
export function avisoPropostaRevisada(p: {
  id: string;
  titulo: string;
  autorId: string | null;
  revisorId: string;
  revisorNome: string;
  aprovada: boolean;
  nota: string | null;
  em: Date;
}): AvisoNovo | null {
  if (p.autorId === null || p.autorId === p.revisorId) return null;
  const titulo = cortar(p.titulo, MAX_TEXTO);
  const base = p.aprovada
    ? `${p.revisorNome} aprovou a proposta "${titulo}".`
    : `${p.revisorNome} devolveu a proposta "${titulo}" com ajustes.`;
  return {
    alvo: { tipo: "pessoa", usuarioId: p.autorId },
    tipo: "proposta_revisada",
    titulo: p.aprovada ? "Proposta aprovada" : "Proposta devolvida",
    corpo: !p.aprovada && p.nota ? `${base} ${p.nota}` : base,
    link: `/propostas/${p.id}`,
    chave: `proposta_revisada:${p.id}:${p.em.getTime()}`,
  };
}

/** Null quando a pessoa atribuiu o item a si mesma. */
export function avisoItemAtribuido(p: {
  itemId: string;
  objeto: string;
  responsavelId: string;
  porId: string;
  porNome: string;
  em: Date;
}): AvisoNovo | null {
  if (p.responsavelId === p.porId) return null;
  return {
    alvo: { tipo: "pessoa", usuarioId: p.responsavelId },
    tipo: "item_atribuido",
    titulo: "Você é o responsável por uma oportunidade",
    corpo: `${p.porNome} passou para você a oportunidade "${objetoCurto(p.objeto)}".`,
    link: "/pipeline",
    chave: `item_atribuido:${p.itemId}:${p.responsavelId}:${p.em.getTime()}`,
  };
}

export function avisoJuridicoPendente(p: { itemId: string; objeto: string; porId: string; em: Date }): AvisoNovo {
  return {
    alvo: { tipo: "permissao", permissao: "revisao_juridica" },
    exceto: p.porId,
    tipo: "juridico_pendente",
    titulo: "Ok jurídico pendente",
    corpo: `A oportunidade "${objetoCurto(p.objeto)}" entrou na revisão jurídica.`,
    link: "/pipeline",
    chave: `juridico_pendente:${p.itemId}:${p.em.getTime()}`,
  };
}

/* ---------- destinatários e deduplicação ---------- */

export interface PessoaAviso {
  id: string;
  nome: string;
  email: string;
  papel: "dono" | "gestor" | "juridico";
  permissoes: ReadonlyArray<Permissao>;
  /** Número já normalizado (55DDDNUMERO) ou null */
  whatsapp: string | null;
  avisoEmail: boolean;
  avisoWhatsapp: boolean;
}

/** Pessoas ativas que recebem o aviso. O dono passa em qualquer permissão. */
export function destinatariosDoAviso(aviso: Pick<AvisoNovo, "alvo" | "exceto">, pessoas: ReadonlyArray<PessoaAviso>): PessoaAviso[] {
  const { alvo } = aviso;
  return pessoas.filter((p) => {
    if (p.id === aviso.exceto) return false;
    switch (alvo.tipo) {
      case "todos":
        return true;
      case "pessoa":
        return p.id === alvo.usuarioId;
      case "permissao":
        return p.papel === "dono" || p.permissoes.includes(alvo.permissao);
    }
  });
}

/** Aviso para todos e sem exceção vira uma única linha no painel (usuário nulo); os demais, uma linha por pessoa. */
export function destinosNoPainel(aviso: Pick<AvisoNovo, "alvo" | "exceto">, pessoas: ReadonlyArray<PessoaAviso>): Array<string | null> {
  if (aviso.alvo.tipo === "todos" && aviso.exceto === undefined) return [null];
  return destinatariosDoAviso(aviso, pessoas).map((p) => p.id);
}

export interface Entrega {
  aviso: AvisoNovo;
  /** Destinos novos no painel (null = todos) */
  paineis: Array<string | null>;
  /** Pessoas que recebem pelos canais externos (e-mail e WhatsApp, conforme a escolha de cada uma) */
  pessoas: PessoaAviso[];
}

/**
 * Tira o que já existe (mesma chave e mesmo destino dentro da janela de deduplicação) e o que se repete
 * na própria lista. Só sobram entregas com pelo menos um destino novo.
 */
export function planejarEntregas(
  candidatos: ReadonlyArray<AvisoNovo>,
  existentes: ReadonlyArray<AvisoExistente>,
  pessoas: ReadonlyArray<PessoaAviso>,
): Entrega[] {
  const conhecidos = new Set(existentes.map((e) => `${e.usuarioId ?? "*"}|${e.chave}`));
  const entregas: Entrega[] = [];
  for (const aviso of candidatos) {
    const paineis: Array<string | null> = [];
    for (const destino of destinosNoPainel(aviso, pessoas)) {
      const marca = `${destino ?? "*"}|${aviso.chave}`;
      if (conhecidos.has(marca)) continue;
      conhecidos.add(marca);
      paineis.push(destino);
    }
    if (paineis.length === 0) continue;
    const todos = destinatariosDoAviso(aviso, pessoas);
    const alcance = paineis.includes(null) ? todos : todos.filter((p) => paineis.includes(p.id));
    entregas.push({ aviso, paineis, pessoas: alcance });
  }
  return entregas;
}

/** Texto curto para e-mail e WhatsApp. */
export function textoDoAviso(aviso: Pick<AvisoNovo, "titulo" | "corpo">): string {
  return aviso.corpo === "" ? aviso.titulo : `${aviso.titulo}\n${aviso.corpo}`;
}
