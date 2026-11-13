/** Limite diário de propostas montadas pelo assistente (funções puras: data e fuso entram por parâmetro). */

export const FUSO_PADRAO = "America/Sao_Paulo";

export type CotaAssistente =
  | { ilimitada: true }
  | { ilimitada: false; limite: number; usadas: number; restantes: number };

interface Partes {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

function partesNoFuso(instante: number, fuso: string): Partes {
  const formato = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const valores: Record<string, number> = {};
  for (const p of formato.formatToParts(new Date(instante))) {
    if (p.type !== "literal") valores[p.type] = Number(p.value);
  }
  return {
    ano: valores.year,
    mes: valores.month,
    dia: valores.day,
    hora: valores.hour,
    minuto: valores.minute,
    segundo: valores.second,
  };
}

/** Diferença, em ms, entre o relógio local do fuso e o UTC naquele instante. */
function deslocamento(instante: number, fuso: string): number {
  const p = partesNoFuso(instante, fuso);
  const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return comoUtc - Math.floor(instante / 1000) * 1000;
}

/** Instante UTC em que o relógio do fuso marca meia-noite do dia dado. */
function meiaNoite(ano: number, mes: number, dia: number, fuso: string): number {
  const alvo = Date.UTC(ano, mes - 1, dia);
  let palpite = alvo - deslocamento(alvo, fuso);
  palpite = alvo - deslocamento(palpite, fuso);
  return palpite;
}

/** Começo (inclusive) e fim (exclusive) do dia de `agora` no fuso. */
export function intervaloDoDia(agora: Date, fuso: string = FUSO_PADRAO): { inicio: Date; fim: Date } {
  const p = partesNoFuso(agora.getTime(), fuso);
  const inicio = meiaNoite(p.ano, p.mes, p.dia, fuso);
  // Meio-dia do dia seguinte (UTC puro) cai sempre dentro do dia seguinte; dele sai a data local.
  const seguinte = new Date(Date.UTC(p.ano, p.mes - 1, p.dia + 1, 12));
  const fim = meiaNoite(seguinte.getUTCFullYear(), seguinte.getUTCMonth() + 1, seguinte.getUTCDate(), fuso);
  return { inicio: new Date(inicio), fim: new Date(fim) };
}

export function calcularCota(entrada: { ehDono: boolean; limite: number; usadas: number }): CotaAssistente {
  if (entrada.ehDono) return { ilimitada: true };
  const limite = Math.max(0, Math.trunc(entrada.limite));
  const usadas = Math.max(0, Math.trunc(entrada.usadas));
  return { ilimitada: false, limite, usadas, restantes: Math.max(0, limite - usadas) };
}

export function podeMontar(cota: CotaAssistente): boolean {
  return cota.ilimitada || cota.restantes > 0;
}

export function mensagemLimiteAtingido(limite: number): string {
  const n = Math.max(0, Math.trunc(limite));
  const propostas = n === 1 ? "1 proposta" : `${n} propostas`;
  return `Você já criou ${propostas} com o assistente hoje. Tente amanhã.`;
}

/** Texto curto para perto do botão; vazio quando não há limite. */
export function textoRestantes(cota: CotaAssistente): string {
  if (cota.ilimitada) return "";
  return cota.restantes === 1 ? "Resta 1 hoje" : `Restam ${cota.restantes} hoje`;
}
