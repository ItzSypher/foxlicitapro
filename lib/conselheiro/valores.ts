import type { SaidaConselheiro } from "./esquema";

/**
 * Conferência da regra de ouro: todo valor em reais que a resposta cita precisa ser um dos números que o sistema
 * entregou. Funções puras.
 */

const VALOR_EM_REAIS = /R\$\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)(\s*(?:milh(?:ao|oes|ão|ões)|mil))?/gi;
/** Diferença aceita ao comparar (arredondamento do texto). */
const TOLERANCIA_RELATIVA = 0.01;
const TOLERANCIA_MINIMA = 0.5;

function paraNumero(texto: string, sufixo: string | undefined): number {
  const base = Number(texto.replace(/\./g, "").replace(",", "."));
  const s = (sufixo ?? "").trim().toLowerCase();
  if (s.startsWith("milh")) return base * 1_000_000;
  if (s === "mil") return base * 1_000;
  return base;
}

function casa(valor: number, permitidos: readonly number[]): boolean {
  return permitidos.some((p) => Math.abs(p - valor) <= Math.max(TOLERANCIA_MINIMA, Math.abs(p) * TOLERANCIA_RELATIVA));
}

/** Trechos "R$ ..." dos textos que não batem com nenhum valor permitido (sem repetir). */
export function valoresEstranhos(textos: readonly string[], permitidos: readonly number[]): string[] {
  const achados = new Set<string>();
  for (const texto of textos) {
    for (const m of texto.matchAll(VALOR_EM_REAIS)) {
      const valor = paraNumero(m[1], m[2]);
      if (!Number.isFinite(valor) || valor === 0) continue;
      if (!casa(valor, permitidos)) achados.add(m[0].trim());
    }
  }
  return [...achados];
}

/** Todos os textos da análise, para conferir de uma vez. */
export function textosDaSaida(s: SaidaConselheiro): string[] {
  return [
    s.resumo,
    ...s.porQue,
    ...s.comoConseguir.flatMap((c) => [c.canal, c.prazoTipico, ...c.passos, ...c.cuidados]),
    s.precoComentario,
    ...s.riscos,
    ...s.proximosPassos,
    s.modalidade.observacao,
  ];
}

/** Aviso mostrado quando a resposta cita valores que o sistema não calculou. */
export const AVISO_VALORES_ESTRANHOS =
  "A análise cita valores em reais que o sistema não calculou. Use só os números do bloco de preço sugerido.";
