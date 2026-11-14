import "server-only";
import {
  avisoItemAtribuido,
  avisoJuridicoPendente,
  avisoPropostaEmRevisao,
  avisoPropostaRevisada,
  type AvisoNovo,
} from "@/core/avisos";
import { entregarAvisos } from "@/lib/central-avisos";

/**
 * Avisos dos eventos da equipe (proposta para revisão, aprovada ou devolvida, item atribuído, ok jurídico pendente).
 * Chamados dentro de `after()`: nunca lançam erro. Cada aviso vai para o painel e, conforme a escolha de cada pessoa,
 * por e-mail e WhatsApp (e-mail não configurado não é falha).
 */

async function publicar(empresaId: string, aviso: AvisoNovo | null): Promise<void> {
  if (aviso === null) return;
  try {
    await entregarAvisos(empresaId, [aviso]);
  } catch (e) {
    console.error("[aviso]", e instanceof Error ? e.message : e);
  }
}

export async function avisarPropostaEmRevisao(p: { empresaId: string; id: string; titulo: string; autorId: string; autorNome: string }): Promise<void> {
  await publicar(p.empresaId, avisoPropostaEmRevisao({ id: p.id, titulo: p.titulo, autorId: p.autorId, autorNome: p.autorNome, em: new Date() }));
}

export async function avisarPropostaRevisada(p: {
  empresaId: string;
  id: string;
  titulo: string;
  autorId: string | null;
  revisorId: string;
  revisorNome: string;
  aprovada: boolean;
  nota: string | null;
}): Promise<void> {
  await publicar(
    p.empresaId,
    avisoPropostaRevisada({
      id: p.id,
      titulo: p.titulo,
      autorId: p.autorId,
      revisorId: p.revisorId,
      revisorNome: p.revisorNome,
      aprovada: p.aprovada,
      nota: p.nota,
      em: new Date(),
    }),
  );
}

export async function avisarResponsavel(p: {
  empresaId: string;
  itemId: string;
  objeto: string;
  responsavelId: string;
  porId: string;
  porNome: string;
}): Promise<void> {
  await publicar(
    p.empresaId,
    avisoItemAtribuido({ itemId: p.itemId, objeto: p.objeto, responsavelId: p.responsavelId, porId: p.porId, porNome: p.porNome, em: new Date() }),
  );
}

/** Item entrou na revisão jurídica: quem tem a permissão de revisão jurídica (e o dono) fica sabendo. */
export async function avisarJuridicoPendente(p: { empresaId: string; itemId: string; objeto: string; porId: string }): Promise<void> {
  await publicar(p.empresaId, avisoJuridicoPendente({ itemId: p.itemId, objeto: p.objeto, porId: p.porId, em: new Date() }));
}
