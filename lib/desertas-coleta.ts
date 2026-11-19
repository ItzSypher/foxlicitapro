import "server-only";
import { uniaoDeUfs } from "@/core/areas";
import { casaComRamo, diaPncp, diasParaVarrer, montarDeserta, type Deserta } from "@/core/desertas";
import { buscarPublicacoesDoDia, buscarSituacaoDosItens } from "@/core/pncp/desertas";
import type { ContratacaoPncp } from "@/core/pncp/schema";
import { apagarDesertasVelhas, gravarDesertas, gravarVarredura, lerVarredura } from "@/db/desertas";
import { listarAreasEmpresasAtivas, listarCnaesEmpresasAtivas } from "@/db/empresas";

/** Dispensa (modalidade 8): é onde o órgão repete a compra que deu deserta. */
const MODALIDADE_DISPENSA = 8;
/** A compra precisa ter encerrado e sido julgada: só olha publicações com pelo menos este número de dias. */
const ATRASO_DIAS = 3;
/** Primeira vez numa UF: começa tantos dias atrás. */
const INICIO_DIAS = 30;
/** Dias de publicação olhados por UF a cada rodada; o resto fica para a próxima. */
const MAX_DIAS_POR_UF = 7;
/** Páginas de 50 por dia e UF. */
const MAX_PAGINAS_POR_DIA = 6;
/** Chamadas de itens por rodada (uma por compra do ramo), somando todas as UFs. */
export const MAX_CONSULTAS_ITENS = 150;
const CONCORRENCIA = 4;
/** Tempo máximo da rodada quando quem chama não define outro. */
const ORCAMENTO_PADRAO_MS = 45_000;

export interface ResumoDesertasUf {
  uf: string;
  diasOlhados: number;
  comprasDoRamo: number;
  desertas: number;
  /** Houve dia com mais compras do que couberam na rodada */
  truncado: boolean;
}

export interface ResumoDesertas {
  executou: boolean;
  motivo?: string;
  ufs: ResumoDesertasUf[];
  consultasItens: number;
  /** UFs que ficaram para a próxima rodada por falta de tempo ou de consultas */
  ufsAdiadas: string[];
}

export interface OpcoesDesertas {
  agora?: Date;
  /** Instante (ms) a partir do qual a rodada não começa mais nenhuma consulta */
  prazoMs?: number;
}

async function paginasDoDia(uf: string, dia: string, prazoMs: number): Promise<{ compras: ContratacaoPncp[]; completo: boolean } | null> {
  const compras: ContratacaoPncp[] = [];
  let totalPaginas = 1;
  for (let pagina = 1; pagina <= Math.min(totalPaginas, MAX_PAGINAS_POR_DIA); pagina += 1) {
    if (Date.now() > prazoMs) return null;
    try {
      const lida = await buscarPublicacoesDoDia(uf, MODALIDADE_DISPENSA, dia, pagina);
      compras.push(...lida.compras);
      totalPaginas = lida.totalPaginas;
    } catch {
      return null;
    }
    if (totalPaginas === 0) break;
  }
  return { compras, completo: totalPaginas <= MAX_PAGINAS_POR_DIA };
}

/**
 * Coleta as dispensas que terminaram sem vencedor: por UF e dia de publicação, pega as compras do ramo das empresas ativas,
 * lê os itens e guarda as que têm item deserto ou fracassado. O cursor por UF faz cada rodada continuar de onde a anterior parou.
 * Nunca lança.
 */
export async function coletarDesertas(opcoes: OpcoesDesertas = {}): Promise<ResumoDesertas> {
  const agora = opcoes.agora ?? new Date();
  const prazoMs = opcoes.prazoMs ?? Date.now() + ORCAMENTO_PADRAO_MS;
  const vazio: ResumoDesertas = { executou: false, ufs: [], consultasItens: 0, ufsAdiadas: [] };
  try {
    const [areas, cnaes] = await Promise.all([listarAreasEmpresasAtivas(), listarCnaesEmpresasAtivas()]);
    const ufs = uniaoDeUfs(areas);
    if (ufs.length === 0 || cnaes.length === 0) return { ...vazio, motivo: "sem empresas com áreas e atividades" };

    const limite = diaPncp(agora, -ATRASO_DIAS);
    const inicioPadrao = diaPncp(agora, -INICIO_DIAS);
    const cursores = new Map<string, string | null>();
    for (const uf of ufs) cursores.set(uf, await lerVarredura(uf).catch((): null => null));
    // Quem está mais atrasada vai primeiro.
    const ordenadas = [...ufs].sort((a, b) => (cursores.get(a) ?? "").localeCompare(cursores.get(b) ?? ""));

    const resumo: ResumoDesertas = { executou: true, ufs: [], consultasItens: 0, ufsAdiadas: [] };
    for (const uf of ordenadas) {
      const dias = diasParaVarrer(cursores.get(uf) ?? null, limite, inicioPadrao, MAX_DIAS_POR_UF);
      if (dias.length === 0) continue;
      if (Date.now() > prazoMs || resumo.consultasItens >= MAX_CONSULTAS_ITENS) {
        resumo.ufsAdiadas.push(uf);
        continue;
      }
      const linha: ResumoDesertasUf = { uf, diasOlhados: 0, comprasDoRamo: 0, desertas: 0, truncado: false };
      for (const dia of dias) {
        if (Date.now() > prazoMs) break;
        const lido = await paginasDoDia(uf, dia, prazoMs);
        if (lido === null) break;

        const vistos = new Set<string>();
        const candidatas = lido.compras.filter((c) => {
          if (vistos.has(c.numeroControlePNCP) || !casaComRamo(c.objetoCompra ?? "", cnaes)) return false;
          vistos.add(c.numeroControlePNCP);
          return true;
        });
        const sobra = MAX_CONSULTAS_ITENS - resumo.consultasItens;
        // Dia que não cabe no que resta da rodada espera a próxima, a menos que sozinho já estoure a rodada inteira.
        if (candidatas.length > sobra && sobra < MAX_CONSULTAS_ITENS) break;
        const aConsultar = candidatas.slice(0, sobra);
        if (aConsultar.length < candidatas.length || !lido.completo) linha.truncado = true;

        const achadas: Deserta[] = [];
        let falhas = 0;
        for (let i = 0; i < aConsultar.length; i += CONCORRENCIA) {
          if (Date.now() > prazoMs) {
            falhas += aConsultar.length - i;
            break;
          }
          const lote = aConsultar.slice(i, i + CONCORRENCIA);
          const lidos = await Promise.allSettled(
            lote.map((c) => buscarSituacaoDosItens(c.orgaoEntidade.cnpj, c.anoCompra, c.sequencialCompra)),
          );
          resumo.consultasItens += lote.length;
          lidos.forEach((r, k) => {
            if (r.status === "rejected") {
              falhas += 1;
              return;
            }
            const d = montarDeserta(lote[k], r.value, agora);
            if (d !== null) achadas.push(d);
          });
        }
        // Muita falha no dia: não avança o cursor, o dia é refeito na próxima rodada.
        if (falhas * 3 > aConsultar.length) break;

        await gravarDesertas(achadas, agora);
        await gravarVarredura(uf, dia, agora);
        linha.diasOlhados += 1;
        linha.comprasDoRamo += candidatas.length;
        linha.desertas += achadas.length;
      }
      resumo.ufs.push(linha);
    }
    await apagarDesertasVelhas().catch(() => undefined);
    return resumo;
  } catch (e) {
    console.error("[desertas] coleta:", e instanceof Error ? e.message : e);
    return { ...vazio, motivo: "falha na coleta" };
  }
}
