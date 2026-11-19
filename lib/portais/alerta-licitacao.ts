import "server-only";
import {
  CABECALHO_TOKEN,
  MAX_POR_PAGINA,
  lerResposta,
  montarUrl,
  novasSemDuplicata,
  termosDosCnaes,
  type LicitacaoAlerta,
} from "@/core/portais/alerta-licitacao";
import type { Oportunidade } from "@/core/types";
import { listarCnaesEmpresasAtivas } from "@/db/empresas";
import { gravarModalidade, lerCacheRadar, marcarFalha } from "@/db/radar-cache";
import { lerConfig, gravarConfig, somarContador } from "@/db/whatsapp";

/** Teto de licitações por dia quando ALERTA_LICITACAO_MAX_DIA não define outro (a franquia grátis do Alerta Licitação). */
const MAX_DIA_PADRAO = 100;

/** Cada UF é consultada no máximo uma vez neste intervalo; o cron roda mais vezes que isso. */
const INTERVALO_POR_UF_MS = 6 * 60 * 60 * 1000;

const MAX_PAGINAS_POR_UF = 3;
const TIMEOUT_MS = 15_000;

export interface ResumoAlerta {
  ligado: boolean;
  /** UFs consultadas nesta rodada */
  ufs: string[];
  /** Oportunidades novas (que o PNCP não tinha) gravadas no cache */
  adicionadas: number;
}

const VAZIO: ResumoAlerta = { ligado: false, ufs: [], adicionadas: 0 };

function limiteDiario(): number {
  const n = Number(process.env.ALERTA_LICITACAO_MAX_DIA);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : MAX_DIA_PADRAO;
}

/** Dia no fuso de Brasília, AAAA-MM-DD. */
function diaDeSaoPaulo(agora: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(agora);
  const valor = (tipo: string): string => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

const chaveDoDia = (agora: Date): string => `alerta:${diaDeSaoPaulo(agora)}`;
const chaveDaUf = (uf: string): string => `alerta-uf:${uf}`;

async function consultadaRecentemente(uf: string, agora: Date): Promise<boolean> {
  const ultima = Number(await lerConfig(chaveDaUf(uf)));
  return Number.isFinite(ultima) && ultima > 0 && agora.getTime() - ultima < INTERVALO_POR_UF_MS;
}

interface PaginaBuscada {
  licitacoes: LicitacaoAlerta[];
  paginas: number;
  /** Quanto contar no teto diário: o que a API devolveu, no mínimo 1 pela requisição */
  consumo: number;
}

async function buscarPagina(token: string, uf: string, termos: string[], pagina: number, porPagina: number): Promise<PaginaBuscada | null> {
  try {
    const url = montarUrl({ ufs: [uf], palavrasChave: termos, pagina, porPagina });
    const resposta = await fetch(url, {
      headers: { Accept: "application/json", [CABECALHO_TOKEN]: token },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!resposta.ok) {
      console.error(`[alerta-licitacao] ${uf}: HTTP ${resposta.status}`);
      return null;
    }
    const leitura = lerResposta(await resposta.json());
    if (!leitura.ok) {
      console.error(`[alerta-licitacao] ${uf}: ${leitura.erro}`);
      return null;
    }
    const { resposta: r } = leitura;
    return { licitacoes: r.licitacoes, paginas: r.paginas, consumo: Math.max(1, r.licitacoesNestaPagina) };
  } catch (erro) {
    console.error(`[alerta-licitacao] ${uf}:`, erro instanceof Error ? erro.message : erro);
    return null;
  }
}

/**
 * Segunda fonte do Radar: dispensas do Alerta Licitação nas UFs já coletadas do PNCP, mescladas no cache
 * sem repetir o que o PNCP trouxe. Desligada sem ALERTA_LICITACAO_TOKEN. Sempre com UF, palavras do ramo das
 * empresas ativas e modalidade 6, e dentro do teto diário (ALERTA_LICITACAO_MAX_DIA, padrão 100 licitações).
 * Só mexe em UFs que já têm cache de dispensas; não lança.
 *
 * @param prazo instante (ms) depois do qual não começa nova consulta
 */
export async function coletarAlertaLicitacao(ufs: ReadonlyArray<string>, agora: Date, prazo: number): Promise<ResumoAlerta> {
  const token = process.env.ALERTA_LICITACAO_TOKEN?.trim();
  if (!token) {
    console.info("[alerta-licitacao] ALERTA_LICITACAO_TOKEN ausente: segunda fonte desligada.");
    return VAZIO;
  }
  const resumo: ResumoAlerta = { ligado: true, ufs: [], adicionadas: 0 };
  try {
    const termos = termosDosCnaes(await listarCnaesEmpresasAtivas());
    if (termos.length === 0 || ufs.length === 0) return resumo;
    const limite = limiteDiario();
    const chave = chaveDoDia(agora);
    let usado = await somarContador(chave, 0);
    const cache = await lerCacheRadar(ufs);

    for (const uf of ufs) {
      if (Date.now() > prazo || usado >= limite) break;
      const linha = cache.find((c) => c.uf === uf && c.modalidadeId === 8);
      if (!linha || (await consultadaRecentemente(uf, agora))) continue;

      const coletadas: LicitacaoAlerta[] = [];
      let completa = false;
      for (let pagina = 1; pagina <= MAX_PAGINAS_POR_UF && usado < limite && Date.now() <= prazo; pagina += 1) {
        const lida = await buscarPagina(token, uf, termos, pagina, Math.min(MAX_POR_PAGINA, limite - usado));
        if (!lida) break;
        usado = await somarContador(chave, lida.consumo);
        coletadas.push(...lida.licitacoes);
        completa = pagina >= lida.paginas;
        if (completa) break;
      }
      if (coletadas.length === 0 && !completa) continue;
      await gravarConfig(chaveDaUf(uf), String(agora.getTime()));
      resumo.ufs.push(uf);

      const existentes = new Set(cache.flatMap((c) => c.oportunidades.map((o) => o.id)));
      const novas = novasSemDuplicata(coletadas, existentes, agora).filter((o) => o.uf === uf);
      if (novas.length === 0) continue;
      // O que já era do Alerta Licitação continua em `linha` (ver manterDoAlerta na coleta do PNCP); aqui só entram as novas.
      const lista: Oportunidade[] = [...linha.oportunidades, ...novas];
      await gravarModalidade(uf, 8, lista, linha.atualizadoEm);
      if (linha.falhouEm !== null && linha.falhouEm > linha.atualizadoEm) await marcarFalha(uf, 8, linha.falhouEm);
      resumo.adicionadas += novas.length;
    }
    return resumo;
  } catch (erro) {
    console.error("[alerta-licitacao] coleta:", erro instanceof Error ? erro.message : erro);
    return resumo;
  }
}
