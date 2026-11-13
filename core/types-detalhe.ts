/**
 * Contrato do detalhe completo de uma contratação e das propostas.
 * Compartilhado entre core/pncp/detalhe.ts, a tela de licitação e o módulo de propostas.
 */

export interface ChaveCompra {
  cnpj: string;
  ano: number;
  sequencial: number;
}

export interface ItemCompra {
  numero: number;
  descricao: string;
  /** "Material" ou "Serviço", como o PNCP informa */
  tipo: string | null;
  quantidade: number | null;
  unidade: string | null;
  valorUnitarioEstimado: number | null;
  valorTotalEstimado: number | null;
  /** Ex.: "Participação exclusiva para ME/EPP"; null quando não informado */
  beneficio: string | null;
  exclusivoMeEpp: boolean;
  criterioJulgamento: string | null;
  situacao: string | null;
  /** true quando o órgão marcou o orçamento do item como sigiloso */
  sigiloso: boolean;
}

export interface ArquivoCompra {
  sequencial: number;
  titulo: string;
  /** Ex.: "Edital", "Termo de Referência", "Aviso de Contratação Direta" */
  tipo: string | null;
  url: string;
  publicadoEm: string | null;
}

export interface DetalheCompra {
  chave: ChaveCompra;
  numeroControle: string;
  numeroCompra: string | null;
  processo: string | null;
  objeto: string;
  informacaoComplementar: string | null;
  modalidadeId: number;
  modalidadeNome: string;
  modoDisputa: string | null;
  amparoLegal: string | null;
  situacao: string | null;
  srp: boolean;
  orgao: string;
  orgaoCnpj: string;
  unidade: string;
  municipio: string;
  uf: string;
  codigoIbge: string;
  valorEstimado: number | null;
  valorHomologado: number | null;
  /** Quando o órgão incluiu a compra no PNCP; costuma coincidir com a divulgação */
  dataInclusao: string | null;
  dataPublicacao: string | null;
  dataAbertura: string | null;
  dataEncerramento: string | null;
  dataAtualizacao: string | null;
  linkPncp: string;
  linkOrigem: string | null;
  linkProcesso: string | null;
  itens: ItemCompra[];
  /** Total de itens no PNCP; `itens` pode vir limitado */
  totalItens: number;
  arquivos: ArquivoCompra[];
  /** Partes que não carregaram; a tela avisa e segue */
  falhas: Array<"itens" | "arquivos">;
}

export interface ItemProposta {
  numero: number;
  descricao: string;
  unidade: string;
  quantidade: number;
  marcaModelo: string;
  valorUnitario: number;
}

export interface DadosProposta {
  orgao: string;
  unidade: string;
  objeto: string;
  numeroCompra: string;
  processo: string;
  itens: ItemProposta[];
  validadeDias: number;
  prazoEntrega: string;
  localEntrega: string;
  pagamento: string;
  garantia: string;
  observacoes: string;
  /** Data da proposta, ISO (yyyy-mm-dd) */
  data: string;
}

export type StatusProposta = "rascunho" | "pronta" | "enviada";
