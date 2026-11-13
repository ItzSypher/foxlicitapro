/**
 * Revisão jurídica no Kanban: checklist fixo que precisa estar completo para o item sair da etapa
 * "Revisão jurídica" para frente. Funções puras, sem banco.
 */
import { ETAPAS, type EtapaId } from "@/components/pipeline/tipos";

export const PASSOS_JURIDICOS = [
  { id: "habilitacao", rotulo: "Habilitação ok" },
  { id: "clausulas_risco", rotulo: "Cláusulas de risco lidas" },
  { id: "garantia_multas", rotulo: "Garantia e multas aceitáveis" },
  { id: "prazos", rotulo: "Prazos viáveis" },
] as const;

export type PassoJuridicoId = (typeof PASSOS_JURIDICOS)[number]["id"];

export function ehPassoJuridico(valor: unknown): valor is PassoJuridicoId {
  return PASSOS_JURIDICOS.some((p) => p.id === valor);
}

/** Quem marcou o passo e quando (ISO). */
export interface MarcaJuridica {
  passo: PassoJuridicoId;
  porId: string | null;
  porNome: string | null;
  em: string;
}

export const ETAPA_REVISAO: EtapaId = "revisao_juridica";

/** Passos que ainda não estão marcados, na ordem do checklist. */
export function passosFaltando(marcas: readonly MarcaJuridica[]): PassoJuridicoId[] {
  const feitos = new Set(marcas.map((m) => m.passo));
  return PASSOS_JURIDICOS.filter((p) => !feitos.has(p.id)).map((p) => p.id);
}

export function checklistCompleto(marcas: readonly MarcaJuridica[]): boolean {
  return passosFaltando(marcas).length === 0;
}

/** "Ok jurídico": dado por quem completou o checklist (a marca mais recente) e quando. Null se incompleto. */
export function okJuridico(marcas: readonly MarcaJuridica[]): { porNome: string | null; em: string } | null {
  if (!checklistCompleto(marcas)) return null;
  let ultima: MarcaJuridica | null = null;
  for (const m of marcas) {
    if (ultima === null || Date.parse(m.em) > Date.parse(ultima.em)) ultima = m;
  }
  return ultima ? { porNome: ultima.porNome, em: ultima.em } : null;
}

/** Ir para uma etapa mais adiante no fluxo. Perdida não conta: desistir não exige revisão. */
export function ehAvanco(de: EtapaId, para: EtapaId): boolean {
  if (para === "perdida") return false;
  const ordem: string[] = ETAPAS.map((e) => e.id);
  return ordem.indexOf(para) > ordem.indexOf(de);
}

export type ValidacaoSaida = { ok: true } | { ok: false; erro: string };

/** Sair de "Revisão jurídica" para frente exige o checklist completo. Qualquer outro movimento passa. */
export function validarSaidaDaRevisao(de: EtapaId, para: EtapaId, marcas: readonly MarcaJuridica[]): ValidacaoSaida {
  if (de !== ETAPA_REVISAO || !ehAvanco(de, para)) return { ok: true };
  const faltam = passosFaltando(marcas);
  if (faltam.length === 0) return { ok: true };
  const rotulos = PASSOS_JURIDICOS.filter((p) => faltam.includes(p.id)).map((p) => p.rotulo.toLowerCase());
  return {
    ok: false,
    erro: `Falta o ok jurídico: ${rotulos.join(", ")}. Quem tem a permissão de revisão jurídica precisa marcar o checklist.`,
  };
}
