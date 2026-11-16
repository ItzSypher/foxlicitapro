/**
 * Fechamento de uma licitação (ganha ou perdida): motivos de perda e a conta de lucro e margem.
 * Funções puras, sem dependências: valem no servidor e no navegador.
 */

export const MOTIVOS_PERDA = ["preco", "documentacao", "prazo", "desclassificado", "outro"] as const;
export type MotivoPerda = (typeof MOTIVOS_PERDA)[number];

export const ROTULO_MOTIVO: Record<MotivoPerda, string> = {
  preco: "Preço",
  documentacao: "Documentação",
  prazo: "Prazo",
  desclassificado: "Desclassificado",
  outro: "Outro",
};

export function ehMotivoPerda(valor: unknown): valor is MotivoPerda {
  return typeof valor === "string" && (MOTIVOS_PERDA as readonly string[]).includes(valor);
}

export interface LucroMargem {
  /** Valor homologado menos custo real; null sem custo informado */
  lucro: number | null;
  /** Lucro dividido pelo valor, de 0 a 1 (negativa no prejuízo); null sem custo ou com valor zerado */
  margem: number | null;
}

export function calcularLucro(valor: number | null, custo: number | null): LucroMargem {
  if (custo === null || valor === null) return { lucro: null, margem: null };
  const lucro = valor - custo;
  return { lucro, margem: valor > 0 ? lucro / valor : null };
}
