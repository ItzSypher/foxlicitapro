/** Prazos do pipeline: agrupa por dia civil de São Paulo e aponta o que fecha sem proposta. */

export type GrupoPrazo = "encerrada" | "hoje" | "amanha" | "semana" | "depois";

/** Ordem em que os grupos aparecem na tela. */
export const GRUPOS_PRAZO: readonly GrupoPrazo[] = ["hoje", "amanha", "semana", "depois", "encerrada"];

export const ROTULO_GRUPO_PRAZO: Record<GrupoPrazo, string> = {
  hoje: "Hoje",
  amanha: "Amanhã",
  semana: "Esta semana",
  depois: "Depois",
  encerrada: "Encerradas",
};

/** Etapas em que ainda falta a proposta ficar pronta (antes de ir à disputa). */
export const ETAPAS_SEM_PROPOSTA_ENVIADA: readonly string[] = [
  "radar",
  "analisando",
  "cotando",
  "revisao_juridica",
  "proposta",
];

interface ComPrazo {
  item: { dataEncerramento: string };
}

interface ComEtapaEProposta extends ComPrazo {
  etapa: string;
  valorProposto: number | null;
}

const MS_DIA = 86_400_000;

const formatoDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const formatoHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Número do dia civil de São Paulo (dias desde 1970), para comparar dias sem erro de fuso ou de horário de verão. */
function numeroDoDia(instante: number): number {
  const partes = formatoDia.formatToParts(new Date(instante));
  const valor = (tipo: string): number => Number(partes.find((p) => p.type === tipo)?.value ?? "0");
  return Math.round(Date.UTC(valor("year"), valor("month") - 1, valor("day")) / MS_DIA);
}

/**
 * Grupo do prazo pelo dia civil de São Paulo: encerrada (o instante já passou), hoje, amanhã,
 * esta semana (até 7 dias à frente) ou depois. Data inválida cai em "depois".
 */
export function grupoDoPrazo(encerramentoIso: string, agora: Date | number): GrupoPrazo {
  const fim = Date.parse(encerramentoIso);
  const agoraMs = typeof agora === "number" ? agora : agora.getTime();
  if (Number.isNaN(fim) || Number.isNaN(agoraMs)) return "depois";
  if (fim < agoraMs) return "encerrada";
  const dias = numeroDoDia(fim) - numeroDoDia(agoraMs);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "amanha";
  if (dias <= 7) return "semana";
  return "depois";
}

/** "HH:mm" do fechamento no horário de São Paulo; vazio se a data for inválida. */
export function horaDoPrazo(encerramentoIso: string): string {
  const fim = Date.parse(encerramentoIso);
  return Number.isNaN(fim) ? "" : formatoHora.format(new Date(fim));
}

function instante(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

/** Mais próximo primeiro; as já encerradas vão para o fim (da mais recente para a mais antiga). Não altera o original. */
export function ordenarPorPrazo<T extends ComPrazo>(itens: readonly T[], agora: Date | number = new Date()): T[] {
  const agoraMs = typeof agora === "number" ? agora : agora.getTime();
  return [...itens].sort((a, b) => {
    const ta = instante(a.item.dataEncerramento);
    const tb = instante(b.item.dataEncerramento);
    const ea = ta < agoraMs;
    const eb = tb < agoraMs;
    if (ea !== eb) return ea ? 1 : -1;
    if (ea) return tb - ta;
    if (ta === tb) return 0;
    return ta < tb ? -1 : 1;
  });
}

/** Itens ainda sem proposta (etapas do radar à proposta pronta, sem valor proposto) que fecham hoje ou amanhã. */
export function pendentesDeProposta<T extends ComEtapaEProposta>(itens: readonly T[], agora: Date | number): T[] {
  const filtrados = itens.filter((i) => {
    if (!ETAPAS_SEM_PROPOSTA_ENVIADA.includes(i.etapa) || i.valorProposto !== null) return false;
    const grupo = grupoDoPrazo(i.item.dataEncerramento, agora);
    return grupo === "hoje" || grupo === "amanha";
  });
  return ordenarPorPrazo(filtrados, agora);
}

/** Agrupa itens já ordenados por prazo, na ordem de GRUPOS_PRAZO e sem grupos vazios. */
export function agruparPorPrazo<T extends ComPrazo>(
  itens: readonly T[],
  agora: Date | number,
): Array<{ grupo: GrupoPrazo; itens: T[] }> {
  const mapa = new Map<GrupoPrazo, T[]>(GRUPOS_PRAZO.map((g) => [g, []]));
  for (const i of ordenarPorPrazo(itens, agora)) mapa.get(grupoDoPrazo(i.item.dataEncerramento, agora))?.push(i);
  return GRUPOS_PRAZO.map((grupo) => ({ grupo, itens: mapa.get(grupo) ?? [] })).filter((g) => g.itens.length > 0);
}
