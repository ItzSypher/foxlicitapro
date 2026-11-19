/**
 * Situação do WhatsApp de cada pessoa da empresa (funções puras de texto e estado; o relógio entra por parâmetro).
 * Serve ao card da página Alertas: por que alguém não recebeu o resumo das 7h.
 */
import { diaDeSaoPaulo } from "@/core/avisos";
import { JANELA_MS, MARGEM_JANELA_MS, janelaAberta } from "@/core/whatsapp-alertas";

const DIA_MS = 24 * 3_600_000;

export const EXPLICACAO_CONVERSA =
  "O WhatsApp só deixa mandar o resumo até 24 h depois da última mensagem da pessoa. Peça para ela responder qualquer coisa ou tocar em Continuar recebendo.";

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function partes(data: Date): { dia: string; mes: string; hora: string; minuto: string } {
  const lista = formatoDataHora.formatToParts(data);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => lista.find((p) => p.type === tipo)?.value ?? "";
  return { dia: valor("day"), mes: valor("month"), hora: valor("hour"), minuto: valor("minute") };
}

/** "19/11 09:02", em São Paulo. */
export function dataHoraCurta(data: Date): string {
  const p = partes(data);
  return `${p.dia}/${p.mes} ${p.hora}:${p.minuto}`;
}

/** "hoje 07:00", "ontem 07:00" ou "18/11 07:00", em São Paulo. */
export function dataHoraRelativa(data: Date, agora: Date): string {
  const p = partes(data);
  const hora = `${p.hora}:${p.minuto}`;
  const dia = diaDeSaoPaulo(data);
  if (dia === diaDeSaoPaulo(agora)) return `hoje ${hora}`;
  if (dia === diaDeSaoPaulo(new Date(agora.getTime() - DIA_MS))) return `ontem ${hora}`;
  return `${p.dia}/${p.mes} ${hora}`;
}

/** "Último resumo: hoje 07:00"; sem registro (ou data inválida), "nunca". */
export function textoUltimoResumo(enviadoEm: string | null, agora: Date): string {
  const data = enviadoEm === null ? null : new Date(enviadoEm);
  if (data === null || Number.isNaN(data.getTime())) return "Último resumo: nunca";
  return `Último resumo: ${dataHoraRelativa(data, agora)}`;
}

export interface SituacaoConversa {
  aberta: boolean;
  /** "Aberta até 19/11 09:02", "Fechada desde 18/11 12:01" ou "Fechada: ainda não mandou mensagem" */
  texto: string;
}

/** Mesma regra do envio (janelaAberta): a conversa fecha 24 h depois da última mensagem, menos a margem de segurança. */
export function situacaoDaConversa(ultimaEntrada: Date | null, agora: Date): SituacaoConversa {
  const aberta = janelaAberta(ultimaEntrada, agora);
  if (ultimaEntrada === null) return { aberta, texto: "Fechada: ainda não mandou mensagem" };
  const fim = new Date(ultimaEntrada.getTime() + JANELA_MS - MARGEM_JANELA_MS);
  return { aberta, texto: aberta ? `Aberta até ${dataHoraCurta(fim)}` : `Fechada desde ${dataHoraCurta(fim)}` };
}

const ROTULO_TIPO: Readonly<Record<string, string>> = {
  prazo2: "Prazo em 2 h",
  prazo24: "Prazo em 24 h",
  prazo48: "Prazo em 48 h",
  radar: "Licitação nova",
  sem_responsavel: "Item sem responsável",
  etapa: "Mudança de etapa",
  aviso: "Aviso",
};

export function rotuloTipoAviso(tipo: string): string {
  return ROTULO_TIPO[tipo] ?? "Aviso";
}

const ROTULO_STATUS: Readonly<Record<string, string>> = {
  enviado: "Enviado",
  descartado: "Descartado",
  pendente: "Na fila",
};

export function rotuloStatusAviso(status: string): string {
  return ROTULO_STATUS[status] ?? status;
}
