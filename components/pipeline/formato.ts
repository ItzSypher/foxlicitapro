import { MS_DIA, MS_HORA } from "@/lib/formato";

const moedaInteira = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

/** "R$ 37.713" */
export function formatarReais(valor: number): string {
  return moedaInteira.format(valor);
}

/** "Fecha em 3 d", "Fecha em 18 h", "Fecha em 42 min"; null quando o prazo já passou. */
export function textoFecha(restante: number): string | null {
  if (Number.isNaN(restante) || restante <= 0) return null;
  if (restante >= MS_DIA) return `Fecha em ${Math.floor(restante / MS_DIA)} d`;
  if (restante >= MS_HORA) return `Fecha em ${Math.floor(restante / MS_HORA)} h`;
  return `Fecha em ${Math.max(1, Math.floor(restante / 60_000))} min`;
}

function plural(n: number, singular: string, pluralTexto: string): string {
  return n === 1 ? singular : pluralTexto;
}

/** "12 ativas · R$ 184.300 em jogo · 3 ganhas · taxa 60%". Só entra o que tem dado. */
export function linhaDeNumeros(r: {
  ativas: number;
  valorAtivo: number;
  ganhas: number;
  taxaVitoria: number | null;
}): string {
  const partes: string[] = [];
  if (r.ativas > 0) partes.push(`${r.ativas} ${plural(r.ativas, "ativa", "ativas")}`);
  if (r.valorAtivo > 0) partes.push(`${formatarReais(r.valorAtivo)} em jogo`);
  if (r.ganhas > 0) partes.push(`${r.ganhas} ${plural(r.ganhas, "ganha", "ganhas")}`);
  if (r.taxaVitoria !== null) partes.push(`taxa ${Math.round(r.taxaVitoria * 100)}%`);
  return partes.length > 0 ? partes.join(" · ") : "—";
}
