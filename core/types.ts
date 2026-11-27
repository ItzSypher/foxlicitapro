/**
 * Contrato compartilhado entre o núcleo (core/) e a interface (app/, components/).
 * Qualquer mudança aqui afeta os dois lados.
 */

export type Frente = "servicos" | "produtos";

export type Regiao = "nova-iguacu" | "baixada" | "capital" | "rj" | "fora-rj";

/** Grupo da modalidade no Radar e no Pipeline: 6 = disputa (pregão, concorrência), 8 = contratação direta (dispensa, credenciamento). */
export type ModalidadeId = 6 | 8;

/**
 * Código da modalidade no PNCP que a coleta consulta e o cache guarda:
 * 4 concorrência eletrônica, 5 concorrência presencial, 6 pregão eletrônico, 7 pregão presencial, 8 dispensa, 12 credenciamento.
 * Na `Oportunidade` vale o grupo (`ModalidadeId`); o nome real segue em `modalidadeNome`.
 */
export type ModalidadePncp = 4 | 5 | 6 | 7 | 8 | 12;

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
  /** ISO 8601 da publicação no PNCP; ausente em itens guardados antes de o campo existir */
  dataPublicacao?: string | null;
  dataEncerramento: string;
  anoCompra: number;
  sequencialCompra: number;
  linkPncp: string;
  linkOrigem: string | null;
  /** Página da licitação no Alerta Licitação; presente só nas oportunidades que vieram dessa segunda fonte */
  linkAlerta?: string | null;
}

export type Faixa = "go" | "atencao" | "nogo";

export type CriterioId = "cnae" | "modalidade" | "local" | "documentacao" | "valor" | "caixa";

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
  /** Termo do foco da empresa que casou com o objeto; ausente quando nenhum casou */
  foco?: string;
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
  /** UFs das áreas da empresa que ainda não têm nenhuma coleta; ausente fora do Radar do painel */
  ufsPendentes?: string[];
}
