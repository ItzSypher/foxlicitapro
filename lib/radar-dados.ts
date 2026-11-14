import "server-only";
import { after } from "next/server";
import { buscarContratacoes, MODALIDADES } from "@/core/pncp/client";
import { normalizarLista } from "@/core/pncp/normalize";
import type { LimitesCaixa } from "@/core/caixa";
import { buscarRadar, pontuarEOrdenar } from "@/core/radar";
import type { PerfilEmpresa } from "@/core/perfil";
import type { Frente, ModalidadeId, Oportunidade, RespostaRadar } from "@/core/types";
import { montarPaginaRadar, type ConsultaRadar, type PaginaRadar } from "@/lib/radar-pagina";
import { gravarModalidade, lerCacheRadar, marcarFalha, pegarTrava, soltarTrava, type LinhaCache } from "@/db/radar-cache";

/** Depois desse tempo o cache é servido, mas uma nova coleta começa em segundo plano. */
const VALIDADE_MS = 30 * 60 * 1000;

export interface ResumoColeta {
  executou: boolean;
  porModalidade: Array<{ modalidadeId: ModalidadeId; itens: number; situacao: "completa" | "parcial" | "falhou" }>;
}

/**
 * Coleta o PNCP e grava no banco, modalidade por modalidade.
 * Coleta completa substitui a lista; parcial mescla com a anterior (novos vencem);
 * falha total mantém a lista anterior e só registra a falha. Nunca lança.
 */
export async function atualizarRadar(): Promise<ResumoColeta> {
  if (!(await pegarTrava().catch(() => false))) return { executou: false, porModalidade: [] };
  const agora = new Date();
  const porModalidade: ResumoColeta["porModalidade"] = [];
  try {
    const [resultados, anteriores] = await Promise.all([
      buscarContratacoes({ agora }),
      lerCacheRadar().catch((): LinhaCache[] => []),
    ]);
    for (const r of resultados) {
      const novas = normalizarLista(r.contratacoes, agora);
      if (!r.falhou) {
        await gravarModalidade(r.modalidadeId, novas, agora);
        porModalidade.push({ modalidadeId: r.modalidadeId, itens: novas.length, situacao: "completa" });
        continue;
      }
      if (novas.length > 0) {
        const antigas = anteriores.find((a) => a.modalidadeId === r.modalidadeId)?.oportunidades ?? [];
        const mapa = new Map<string, Oportunidade>();
        for (const o of antigas) if (new Date(o.dataEncerramento) > agora) mapa.set(o.id, o);
        for (const o of novas) mapa.set(o.id, o);
        await gravarModalidade(r.modalidadeId, [...mapa.values()], agora);
        porModalidade.push({ modalidadeId: r.modalidadeId, itens: mapa.size, situacao: "parcial" });
      } else {
        porModalidade.push({ modalidadeId: r.modalidadeId, itens: 0, situacao: "falhou" });
      }
      await marcarFalha(r.modalidadeId, agora);
    }
    return { executou: true, porModalidade };
  } finally {
    await soltarTrava().catch(() => undefined);
  }
}

function montarResposta(cache: LinhaCache[], frente: Frente, agora: Date, limites: LimitesCaixa | undefined, perfil: PerfilEmpresa): RespostaRadar {
  const oportunidades = pontuarEOrdenar(
    cache.flatMap((c) => c.oportunidades),
    frente,
    agora,
    limites,
    perfil,
  );
  const falhas = MODALIDADES.filter((m) => {
    const linha = cache.find((c) => c.modalidadeId === m);
    return !linha || (linha.falhouEm !== null && linha.falhouEm > linha.atualizadoEm);
  });
  const maisAntiga = Math.min(...cache.map((c) => c.atualizadoEm.getTime()));
  return { oportunidades, atualizadoEm: new Date(maisAntiga).toISOString(), falhas };
}

/**
 * Radar do painel: lê o cache do banco na hora e, se estiver velho, coleta de novo depois da resposta.
 * Sem cache nenhum (primeiro uso), coleta antes de responder. Sem banco, cai para a consulta ao vivo.
 */
export async function obterRadar(frente: Frente, limites: LimitesCaixa | undefined, perfil: PerfilEmpresa): Promise<RespostaRadar> {
  const agora = new Date();
  let cache: LinhaCache[];
  try {
    cache = await lerCacheRadar();
  } catch {
    return buscarRadar(frente, limites, perfil);
  }

  if (cache.length === 0) {
    await atualizarRadar();
    cache = await lerCacheRadar();
    if (cache.length === 0) return buscarRadar(frente, limites, perfil);
  } else {
    const velho =
      cache.length < MODALIDADES.length ||
      cache.some((c) => agora.getTime() - c.atualizadoEm.getTime() > VALIDADE_MS);
    if (velho) after(() => atualizarRadar().then(() => undefined));
  }

  return montarResposta(cache, frente, agora, limites, perfil);
}

/** Radar já filtrado, ordenado e paginado no servidor: só a página atual vai ao navegador. */
export function paginaDaResposta(resposta: RespostaRadar, consulta: ConsultaRadar): PaginaRadar {
  const referencia = Date.parse(resposta.atualizadoEm);
  return montarPaginaRadar(
    resposta.oportunidades,
    consulta,
    Date.now(),
    Number.isNaN(referencia) ? Date.now() : referencia,
    resposta.atualizadoEm,
    resposta.falhas,
  );
}
