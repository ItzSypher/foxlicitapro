import "server-only";
import {
  avisoDesertasNovas,
  avisoNovasDoRamo,
  avisosDeDisputa,
  avisosDeFicha,
  avisosDeOportunidade,
  avisosDePropostaParada,
  type AvisoNovo,
  type ItemComFichaConferida,
} from "@/core/avisos";
import { ufsDeColeta } from "@/core/areas";
import { ehEncerrado } from "@/core/encerradas";
import { recomendar } from "@/core/recomendacao";
import { contarDesertasNovas } from "@/db/desertas";
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

/** Teto da contagem de "novas do ramo" por frente (as recomendações usam 12). */
const LIMITE_NOVAS = 200;
const MS_DIA = 24 * 3_600_000;

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

  // Licitação encerrada saiu do pipeline: não gera aviso de ficha.
  const abertos = itens.filter((i) => !ehEncerrado(i.etapa, i.item.dataEncerramento, agora));

  try {
    const fichas = await listarFichasConferidas(abertos.map((i) => i.id));
    const comFicha: ItemComFichaConferida[] = [];
    for (const i of abertos) {
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
      const noPipeline = new Set(itens.map((i) => i.id));
      candidatos.push(...avisosDeOportunidade(recomendadas, noPipeline, agora));
      // Contagem das novas do ramo: sem o corte de 12 por frente, que serve só para as recomendações.
      const doRamo = [
        ...recomendar(servicos.oportunidades, "servicos", agora, LIMITE_NOVAS, preferencias, perfil),
        ...recomendar(produtos.oportunidades, "produtos", agora, LIMITE_NOVAS, preferencias, perfil),
      ].map((r) => r.item);
      const novas = avisoNovasDoRamo(doRamo, noPipeline, agora);
      if (novas) candidatos.push(novas);
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

/**
 * "N dispensas desertas novas" por empresa, nos estados dela. Roda depois da coleta de desertas do cron;
 * um aviso por empresa e por dia (a chave leva o dia). Falha de uma empresa não derruba as outras.
 */
export async function gerarAvisosDesertas(agora: Date = new Date()): Promise<{ empresas: number; avisos: number }> {
  const ids = await listarIdsEmpresasAtivas().catch((): string[] => []);
  let avisos = 0;
  for (const empresaId of ids) {
    try {
      const perfil = await lerEmpresa(empresaId);
      if (!perfil) continue;
      const total = await contarDesertasNovas(ufsDeColeta(perfil.areas), new Date(agora.getTime() - MS_DIA));
      const aviso = avisoDesertasNovas(total, agora);
      if (!aviso) continue;
      const entrega = await entregarAvisos(empresaId, [aviso], agora);
      avisos += entrega.painel;
    } catch (e) {
      console.error("[avisos] desertas:", e instanceof Error ? e.message : e);
    }
  }
  return { empresas: ids.length, avisos };
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
