/** Papéis e permissões da equipe (funções puras, sem banco). O dono tem tudo, sempre. */
import type { AcaoRevisao } from "@/core/revisao";
import type { Papel } from "@/core/types-equipe";

export const PERMISSOES = [
  "mover_pipeline",
  "editar_propostas",
  "aprovar_propostas",
  "revisao_juridica",
  "usar_assistente",
  "editar_preferencias",
] as const;

export type Permissao = (typeof PERMISSOES)[number];

export const PAPEIS: readonly Papel[] = ["dono", "gestor", "juridico"];

export const ROTULO_PERMISSAO: Record<Permissao, string> = {
  mover_pipeline: "Mexer no pipeline",
  editar_propostas: "Criar e editar propostas",
  aprovar_propostas: "Aprovar propostas",
  revisao_juridica: "Revisão jurídica",
  usar_assistente: "Usar o assistente",
  editar_preferencias: "Editar preferências",
};

export const ROTULO_PAPEL: Record<Papel, string> = {
  dono: "Dono",
  gestor: "Gestor",
  juridico: "Jurídico",
};

export const LIMITE_ASSISTENTE_PADRAO = 3;

const PADRAO_POR_PAPEL: Record<Papel, readonly Permissao[]> = {
  dono: PERMISSOES,
  gestor: ["mover_pipeline", "editar_propostas", "aprovar_propostas", "usar_assistente"],
  juridico: ["revisao_juridica", "usar_assistente"],
};

export function ehPapel(valor: unknown): valor is Papel {
  return valor === "dono" || valor === "gestor" || valor === "juridico";
}

export function ehPermissao(valor: unknown): valor is Permissao {
  return typeof valor === "string" && (PERMISSOES as readonly string[]).includes(valor);
}

/** Permissões sugeridas ao criar alguém com o papel. */
export function permissoesPadrao(papel: Papel): Permissao[] {
  return [...PADRAO_POR_PAPEL[papel]];
}

/** Mantém só permissões conhecidas, sem repetir e na ordem do conjunto fechado. Valores soltos do banco são descartados. */
export function normalizarPermissoes(bruto: readonly unknown[]): Permissao[] {
  const pedidas = new Set(bruto.filter(ehPermissao));
  return PERMISSOES.filter((p) => pedidas.has(p));
}

/** Dono passa em tudo; os demais, só no que está na lista. */
export function temPermissao(pessoa: { papel: Papel; permissoes: readonly Permissao[] }, permissao: Permissao): boolean {
  return pessoa.papel === "dono" || pessoa.permissoes.includes(permissao);
}

/**
 * Permissões que liberam cada passo da revisão de propostas (basta uma delas).
 * Aprovar e reabrir pedem aprovar_propostas; devolver com nota também vale para a revisão jurídica.
 */
export function permissoesDaAcaoRevisao(acao: AcaoRevisao): Permissao[] {
  switch (acao) {
    case "enviar":
    case "retirar":
      return ["editar_propostas"];
    case "aprovar":
    case "reabrir":
      return ["aprovar_propostas"];
    case "devolver":
      return ["aprovar_propostas", "revisao_juridica"];
  }
}

export function podeAgirNaRevisao(pessoa: { papel: Papel; permissoes: readonly Permissao[] }, acao: AcaoRevisao): boolean {
  return permissoesDaAcaoRevisao(acao).some((p) => temPermissao(pessoa, p));
}
