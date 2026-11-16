import {
  buscarContratacoesDetalhadas,
  type OpcoesBusca,
  type ResultadoModalidadeDetalhado,
} from "@/core/pncp/client";
import { normalizarLista } from "@/core/pncp/normalize";
import type { LimitesCaixa } from "@/core/caixa";
import { PERFIL_ORIGEM } from "@/core/empresa";
import type { PerfilEmpresa } from "@/core/perfil";
import { pontuarEOrdenar } from "@/core/radar";
import type { Oportunidade, OportunidadeComScore } from "@/core/types";
import { LIMITES_FORA_RJ, UF_BRASIL_TODO, type BuscaForaRj, type ResultadoForaRj } from "./fora-rj-busca";
import { filtrarPorTexto } from "./radar-filtros";

/**
 * Consulta ao PNCP da busca sob demanda fora do RJ. Não passa pelo cache diário
 * nem grava no banco: cada busca lê o PNCP na hora, com os limites de `LIMITES_FORA_RJ`.
 */

/** Opções da consulta ao PNCP para essa busca. */
export function opcoesPncpForaRj(busca: BuscaForaRj, agora: Date): OpcoesBusca {
  return {
    agora,
    uf: busca.uf === UF_BRASIL_TODO ? null : busca.uf,
    ...(busca.codigoMunicipioIbge ? { codigoMunicipioIbge: busca.codigoMunicipioIbge } : {}),
    maxPaginas: LIMITES_FORA_RJ.maxPaginas,
    diasAFrente: LIMITES_FORA_RJ.diasAFrente,
    timeoutMs: LIMITES_FORA_RJ.timeoutMs,
    esperasRetryMs: [700],
  };
}

function ordemPorNota(a: OportunidadeComScore, b: OportunidadeComScore): number {
  return b.score.total - a.score.total || Date.parse(a.dataEncerramento) - Date.parse(b.dataEncerramento);
}

/**
 * Pontua só as oportunidades de serviço (software, infraestrutura e suporte); com `incluirProdutos`,
 * as que casam apenas com produtos entram pontuadas como produtos. Quem não casa com nenhuma frente sai.
 */
export function pontuarForaRj(
  lista: readonly Oportunidade[],
  incluirProdutos: boolean,
  agora: Date,
  limites?: LimitesCaixa,
  perfil: PerfilEmpresa = PERFIL_ORIGEM,
): OportunidadeComScore[] {
  const servicos = pontuarEOrdenar(lista, "servicos", agora, limites, perfil).filter(
    (o) => o.score.frenteCasada === "servicos",
  );
  if (!incluirProdutos) return servicos;
  const jaIncluidos = new Set(servicos.map((o) => o.id));
  const produtos = pontuarEOrdenar(
    lista.filter((o) => !jaIncluidos.has(o.id)),
    "produtos",
    agora,
    limites,
    perfil,
  ).filter((o) => o.score.frenteCasada === "produtos");
  return [...servicos, ...produtos].sort(ordemPorNota);
}

/** Junta as modalidades, tira o RJ, pontua, filtra pela palavra e limita. Função pura. */
export function montarResultadoForaRj(
  modalidades: ReadonlyArray<ResultadoModalidadeDetalhado>,
  busca: BuscaForaRj,
  agora: Date,
  limites?: LimitesCaixa,
  perfil: PerfilEmpresa = PERFIL_ORIGEM,
): ResultadoForaRj {
  const brutas = modalidades.flatMap((m) => m.contratacoes);
  // No Brasil todo o RJ também volta; ele já tem o Radar, então fica de fora.
  const foraDoRj = normalizarLista(brutas, agora).filter((o) => o.uf !== "RJ");
  const pontuadas = pontuarForaRj(foraDoRj, busca.incluirProdutos, agora, limites, perfil);
  const filtradas = filtrarPorTexto(pontuadas, { busca: busca.palavra, palavras: [] });

  return {
    busca,
    itens: filtradas.slice(0, LIMITES_FORA_RJ.maxResultados),
    totalFiltrado: filtradas.length,
    lidas: brutas.length,
    paginasConsultadas: modalidades.reduce((soma, m) => soma + (m.totalPaginas === 0 ? 0 : m.paginasConsultadas), 0),
    paginasNoPncp: modalidades.reduce((soma, m) => soma + m.totalPaginas, 0),
    cortouPaginas: modalidades.some((m) => m.totalPaginas > m.paginasConsultadas),
    falhas: modalidades.filter((m) => m.falhou).map((m) => m.modalidadeId),
    diasJanela: LIMITES_FORA_RJ.diasAFrente,
    atualizadoEm: agora.toISOString(),
  };
}

/** Consulta o PNCP ao vivo para a busca e devolve o resultado já pontuado. */
export async function buscarForaRj(
  busca: BuscaForaRj,
  contexto: { limites?: LimitesCaixa; perfil?: PerfilEmpresa; agora?: Date; fetchImpl?: typeof fetch } = {},
): Promise<ResultadoForaRj> {
  const agora = contexto.agora ?? new Date();
  const opcoes: OpcoesBusca = {
    ...opcoesPncpForaRj(busca, agora),
    ...(contexto.fetchImpl ? { fetchImpl: contexto.fetchImpl } : {}),
  };
  const modalidades = await buscarContratacoesDetalhadas(opcoes);
  return montarResultadoForaRj(modalidades, busca, agora, contexto.limites, contexto.perfil);
}
