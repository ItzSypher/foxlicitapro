/**
 * Capital de giro de um edital: quantos dias o dinheiro fica parado entre pagar o fornecedor
 * e receber do órgão. Função pura, sem rede nem banco.
 */

export type NivelCapitalGiro = "baixo" | "medio" | "alto";

export interface EntradaCapitalGiro {
  prazoEntregaDias: number | null;
  prazoPagamentoDias: number | null;
  medicaoMensal: boolean | null;
  pagamentoAntecipado: boolean | null;
}

export interface CapitalGiro {
  /** prazo de entrega + prazo de pagamento; null quando falta um dos dois */
  dias: number | null;
  /** null quando não dá para estimar */
  nivel: NivelCapitalGiro | null;
  motivo: string;
}

/** Até este total de dias o capital de giro é baixo. */
export const LIMITE_BAIXO_DIAS = 30;
/** Até este total é médio; acima, alto. */
export const LIMITE_MEDIO_DIAS = 60;
/** Serviço com medição mensal sem prazo de entrega: o mês de trabalho conta como "entrega". */
export const DIAS_CICLO_MENSAL = 30;

export const NOME_NIVEL: Record<NivelCapitalGiro, string> = { baixo: "baixo", medio: "médio", alto: "alto" };

function inteiroValido(v: number | null): v is number {
  return v !== null && Number.isFinite(v) && v >= 0;
}

function textoDias(n: number): string {
  return `${n} ${n === 1 ? "dia" : "dias"}`;
}

export function calcularCapitalGiro(e: EntradaCapitalGiro): CapitalGiro {
  const ciclo = e.medicaoMensal === true && !inteiroValido(e.prazoEntregaDias);
  const entrega = ciclo ? DIAS_CICLO_MENSAL : inteiroValido(e.prazoEntregaDias) ? e.prazoEntregaDias : null;
  const pagamento = inteiroValido(e.prazoPagamentoDias) ? e.prazoPagamentoDias : null;
  const dias = entrega !== null && pagamento !== null ? Math.round(entrega + pagamento) : null;

  if (e.pagamentoAntecipado === true) {
    return {
      dias,
      nivel: "baixo",
      motivo: "Há pagamento antecipado: o dinheiro entra antes da entrega. Confira a condição.",
    };
  }
  if (dias === null) {
    return { dias: null, nivel: null, motivo: "O edital não traz os dois prazos: não dá para estimar." };
  }
  const nivel: NivelCapitalGiro = dias <= LIMITE_BAIXO_DIAS ? "baixo" : dias <= LIMITE_MEDIO_DIAS ? "medio" : "alto";
  const origem = ciclo
    ? `${textoDias(DIAS_CICLO_MENSAL)} de serviço até a medição`
    : `${textoDias(entrega ?? 0)} de entrega`;
  return {
    dias,
    nivel,
    motivo: `${origem} + ${textoDias(pagamento ?? 0)} para receber: ${textoDias(dias)} com dinheiro parado.`,
  };
}
