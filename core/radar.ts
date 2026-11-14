import { buscarContratacoes } from "./pncp/client";
import { normalizarLista } from "./pncp/normalize";
import type { LimitesCaixa } from "./caixa";
import { PERFIL_ORIGEM } from "./empresa";
import type { PerfilEmpresa } from "./perfil";
import { calcularScore } from "./score";
import type { Frente, ModalidadeId, Oportunidade, OportunidadeComScore, RespostaRadar } from "./types";

/**
 * Pontua para a frente ativa, descarta as encerradas e ordena por nota e depois por prazo.
 * Com `limites` de caixa do dono, o critério de caixa entra (capital estimado pelo valor do edital).
 */
export function pontuarEOrdenar(
  lista: readonly Oportunidade[],
  frente: Frente,
  agora: Date,
  limites?: LimitesCaixa,
  perfil: PerfilEmpresa = PERFIL_ORIGEM,
): OportunidadeComScore[] {
  const agoraMs = agora.getTime();
  return lista
    .filter((o) => new Date(o.dataEncerramento).getTime() > agoraMs)
    .map((o) => ({ ...o, score: calcularScore(o, frente, agora, limites ? { limites } : undefined, perfil) }))
    .sort(
      (a, b) =>
        b.score.total - a.score.total ||
        new Date(a.dataEncerramento).getTime() - new Date(b.dataEncerramento).getTime(),
    );
}

/**
 * Consulta o PNCP ao vivo, normaliza e pontua para a frente ativa.
 * Lança erro apenas quando as duas modalidades falham sem trazer nenhum item.
 * O painel usa o cache do banco (lib/radar-dados.ts); esta função fica para a API e para a coleta.
 */
export async function buscarRadar(frente: Frente, limites?: LimitesCaixa, perfil: PerfilEmpresa = PERFIL_ORIGEM): Promise<RespostaRadar> {
  const agora = new Date();
  const resultados = await buscarContratacoes({ agora });

  const falhas: ModalidadeId[] = resultados.filter((r) => r.falhou).map((r) => r.modalidadeId);
  const brutas = resultados.flatMap((r) => r.contratacoes);

  if (falhas.length === resultados.length && brutas.length === 0) {
    throw new Error("Não foi possível consultar o PNCP: as duas modalidades falharam");
  }

  return {
    oportunidades: pontuarEOrdenar(normalizarLista(brutas, agora), frente, agora, limites, perfil),
    atualizadoEm: agora.toISOString(),
    falhas,
  };
}
