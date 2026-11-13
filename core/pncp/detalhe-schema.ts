import { z } from "zod";

/**
 * Modelado a partir de retornos reais do PNCP (conferido em 12/11/2026):
 *  - GET /api/consulta/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}
 *  - GET /api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens
 *  - GET /api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/arquivos
 * Só entram os campos usados; o restante é ignorado e campos opcionais aceitam nulo.
 */

const texto = z.string().nullish();
const numero = z.number().nullish();

export const compraSchema = z.object({
  numeroControlePNCP: z.string().min(1),
  numeroCompra: texto,
  processo: texto,
  objetoCompra: texto,
  informacaoComplementar: texto,
  modalidadeId: z.number(),
  modalidadeNome: texto,
  modoDisputaNome: texto,
  amparoLegal: z.object({ nome: texto, descricao: texto }).nullish(),
  situacaoCompraNome: texto,
  srp: z.boolean().nullish(),
  orgaoEntidade: z.object({ cnpj: z.string().min(1), razaoSocial: texto }),
  unidadeOrgao: z.object({
    ufSigla: texto,
    municipioNome: texto,
    codigoIbge: z.union([z.string(), z.number()]).nullish(),
    nomeUnidade: texto,
  }),
  /** A API manda 0 quando o valor é sigiloso */
  valorTotalEstimado: numero,
  valorTotalHomologado: numero,
  /** 1 = compra sem sigilo; 3 = totalmente sigilosa */
  orcamentoSigilosoCodigo: numero,
  dataInclusao: texto,
  dataPublicacaoPncp: texto,
  dataAberturaProposta: texto,
  dataEncerramentoProposta: texto,
  dataAtualizacao: texto,
  dataAtualizacaoGlobal: texto,
  linkSistemaOrigem: texto,
  linkProcessoEletronico: texto,
});

export type CompraPncp = z.infer<typeof compraSchema>;

/** Item de /itens. Chega como `unknown` na lista para um item ruim não derrubar os outros. */
export const itemSchema = z.object({
  numeroItem: z.number().int(),
  descricao: texto,
  materialOuServicoNome: texto,
  valorUnitarioEstimado: numero,
  valorTotal: numero,
  quantidade: numero,
  unidadeMedida: texto,
  orcamentoSigiloso: z.boolean().nullish(),
  criterioJulgamentoNome: texto,
  situacaoCompraItemNome: texto,
  /** 1 = exclusiva ME/EPP; 4 = sem benefício; 5 = não se aplica */
  tipoBeneficio: numero,
  tipoBeneficioNome: texto,
});

export type ItemPncp = z.infer<typeof itemSchema>;

export const listaSchema = z.array(z.unknown());

export const arquivoSchema = z.object({
  sequencialDocumento: z.number().int(),
  titulo: texto,
  tipoDocumentoNome: texto,
  url: texto,
  uri: texto,
  dataPublicacaoPncp: texto,
  statusAtivo: z.boolean().nullish(),
});

export type ArquivoPncp = z.infer<typeof arquivoSchema>;
