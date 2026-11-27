/**
 * Campos de site, sistema e software na licitação: leitura do que a pessoa digita, validação das
 * server actions e o texto que cada papel pode ver. Funções puras, sem rede nem banco.
 */
import { z } from "zod";
import { COMISSAO_MAXIMA, COMISSAO_MINIMA } from "./lucro";
import type { ContaSoftware, MesRepasse } from "./custo-software";

/** O que fica gravado no item do pipeline sobre a terceirização. */
export interface DadosSoftware {
  /** null enquanto ninguém respondeu "é terceirizável?" */
  terceirizavel: boolean | null;
  /** Total combinado com o dev */
  devCusto: number | null;
  devParcelas: number | null;
  /** null = entrega única */
  contratoMeses: number | null;
  /** Comissão deste item em %; null = sem comissão */
  comissaoPercentual: number | null;
  /** Menor preço que a empresa aceita dar no lance (o "de" da faixa); null enquanto ninguém disse */
  precoLance: number | null;
  /** Maior preço da faixa do lance (o "até"); null quando é um valor só */
  precoLanceMax: number | null;
  /** Horas por mês do próprio dono quando não terceiriza */
  horasMes: number | null;
}

export const MAXIMO_DEV_CUSTO = 1_000_000_000;
export const MAXIMO_PARCELAS = 60;
export const MAXIMO_MESES_CONTRATO = 120;
export const MAXIMO_HORAS_MES = 744;
export const MAXIMO_LANCE = 1_000_000_000;

const chaveCompra = z.string().regex(/^\d{14}-\d{4}-\d{1,9}$/, "Licitação inválida.");

/** Gestor e dono: terceirização, custo e parcelas do dev, horas próprias, meses de contrato e preço do lance. */
export const entradaSoftwareSchema = z.object({
  compra: chaveCompra,
  terceirizavel: z.boolean().nullable(),
  devCusto: z.number().finite().min(0).max(MAXIMO_DEV_CUSTO).nullable(),
  devParcelas: z.number().int().min(1).max(MAXIMO_PARCELAS).nullable(),
  contratoMeses: z.number().int().min(1).max(MAXIMO_MESES_CONTRATO).nullable(),
  precoLance: z.number().finite().min(0).max(MAXIMO_LANCE).nullable().default(null),
  precoLanceMax: z.number().finite().min(0).max(MAXIMO_LANCE).nullable().default(null),
  horasMes: z.number().int().min(1).max(MAXIMO_HORAS_MES).nullable().default(null),
});
export type EntradaSoftware = z.infer<typeof entradaSoftwareSchema>;

/** Gestor e dono: comissão do item; null = sem comissão. */
export const entradaComissaoSchema = z.object({
  compra: chaveCompra,
  percentual: z.number().finite().min(COMISSAO_MINIMA).max(COMISSAO_MAXIMA).nullable(),
});
export type EntradaComissao = z.infer<typeof entradaComissaoSchema>;

/** Valor em reais como se digita no Brasil ("1.250,50", "R$ 3500"); null se não for número. */
export function lerNumeroDigitado(texto: string): number | null {
  const limpo = texto.replace(/R\$|\s/g, "");
  if (limpo === "" || !/^\d[\d.,]*$/.test(limpo)) return null;
  const normal = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(limpo)
      ? limpo.replace(/\./g, "")
      : limpo;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

/** Inteiro entre `minimo` e `maximo`; null se vazio ou fora da faixa. */
export function lerInteiroDigitado(texto: string, minimo: number, maximo: number): number | null {
  const n = lerNumeroDigitado(texto);
  if (n === null || !Number.isInteger(n) || n < minimo || n > maximo) return null;
  return n;
}

const fmtCurto = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** "Mês 1: recebe 3.500 · comissão 350 · dev 1.000 · você 2.150" (sem comissão, essa parte some). */
export function linhaRepasse(m: MesRepasse, rotuloComissao = "comissão"): string {
  const partes = [`recebe ${fmtCurto.format(m.recebe)}`];
  if (m.comissao > 0) partes.push(`${rotuloComissao} ${fmtCurto.format(m.comissao)}`);
  if (m.dev > 0) partes.push(`dev ${fmtCurto.format(m.dev)}`);
  partes.push(`você ${fmtCurto.format(m.dono)}`);
  return `Mês ${m.mes}: ${partes.join(" · ")}`;
}

/**
 * Motivo do veredito para a tela. O motivo "vale" da conta cita a sobra e a margem, que só o dono vê:
 * para os demais vira uma frase sem valores do dono.
 */
export function motivoVisivel(conta: Pick<ContaSoftware, "veredito" | "motivo">, ehDono: boolean): string {
  if (ehDono || conta.veredito !== "vale") return conta.motivo;
  return "Dentro do mínimo e do teto do dev";
}
