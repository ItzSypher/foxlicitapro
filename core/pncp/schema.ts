import { z } from "zod";

/**
 * Modelado a partir do retorno real de
 * GET /api/consulta/v1/contratacoes/proposta (conferido em 10/11/2026).
 * Só entram os campos que o núcleo usa; o restante é ignorado.
 * Campos que a API pode devolver nulos ou ausentes são tolerados.
 */

const textoOpcional = z.string().nullish();

export const orgaoEntidadeSchema = z.object({
  cnpj: z.string().min(1),
  razaoSocial: textoOpcional,
});

export const unidadeOrgaoSchema = z.object({
  ufSigla: textoOpcional,
  ufNome: textoOpcional,
  municipioNome: textoOpcional,
  codigoIbge: z.union([z.string(), z.number()]).nullish(),
  nomeUnidade: textoOpcional,
  codigoUnidade: textoOpcional,
});

export const contratacaoSchema = z.object({
  numeroControlePNCP: z.string().min(1),
  objetoCompra: textoOpcional,
  /** A API manda 0 quando o valor é sigiloso */
  valorTotalEstimado: z.number().nullish(),
  orgaoEntidade: orgaoEntidadeSchema,
  unidadeOrgao: unidadeOrgaoSchema,
  modalidadeId: z.number(),
  modalidadeNome: textoOpcional,
  /** Data e hora sem fuso, ex.: "2026-11-06T11:00:00" */
  dataAberturaProposta: textoOpcional,
  dataEncerramentoProposta: textoOpcional,
  anoCompra: z.number().int(),
  sequencialCompra: z.number().int(),
  linkSistemaOrigem: textoOpcional,
  linkProcessoEletronico: textoOpcional,
});

export type ContratacaoPncp = z.infer<typeof contratacaoSchema>;

/**
 * Envelope da página. Os itens ficam como `unknown` para que um item fora do
 * padrão seja descartado sozinho, sem derrubar a página inteira.
 */
export const paginaSchema = z.object({
  data: z.array(z.unknown()),
  totalRegistros: z.number().nullish(),
  totalPaginas: z.number().nullish(),
  numeroPagina: z.number().nullish(),
  paginasRestantes: z.number().nullish(),
  empty: z.boolean().nullish(),
});

export type PaginaPncp = z.infer<typeof paginaSchema>;
