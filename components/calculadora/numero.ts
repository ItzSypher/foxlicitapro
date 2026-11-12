/**
 * Leitura de números digitados no padrão brasileiro. Função pura, sem dependência de React.
 *
 * Aceita "1.234,56", "1234,56", "1234.56", "1,234.56", "R$ 1.234,56" e "-3".
 * Um único ponto seguido de exatamente três dígitos ("1.234") conta como milhar,
 * porque é assim que o brasileiro escreve; "0.125" e "12.5" continuam decimais.
 *
 * Retorno: o número; null quando o texto está vazio; NaN quando não é um número.
 */
export function parseNumeroBR(texto: string): number | null {
  const limpo = texto.replace(/R\$/gi, "").replace(/\s/g, "");
  if (limpo === "") return null;

  const negativo = limpo.startsWith("-");
  const corpo = negativo ? limpo.slice(1) : limpo;
  if (!/^[\d.,]+$/.test(corpo) || !/\d/.test(corpo)) return Number.NaN;

  const ultimaVirgula = corpo.lastIndexOf(",");
  const ultimoPonto = corpo.lastIndexOf(".");
  let normalizado: string;

  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    // Os dois aparecem: o que vem por último é o decimal, o outro é milhar.
    const [decimal, milhar] = ultimaVirgula > ultimoPonto ? [",", "."] : [".", ","];
    if (corpo.split(decimal).length > 2) return Number.NaN;
    normalizado = corpo.split(milhar).join("").replace(decimal, ".");
  } else if (ultimaVirgula >= 0) {
    if (corpo.split(",").length > 2) return Number.NaN;
    normalizado = corpo.replace(",", ".");
  } else if (ultimoPonto >= 0) {
    const partes = corpo.split(".");
    const gruposDeMilhar = partes.slice(1).every((p) => p.length === 3);
    if (partes.length > 2 && !gruposDeMilhar) return Number.NaN;
    const comoMilhar =
      gruposDeMilhar && partes[0].length >= 1 && partes[0].length <= 3 && partes[0] !== "0" && partes[0] !== "";
    normalizado = comoMilhar ? partes.join("") : corpo;
  } else {
    normalizado = corpo;
  }

  if (!/^\d+(\.\d+)?$/.test(normalizado)) return Number.NaN;
  const valor = Number(normalizado);
  if (!Number.isFinite(valor)) return Number.NaN;
  return negativo ? -valor : valor;
}

/** Número para o campo de texto, no padrão brasileiro e sem separador de milhar: 1234,5. */
export function formatarNumeroBR(valor: number, casas = 2): string {
  if (!Number.isFinite(valor)) return "";
  return new Intl.NumberFormat("pt-BR", {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: casas,
  }).format(valor);
}

/** Fração (0,12) para o campo de percentual ("12"), sem resíduo de ponto flutuante. */
export function fracaoParaCampoPercentual(fracao: number): string {
  return formatarNumeroBR(Math.round(fracao * 10000) / 100, 2);
}
