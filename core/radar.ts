import { buscarContratacoes } from "./pncp/client";
import { normalizarLista } from "./pncp/normalize";
import { calcularScore } from "./score";
import type { Frente, ModalidadeId, Oportunidade, OportunidadeComScore, RespostaRadar } from "./types";

/** Pontua para a frente ativa, descarta as encerradas e ordena por nota e depois por prazo. */
export function pontuarEOrdenar(lista: readonly Oportunidade[], frente: Frente, agora: Date): OportunidadeComScore[] {
  const agoraMs = agora.getTime();
  return lista
    .filter((o) => new Date(o.dataEncerramento).getTime() > agoraMs)
    .map((o) => ({ ...o, score: calcularScore(o, frente, agora) }))
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
export async function buscarRadar(frente: Frente): Promise<RespostaRadar> {
  const agora = new Date();
  const resultados = await buscarContratacoes({ agora });

  const falhas: ModalidadeId[] = resultados.filter((r) => r.falhou).map((r) => r.modalidadeId);
  const brutas = resultados.flatMap((r) => r.contratacoes);

  if (falhas.length === resultados.length && brutas.length === 0) {
    throw new Error("Não foi possível consultar o PNCP: as duas modalidades falharam");
  }

  return {
    oportunidades: pontuarEOrdenar(normalizarLista(brutas, agora), frente, agora),
    atualizadoEm: agora.toISOString(),
    falhas,
  };
}
