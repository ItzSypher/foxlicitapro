const FUSO = "America/Sao_Paulo";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const moedaInteira = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const hora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dataExtenso = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const MS_HORA = 3_600_000;
export const MS_DIA = 24 * MS_HORA;

export function formatarMoeda(valor: number): string {
  return moeda.format(valor);
}

/** "R$ 37.713" a partir de mil reais; abaixo disso mantém os centavos. */
export function formatarMoedaCurta(valor: number): string {
  return Math.abs(valor) >= 1000 ? moedaInteira.format(valor) : moeda.format(valor);
}

export function formatarHora(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? "--:--" : hora.format(data);
}

/** "quinta-feira, 12 de novembro de 2026 às 14:30" */
export function formatarEncerramento(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "Data não informada";
  return `${dataExtenso.format(data)} às ${hora.format(data)}`;
}

/** 14 dígitos viram 00.000.000/0000-00; qualquer outra coisa volta como veio. */
export function formatarCnpj(cnpj: string): string {
  const digitos = cnpj.replace(/\D/g, "");
  if (digitos.length !== 14) return cnpj;
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`;
}

const dois = (n: number): string => String(n).padStart(2, "0");

/** Milissegundos restantes até o encerramento; NaN quando a data é inválida. */
export function restanteMs(encerramentoIso: string, agora: number): number {
  return Date.parse(encerramentoIso) - agora;
}

/** "3d 04h" a partir de 24 h; "05:42:10" abaixo disso; "Encerrada" depois do prazo. */
export function formatarContagem(restante: number): string {
  if (Number.isNaN(restante)) return "—";
  if (restante <= 0) return "Encerrada";
  if (restante < MS_DIA) {
    const total = Math.floor(restante / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${dois(h)}:${dois(m)}:${dois(s)}`;
  }
  const dias = Math.floor(restante / MS_DIA);
  const horas = Math.floor((restante % MS_DIA) / MS_HORA);
  return `${dias}d ${dois(horas)}h`;
}

/** Quantidade de tempo restante em unidade única: "3 d", "18 h", "40 min". */
export function formatarRestanteCurto(restante: number): string {
  if (Number.isNaN(restante)) return "—";
  if (restante <= 0) return "0 min";
  if (restante >= MS_DIA) return `${Math.floor(restante / MS_DIA)} d`;
  if (restante >= MS_HORA) return `${Math.floor(restante / MS_HORA)} h`;
  return `${Math.max(1, Math.floor(restante / 60_000))} min`;
}

export function plural(n: number, singular: string, pluralTexto: string): string {
  return n === 1 ? singular : pluralTexto;
}
