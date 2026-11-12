/**
 * Contrato compartilhado entre o núcleo (core/) e a interface (app/, components/).
 * Qualquer mudança aqui afeta os dois lados.
 */

export type Frente = "servicos" | "produtos";

export type Regiao = "nova-iguacu" | "baixada" | "capital" | "rj" | "fora-rj";

export type ModalidadeId = 6 | 8;

export interface Oportunidade {
  /** numeroControlePNCP */
  id: string;
  objeto: string;
  /** null quando o órgão marca o valor como sigiloso ou não informa */
  valorEstimado: number | null;
  orgao: string;
  orgaoCnpj: string;
  unidade: string;
  municipio: string;
  codigoIbge: string;
  uf: string;
  regiao: Regiao;
  modalidadeId: ModalidadeId;
  modalidadeNome: string;
  /** ISO 8601 com fuso de Brasília */
  dataAbertura: string | null;
  dataEncerramento: string;
  anoCompra: number;
  sequencialCompra: number;
  linkPncp: string;
  linkOrigem: string | null;
}

export type Faixa = "go" | "atencao" | "nogo";

export type CriterioId = "cnae" | "modalidade" | "local" | "documentacao" | "valor";

export interface Criterio {
  id: CriterioId;
  rotulo: string;
  pontos: number;
  maximo: number;
  /** Frase curta que explica a pontuação, mostrada ao usuário */
  motivo: string;
  /** true quando a pontuação só se confirma lendo o edital */
  aConfirmar: boolean;
}

export interface Score {
  total: number;
  faixa: Faixa;
  criterios: Criterio[];
  /** Códigos CNAE que casaram com o objeto, na frente ativa primeiro */
  cnaesCasados: string[];
  /** Frente em que o objeto casou melhor; null sem match */
  frenteCasada: Frente | null;
  /** Avisos curtos que merecem atenção antes de abrir o edital; ausente quando não há nenhum */
  alertas?: string[];
}

export interface OportunidadeComScore extends Oportunidade {
  score: Score;
}

export interface RespostaRadar {
  oportunidades: OportunidadeComScore[];
  /** ISO 8601 do momento em que os dados foram buscados no PNCP */
  atualizadoEm: string;
  /** Modalidades cuja busca falhou; a lista pode vir parcial */
  falhas: ModalidadeId[];
}
