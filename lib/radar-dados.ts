import "server-only";
import { after } from "next/server";
import { dentroDasAreas, ufsDeColeta, uniaoDeUfs } from "@/core/areas";
import { buscarContratacoes, MODALIDADES, UF_PADRAO } from "@/core/pncp/client";
import { normalizarLista } from "@/core/pncp/normalize";
import type { LimitesCaixa } from "@/core/caixa";
import { manterDoAlerta } from "@/core/portais/alerta-licitacao";
import { buscarRadar, pontuarEOrdenar } from "@/core/radar";
import type { PerfilEmpresa } from "@/core/perfil";
import type { Frente, ModalidadeId, Oportunidade, RespostaRadar } from "@/core/types";
import { montarPaginaRadar, type ConsultaRadar, type PaginaRadar } from "@/lib/radar-pagina";
import { listarAreasEmpresasAtivas } from "@/db/empresas";
import { coletarAlertaLicitacao, type ResumoAlerta } from "@/lib/portais/alerta-licitacao";
import { gravarModalidade, lerCacheRadar, marcarFalha, pegarTrava, soltarTrava, type LinhaCache } from "@/db/radar-cache";

/** Depois desse tempo o cache é servido, mas uma nova coleta começa em segundo plano. */
const VALIDADE_MS = 30 * 60 * 1000;

/** Páginas (de 50) por UF e modalidade: até 3.000 itens, o bastante para MG (2.242 pregões abertos em 19/11). */
export const MAX_PAGINAS_POR_UF = 60;

/** Depois deste tempo a coleta não começa outra UF (a função do cron tem 300 s). As que sobram ficam para a próxima. */
const ORCAMENTO_COLETA_MS = 230_000;

/** Tempo a mais, depois do orçamento, em que a segunda fonte ainda pode começar uma consulta (a função tem 300 s). */
const PRAZO_EXTRA_ALERTA_MS = 20_000;

export interface ResumoColeta {
  executou: boolean;
  porModalidade: Array<{ uf: string; modalidadeId: ModalidadeId; itens: number; situacao: "completa" | "parcial" | "falhou" }>;
  /** UFs que ficaram para a próxima coleta por falta de tempo */
  ufsAdiadas: string[];
  /** Segunda fonte; ausente quando a coleta nem começou (trava ocupada) */
  alerta?: ResumoAlerta;
}

export interface OpcoesColeta {
  /** UFs a coletar; ausente vale a união das áreas de todas as empresas ativas */
  ufs?: string[];
}

/** UFs que o cron coleta: união das áreas das empresas ativas. Sem banco legível, só o RJ. */
async function ufsDasEmpresas(): Promise<string[]> {
  try {
    return uniaoDeUfs(await listarAreasEmpresasAtivas());
  } catch {
    return [UF_PADRAO];
  }
}

/**
 * Coleta o PNCP e grava no banco, UF por UF e modalidade por modalidade.
 * Coleta completa substitui a lista; parcial mescla com a anterior (novos vencem);
 * falha total mantém a lista anterior e só registra a falha. Nunca lança.
 */
export async function atualizarRadar(opcoes: OpcoesColeta = {}): Promise<ResumoColeta> {
  if (!(await pegarTrava().catch(() => false))) return { executou: false, porModalidade: [], ufsAdiadas: [] };
  const inicio = Date.now();
  const agora = new Date();
  const porModalidade: ResumoColeta["porModalidade"] = [];
  const ufsAdiadas: string[] = [];
  try {
    const ufs = opcoes.ufs ?? (await ufsDasEmpresas());
    const anteriores = await lerCacheRadar(ufs).catch((): LinhaCache[] => []);
    // Quem está há mais tempo sem coleta vai primeiro; se o tempo acabar, sobra o que foi coletado mais recentemente.
    const idade = (uf: string): number => {
      const linhas = anteriores.filter((a) => a.uf === uf);
      return linhas.length === 0 ? 0 : Math.min(...linhas.map((a) => a.atualizadoEm.getTime()));
    };
    const ordenadas = [...ufs].sort((a, b) => idade(a) - idade(b));

    for (const uf of ordenadas) {
      if (Date.now() - inicio > ORCAMENTO_COLETA_MS) {
        ufsAdiadas.push(uf);
        continue;
      }
      const resultados = await buscarContratacoes({ agora, uf, maxPaginas: MAX_PAGINAS_POR_UF });
      for (const r of resultados) {
        const novas = normalizarLista(r.contratacoes, agora);
        if (!r.falhou) {
          // Coleta completa substitui a lista, mas não pode apagar o que só o Alerta Licitação trouxe.
          const antigas = anteriores.find((a) => a.uf === uf && a.modalidadeId === r.modalidadeId)?.oportunidades ?? [];
          const lista = manterDoAlerta(antigas, novas, agora);
          await gravarModalidade(uf, r.modalidadeId, lista, agora);
          porModalidade.push({ uf, modalidadeId: r.modalidadeId, itens: lista.length, situacao: "completa" });
          continue;
        }
        if (novas.length > 0) {
          const antigas = anteriores.find((a) => a.uf === uf && a.modalidadeId === r.modalidadeId)?.oportunidades ?? [];
          const mapa = new Map<string, Oportunidade>();
          for (const o of antigas) if (new Date(o.dataEncerramento) > agora) mapa.set(o.id, o);
          for (const o of novas) mapa.set(o.id, o);
          await gravarModalidade(uf, r.modalidadeId, [...mapa.values()], agora);
          porModalidade.push({ uf, modalidadeId: r.modalidadeId, itens: mapa.size, situacao: "parcial" });
        } else {
          porModalidade.push({ uf, modalidadeId: r.modalidadeId, itens: 0, situacao: "falhou" });
        }
        await marcarFalha(uf, r.modalidadeId, agora);
      }
    }
    // Segunda fonte (Alerta Licitação), desligada sem token: só nas UFs que acabaram de ser coletadas e dentro do tempo que sobra.
    const alerta = await coletarAlertaLicitacao(
      ordenadas.filter((uf) => !ufsAdiadas.includes(uf)),
      agora,
      inicio + ORCAMENTO_COLETA_MS + PRAZO_EXTRA_ALERTA_MS,
    );
    return { executou: true, porModalidade, ufsAdiadas, alerta };
  } finally {
    await soltarTrava().catch(() => undefined);
  }
}

function montarResposta(
  cache: LinhaCache[],
  ufs: ReadonlyArray<string>,
  frente: Frente,
  agora: Date,
  limites: LimitesCaixa | undefined,
  perfil: PerfilEmpresa,
): RespostaRadar {
  const dentro = cache.flatMap((c) => c.oportunidades).filter((o) => dentroDasAreas(o, perfil.areas));
  const oportunidades = pontuarEOrdenar(dentro, frente, agora, limites, perfil);
  const falhas = MODALIDADES.filter((m) =>
    cache.some((c) => c.modalidadeId === m && c.falhouEm !== null && c.falhouEm > c.atualizadoEm),
  );
  const maisAntiga = cache.length > 0 ? Math.min(...cache.map((c) => c.atualizadoEm.getTime())) : agora.getTime();
  const ufsPendentes = ufs.filter((uf) => !cache.some((c) => c.uf === uf));
  return { oportunidades, atualizadoEm: new Date(maisAntiga).toISOString(), falhas, ufsPendentes };
}

/** UFs com alguma modalidade sem cache ou com cache velho. */
function ufsParaRecoletar(cache: LinhaCache[], ufs: ReadonlyArray<string>, agora: Date): string[] {
  return ufs.filter((uf) =>
    MODALIDADES.some((m) => {
      const linha = cache.find((c) => c.uf === uf && c.modalidadeId === m);
      return !linha || agora.getTime() - linha.atualizadoEm.getTime() > VALIDADE_MS;
    }),
  );
}

/**
 * Radar do painel: lê só o cache do banco, das UFs das áreas da empresa; não coleta na hora de abrir.
 * Cache velho ou ausente dispara uma recoleta dessas UFs depois da resposta (a mesma trava do cron).
 * Sem banco, cai para a consulta ao vivo do RJ.
 */
export async function obterRadar(frente: Frente, limites: LimitesCaixa | undefined, perfil: PerfilEmpresa): Promise<RespostaRadar> {
  const agora = new Date();
  const ufs = ufsDeColeta(perfil.areas);
  let cache: LinhaCache[];
  try {
    cache = await lerCacheRadar(ufs);
  } catch {
    const aoVivo = await buscarRadar(frente, limites, perfil);
    return { ...aoVivo, oportunidades: aoVivo.oportunidades.filter((o) => dentroDasAreas(o, perfil.areas)) };
  }

  const recoletar = ufsParaRecoletar(cache, ufs, agora);
  if (recoletar.length > 0) {
    try {
      after(() => atualizarRadar({ ufs: recoletar }).then(() => undefined));
    } catch {
      // Fora de um pedido (rotinas do cron) não há como agendar: a próxima coleta do cron cobre.
    }
  }

  return montarResposta(cache, ufs, frente, agora, limites, perfil);
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
    resposta.ufsPendentes ?? [],
  );
}
