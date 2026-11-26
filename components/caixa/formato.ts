const mesPorExtenso = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" });

/** "2026-12" vira "dezembro de 2026". */
export function rotuloDoMes(mes: string): string {
  const data = new Date(`${mes}-01T00:00:00Z`);
  return Number.isNaN(data.getTime()) ? mes : mesPorExtenso.format(data);
}

/** "2026-12-05" vira "05/12". */
export function diaCurto(dia: string): string {
  const [, mes, d] = dia.split("-");
  return mes && d ? `${d}/${mes}` : dia;
}

/** Percentual como o dono digita: "12" ou "12,5". */
export function textoPercentual(valor: number): string {
  return String(valor).replace(".", ",");
}
