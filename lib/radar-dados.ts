import "server-only";
import { after } from "next/server";
import { dentroDasAreas, ufsDeColeta, uniaoDeUfs } from "@/core/areas";
import {
  buscarContratacoes,
  buscarModalidade,
  MODALIDADES_EXTRAS,
  MODALIDADES_PRIORITARIAS,
  UF_PADRAO,
  type ResultadoModalidade,
} from "@/core/pncp/client";
import { gruposDeModalidades, normalizarLista } from "@/core/pncp/normalize";
import type { LimitesCaixa } from "@/core/caixa";
import { manterDoAlerta } from "@/core/portais/alerta-licitacao";
import { buscarRadar, pontuarEOrdenar } from "@/core/radar";
import type { PerfilEmpresa } from "@/core/perfil";
import type { Frente, ModalidadePncp, Oportunidade, RespostaRadar } from "@/core/types";
import { montarPaginaRadar, type ConsultaRadar, type PaginaRadar } from "@/lib/radar-pagina";
import { listarAreasEmpresasAtivas } from "@/db/empresas";
import { pedirColeta } from "@/lib/coleta-separada";
import { coletarAlertaLicitacao, type ResumoAlerta } from "@/lib/portais/alerta-licitacao";
import {
  bancoAceitaModalidade,
  gravarModalidade,
  lerCacheRadar,
  marcarFalha,
  pegarTrava,
  soltarTrava,
  violouCheckDaModalidade,
  type LinhaCache,
} from "@/db/radar-cache";

/** Depois desse tempo o cache é servido, mas uma nova coleta começa em segundo plano. */
const VALIDADE_MS = 30 * 60 * 1000;

/** Páginas (de 50) por UF e modalidade: até 3.000 itens, o bastante para MG (2.242 pregões abertos em 19/11). */
export const MAX_PAGINAS_POR_UF = 60;

/** Depois deste tempo a coleta não começa outra UF (a função do cron tem 300 s). As que sobram ficam para a próxima. */
const ORCAMENTO_COLETA_MS = 230_000;

/**
 * Pregão e dispensa (as modalidades prioritárias) só começam uma UF nova até este tempo; o resto do orçamento fica
 * para concorrência, pregão presencial e credenciamento. Se as prioritárias acabam antes, as outras ganham o que sobrou.
 */
const LIMITE_PRIORITARIAS_MS = 170_000;

/** Tempo a mais, depois do orçamento, em que a segunda fonte ainda pode começar uma consulta (a função tem 300 s). */
const PRAZO_EXTRA_ALERTA_MS = 20_000;

export interface ResumoColeta {
  executou: boolean;
  porModalidade: Array<{ uf: string; modalidadeId: ModalidadePncp; itens: number; situacao: "completa" | "parcial" | "falhou" }>;
  /** UFs que ficaram para a próxima coleta por falta de tempo */
  ufsAdiadas: string[];
  /** Modalidades extras (4, 5, 7, 12): coletadas, sem suporte no banco (migração 027 por aplicar) ou sem tempo */
  extras?: "coletadas" | "banco-sem-migracao" | "sem-tempo";
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

type PorModalidade = ResumoColeta["porModalidade"];

/**
 * Grava o resultado de uma UF e modalidade. Coleta completa substitui a lista (sem apagar o que só o Alerta Licitação trouxe);
 * parcial mescla com a anterior (novos vencem); falha total mantém a anterior e só registra a falha.
 */
async function gravarResultado(
  uf: string,
  r: ResultadoModalidade,
  anteriores: LinhaCache[],
  agora: Date,
  porModalidade: PorModalidade,
): Promise<void> {
  const novas = normalizarLista(r.contratacoes, agora);
  const antigas = anteriores.find((a) => a.uf === uf && a.modalidadeId === r.modalidadeId)?.oportunidades ?? [];
  if (!r.falhou) {
    const lista = manterDoAlerta(antigas, novas, agora);
    await gravarModalidade(uf, r.modalidadeId, lista, agora);
    porModalidade.push({ uf, modalidadeId: r.modalidadeId, itens: lista.length, situacao: "completa" });
    return;
  }
  if (novas.length > 0) {
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

/** Instante da última coleta da UF e modalidade; 0 quando nunca foi coletada. */
function ultimaColeta(anteriores: LinhaCache[], uf: string, modalidadeId: ModalidadePncp): number {
  return anteriores.find((a) => a.uf === uf && a.modalidadeId === modalidadeId)?.atualizadoEm.getTime() ?? 0;
}

/**
 * Concorrência eletrônica e presencial, pregão presencial e credenciamento, uma de cada vez (o PNCP corta rajadas),
 * com o tempo que sobrou. Quem está há mais tempo sem coleta vai primeiro. Nunca lança: o que não cabe fica para a próxima.
 */
async function coletarExtras(
  ufs: ReadonlyArray<string>,
  anteriores: LinhaCache[],
  agora: Date,
  limiteMs: number,
  porModalidade: PorModalidade,
): Promise<NonNullable<ResumoColeta["extras"]>> {
  const pares = ufs.flatMap((uf) => MODALIDADES_EXTRAS.map((m) => ({ uf, m })));
  if (pares.length === 0) return "coletadas";
  // Sem nenhuma linha extra no cache, pergunta ao banco se aceita as modalidades novas antes de gastar consultas ao PNCP.
  const jaTemLinha = anteriores.some((a) => MODALIDADES_EXTRAS.includes(a.modalidadeId));
  if (!jaTemLinha) {
    const aceita = await bancoAceitaModalidade(MODALIDADES_EXTRAS[0]).catch(() => false);
    if (!aceita) return "banco-sem-migracao";
  }
  pares.sort((a, b) => ultimaColeta(anteriores, a.uf, a.m) - ultimaColeta(anteriores, b.uf, b.m));
  for (const { uf, m } of pares) {
    if (Date.now() > limiteMs) return "sem-tempo";
    const r = await buscarModalidade(m, { agora, uf, maxPaginas: MAX_PAGINAS_POR_UF, prazoMs: limiteMs + PRAZO_EXTRA_ALERTA_MS });
    try {
      await gravarResultado(uf, r, anteriores, agora, porModalidade);
    } catch (e) {
      // CHECK recusando a modalidade (migração por aplicar) ou erro de gravação: só esta modalidade fica de fora.
      if (violouCheckDaModalidade(e)) return "banco-sem-migracao";
    }
  }
  return "coletadas";
}

/**
 * Coleta o PNCP e grava no banco, UF por UF e modalidade por modalidade. Primeiro as prioritárias (pregão eletrônico e dispensa)
 * de todas as UFs; depois, com o tempo que sobra, concorrência, pregão presencial e credenciamento.
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
      const linhas = anteriores.filter((a) => a.uf === uf && MODALIDADES_PRIORITARIAS.includes(a.modalidadeId));
      return linhas.length === 0 ? 0 : Math.min(...linhas.map((a) => a.atualizadoEm.getTime()));
    };
    const ordenadas = [...ufs].sort((a, b) => idade(a) - idade(b));

    for (const uf of ordenadas) {
      if (Date.now() - inicio > LIMITE_PRIORITARIAS_MS) {
        ufsAdiadas.push(uf);
        continue;
      }
      const resultados = await buscarContratacoes({ agora, uf, maxPaginas: MAX_PAGINAS_POR_UF, prazoMs: inicio + ORCAMENTO_COLETA_MS });
      for (const r of resultados) await gravarResultado(uf, r, anteriores, agora, porModalidade);
    }

    const coletadas = ordenadas.filter((uf) => !ufsAdiadas.includes(uf));
    const extras = await coletarExtras(coletadas, anteriores, agora, inicio + ORCAMENTO_COLETA_MS, porModalidade);

    // Segunda fonte (Alerta Licitação), desligada sem token: só nas UFs que acabaram de ser coletadas e dentro do tempo que sobra.
    const alerta = await coletarAlertaLicitacao(coletadas, agora, inicio + ORCAMENTO_COLETA_MS + PRAZO_EXTRA_ALERTA_MS);
    return { executou: true, porModalidade, ufsAdiadas, extras, alerta };
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
  // A mesma compra nunca entra duas vezes (a segunda fonte e as modalidades extras podem repetir ids).
  const unicas = new Map<string, Oportunidade>();
  for (const o of cache.flatMap((c) => c.oportunidades)) if (!unicas.has(o.id) || o.linkAlerta) unicas.set(o.id, o);
  const dentro = [...unicas.values()].filter((o) => dentroDasAreas(o, perfil.areas));
  const oportunidades = pontuarEOrdenar(dentro, frente, agora, limites, perfil);
  const falhas = gruposDeModalidades(
    cache.filter((c) => c.falhouEm !== null && c.falhouEm > c.atualizadoEm).map((c) => c.modalidadeId),
  );
  // A data mostrada é a da coleta das prioritárias: as extras podem ficar para trás quando o tempo da rodada acaba.
  const referencia = cache.filter((c) => MODALIDADES_PRIORITARIAS.includes(c.modalidadeId));
  const baseData = referencia.length > 0 ? referencia : cache;
  const maisAntiga = baseData.length > 0 ? Math.min(...baseData.map((c) => c.atualizadoEm.getTime())) : agora.getTime();
  const ufsPendentes = ufs.filter((uf) => !cache.some((c) => c.uf === uf));
  return { oportunidades, atualizadoEm: new Date(maisAntiga).toISOString(), falhas, ufsPendentes };
}

/** UFs com alguma modalidade prioritária sem cache ou com cache velho (as extras não pedem recoleta sozinhas). */
function ufsParaRecoletar(cache: LinhaCache[], ufs: ReadonlyArray<string>, agora: Date): string[] {
  return ufs.filter((uf) =>
    MODALIDADES_PRIORITARIAS.some((m) => {
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
      after(() => pedirColeta(recoletar));
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
