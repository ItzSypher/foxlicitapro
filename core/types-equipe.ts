/** Contrato de equipe, revisão de propostas, preferências e assistente. */

export type Papel = "dono" | "gestor";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
}

/** Quem está logado; vem da sessão assinada. */
export interface Sessao {
  usuarioId: string;
  nome: string;
  papel: Papel;
}

export type StatusPropostaEquipe = "rascunho" | "em_revisao" | "aprovada" | "devolvida" | "pronta" | "enviada";

export type AutorProposta = "usuario" | "assistente";

export interface Preferencias {
  /** Termos sem acento e em minúsculas que dão prioridade no "Para você" */
  termosPrioritarios: string[];
  /** Termos que tiram a oportunidade do "Para você" (continua na aba "Todas") */
  termosBloqueadosParaVoce: string[];
  emailsResumo: string[];
  resumoAtivo: boolean;
}

export interface ComentarioPipeline {
  id: number;
  itemId: string;
  autor: string | null;
  texto: string;
  em: string;
}

/** Saída estruturada do assistente ao montar uma proposta. */
export interface AnaliseAssistente {
  modeloId: string;
  resumo: string;
  pegadinhas: string[];
  documentosExigidos: string[];
  sugestoesPorItem: Array<{ numero: number; marcaModelo: string; precoSugerido: number | null; observacao: string }>;
  geradoEm: string;
  modelo: string;
}
