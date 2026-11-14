import "server-only";
import {
  avisosDeDisputa,
  avisosDeFicha,
  avisosDeOportunidade,
  avisosDePropostaParada,
  type AvisoNovo,
  type ItemComFichaConferida,
} from "@/core/avisos";
import { recomendar } from "@/core/recomendacao";
import { listarIdsEmpresasAtivas, lerEmpresa } from "@/db/empresas";
import { listarFichasConferidas } from "@/db/fichas";
import { listarPipeline } from "@/db/pipeline";
import { lerPreferencias } from "@/db/preferencias";
import { listarPropostas } from "@/db/propostas";
import { ENTREGA_VAZIA, entregarAvisos, type ResultadoEntrega } from "@/lib/central-avisos";
import { obterRadar } from "@/lib/radar-dados";

/**
 * Avisos gerados pelo cron diário, por empresa: disputa em 48 h, oportunidade "Para você" com nota alta,
 * ficha conferida que casa com o foco e proposta parada na revisão. Só dados que o painel já tem: não chama o assistente.
 */

export interface ResultadoAvisosEmpresa extends ResultadoEntrega {
  empresaId: string;
  /** Avisos candidatos antes da deduplicação */
  candidatos: number;
  erro?: string;
}

async function gerarEmpresa(empresaId: string, agora: Date): Promise<ResultadoAvisosEmpresa> {
  const candidatos: AvisoNovo[] = [];
  const preferencias = await lerPreferencias(empresaId);

  // Cada fonte falha sozinha: o que deu certo ainda vira aviso.
  const itens = await listarPipeline(empresaId).catch((e: unknown) => {
    console.error("[avisos] pipeline:", e instanceof Error ? e.message : e);
    return [];
  });

  candidatos.push(
    ...avisosDeDisputa(
      itens.map((i) => ({
        id: i.id,
        etapa: i.etapa,
        objeto: i.item.objeto,
        dataEncerramento: i.item.dataEncerramento,
        responsavelId: i.responsavelId,
      })),
      agora,
    ),
  );

  try {
    const fichas = await listarFichasConferidas(itens.map((i) => i.id));
    const comFicha: ItemComFichaConferida[] = [];
    for (const i of itens) {
      const ficha = fichas.get(i.id);
      if (ficha) {
        comFicha.push({ id: i.id, etapa: i.etapa, objeto: i.item.objeto, valorEstimado: i.item.valorEstimado, ficha, responsavelId: i.responsavelId });
      }
    }
    candidatos.push(...avisosDeFicha(comFicha, { capitalMaximo: preferencias.capitalMaximo, diasMaximosParado: preferencias.diasMaximosParado }, agora));
  } catch (e) {
    console.error("[avisos] fichas:", e instanceof Error ? e.message : e);
  }

  try {
    const perfil = await lerEmpresa(empresaId);
    if (perfil) {
      const [servicos, produtos] = await Promise.all([
        obterRadar("servicos", undefined, perfil),
        obterRadar("produtos", undefined, perfil),
      ]);
      const recomendadas = [
        ...recomendar(servicos.oportunidades, "servicos", agora, 12, preferencias, perfil),
        ...recomendar(produtos.oportunidades, "produtos", agora, 12, preferencias, perfil),
      ]
        .sort((a, b) => b.prioridade - a.prioridade)
        .map((r) => r.item);
      candidatos.push(...avisosDeOportunidade(recomendadas, new Set(itens.map((i) => i.id)), agora));
    }
  } catch (e) {
    console.error("[avisos] radar:", e instanceof Error ? e.message : e);
  }

  try {
    const propostas = await listarPropostas(empresaId);
    candidatos.push(
      ...avisosDePropostaParada(
        propostas.map((p) => ({ id: p.id, titulo: p.titulo, status: p.status, atualizadoEm: p.atualizadoEm, criadoPor: p.criadoPor })),
        agora,
      ),
    );
  } catch (e) {
    console.error("[avisos] propostas:", e instanceof Error ? e.message : e);
  }

  const entrega = await entregarAvisos(empresaId, candidatos, agora);
  return { empresaId, candidatos: candidatos.length, ...entrega };
}

/** Avisos de cada empresa ativa, uma por vez. A falha de uma empresa (ou de um canal) não derruba o cron. */
export async function gerarAvisosDiarios(agora: Date = new Date()): Promise<ResultadoAvisosEmpresa[]> {
  const ids = await listarIdsEmpresasAtivas().catch((): string[] => []);
  const resultados: ResultadoAvisosEmpresa[] = [];
  for (const empresaId of ids) {
    try {
      resultados.push(await gerarEmpresa(empresaId, agora));
    } catch (e) {
      const erro = e instanceof Error ? e.message : "falha ao gerar avisos";
      console.error("[avisos]", erro);
      resultados.push({ empresaId, candidatos: 0, ...ENTREGA_VAZIA, erro });
    }
  }
  return resultados;
}
