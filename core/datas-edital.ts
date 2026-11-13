/**
 * Datas da contratação como o PNCP mostra, em linha do tempo. Funções puras: o relógio entra por parâmetro.
 * Tudo no fuso de Brasília.
 */

const FUSO = "America/Sao_Paulo";
const MS_MINUTO = 60_000;
const MS_HORA = 60 * MS_MINUTO;
const MS_DIA = 24 * MS_HORA;

const fmtDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "16/11/2026 08:00" no horário de Brasília; data inválida vira null. */
export function formatarDataHoraBrasilia(iso: string | null): string | null {
  if (iso === null) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : fmtDataHora.format(d).replace(", ", " ");
}

export type IdEventoData = "inclusao" | "publicacao" | "inicio-propostas" | "fim-propostas" | "atualizacao";

export interface DatasDoDetalhe {
  dataInclusao: string | null;
  dataPublicacao: string | null;
  dataAbertura: string | null;
  dataEncerramento: string | null;
  dataAtualizacao: string | null;
}

export interface EventoData {
  id: IdEventoData;
  rotulo: string;
  iso: string;
  /** "16/11/2026 08:00" */
  texto: string;
  /** já aconteceu no instante `agora` */
  passou: boolean;
  /** é o fim do recebimento de propostas, que é também a sessão da disputa */
  disputa: boolean;
}

const ROTULOS: Record<IdEventoData, string> = {
  inclusao: "Inclusão no PNCP",
  publicacao: "Divulgação no PNCP",
  "inicio-propostas": "Início do recebimento de propostas",
  "fim-propostas": "Fim das propostas e disputa",
  atualizacao: "Última atualização",
};

function instante(iso: string | null): number | null {
  if (iso === null) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/**
 * Eventos em ordem cronológica. Data ausente ou inválida não entra.
 * A inclusão só aparece quando difere da divulgação (na maioria dos casos é o mesmo instante).
 */
export function montarLinhaDoTempo(d: DatasDoDetalhe, agora: number): EventoData[] {
  const publicacao = instante(d.dataPublicacao);
  const candidatos: Array<{ id: IdEventoData; iso: string | null }> = [
    { id: "inclusao", iso: instante(d.dataInclusao) !== null && instante(d.dataInclusao) === publicacao ? null : d.dataInclusao },
    { id: "publicacao", iso: d.dataPublicacao },
    { id: "inicio-propostas", iso: d.dataAbertura },
    { id: "fim-propostas", iso: d.dataEncerramento },
    { id: "atualizacao", iso: d.dataAtualizacao },
  ];
  const eventos: Array<EventoData & { t: number; ordem: number }> = [];
  candidatos.forEach((c, ordem) => {
    const t = instante(c.iso);
    const texto = formatarDataHoraBrasilia(c.iso);
    if (c.iso === null || t === null || texto === null) return;
    eventos.push({
      id: c.id,
      rotulo: ROTULOS[c.id],
      iso: c.iso,
      texto,
      passou: t <= agora,
      disputa: c.id === "fim-propostas",
      t,
      ordem,
    });
  });
  eventos.sort((a, b) => a.t - b.t || a.ordem - b.ordem);
  return eventos.map((e) => ({ id: e.id, rotulo: e.rotulo, iso: e.iso, texto: e.texto, passou: e.passou, disputa: e.disputa }));
}

function unidade(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * "faltam 3 dias e 4 h", "faltam 5 h e 12 min", "faltam 40 min".
 * Null quando a data é inválida; "encerrado" quando o instante já passou.
 */
export function textoFaltam(alvoIso: string, agora: number): string | null {
  const alvo = instante(alvoIso);
  if (alvo === null) return null;
  const restante = alvo - agora;
  if (restante <= 0) return "encerrado";
  if (restante >= MS_DIA) {
    const dias = Math.floor(restante / MS_DIA);
    const horas = Math.floor((restante % MS_DIA) / MS_HORA);
    const base = unidade(dias, "dia", "dias");
    return `${dias === 1 ? "falta" : "faltam"} ${horas > 0 ? `${base} e ${horas} h` : base}`;
  }
  if (restante >= MS_HORA) {
    const horas = Math.floor(restante / MS_HORA);
    const minutos = Math.floor((restante % MS_HORA) / MS_MINUTO);
    return `${horas === 1 ? "falta" : "faltam"} ${minutos > 0 ? `${horas} h e ${minutos} min` : `${horas} h`}`;
  }
  const minutos = Math.max(1, Math.floor(restante / MS_MINUTO));
  return `${minutos === 1 ? "falta" : "faltam"} ${minutos} min`;
}
