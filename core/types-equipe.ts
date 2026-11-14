/** Contrato de equipe, revisão de propostas, preferências e assistente. */

import type { Permissao } from "@/core/permissoes";

export type Papel = "dono" | "gestor" | "juridico";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
  /** Empresa a que a pessoa pertence */
  empresaId: string;
  /** Administra todas as empresas (tela /admin/empresas) */
  superadmin: boolean;
  permissoes: Permissao[];
  /** Propostas por dia que a pessoa pode montar com o assistente (o dono não tem limite) */
  limitePropostasAssistenteDia: number;
}

/** O que vai assinado no cookie: identidade e papel. As permissões vêm do banco a cada pedido. */
export interface SessaoToken {
  usuarioId: string;
  nome: string;
  papel: Papel;
}

/** Quem está logado. */
export interface Sessao extends SessaoToken {
  /** Empresa da pessoa, lida do banco a cada pedido: todo dado da empresa se filtra por ela */
  empresaId: string;
  superadmin: boolean;
  permissoes: Permissao[];
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
  /** R$ máximo que o dono aceita pagar antes de receber, por licitação; null = sem limite */
  capitalMaximo: number | null;
  /** Dias máximos com o dinheiro parado; null = sem limite */
  diasMaximosParado: number | null;
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
