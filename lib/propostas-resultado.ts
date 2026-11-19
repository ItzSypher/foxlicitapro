import "server-only";
import { buscarDetalheCompra } from "@/core/pncp/detalhe";
import { buscarResultadosItem } from "@/core/pncp/resultados";
import { chaveDeNumeroControle } from "@/core/proposta";
import {
  apurarResultado,
  avisoResultado,
  itensParaConsultar,
  precisaConsultar,
  type ItemParaApurar,
} from "@/core/proposta-resultado";
import {
  gravarResultado,
  listarPropostasSemResultado,
  marcarConsultaResultado,
  type PropostaSemResultado,
} from "@/db/proposta-eventos";
import { entregarAvisos } from "@/lib/central-avisos";

/** Propostas consultadas por rodada do cron diário. */
const POR_RODADA = 40;
/** Para de abrir consultas novas depois disso, para caber no tempo do cron. */
const ORCAMENTO_MS = 90_000;

export interface ResumoResultados {
  consultadas: number;
  ganhas: number;
  perdidas: number;
  aguardando: number;
  falhas: number;
}

async function consultar(p: PropostaSemResultado): Promise<"ganhou" | "perdeu" | "aguardando" | "falha"> {
  const chave = chaveDeNumeroControle(p.compraId);
  if (!chave) {
    await marcarConsultaResultado(p.empresaId, p.id);
    return "aguardando";
  }
  const detalhe = await buscarDetalheCompra(chave);
  if (detalhe === null || detalhe.falhas.includes("itens")) {
    await marcarConsultaResultado(p.empresaId, p.id);
    return detalhe === null ? "aguardando" : "falha";
  }
  const situacaoPorItem = new Map(detalhe.itens.map((i) => [i.numero, i.situacao]));
  const numeros = itensParaConsultar(p.numerosItens, detalhe.itens.map((i) => i.numero));

  const itens: ItemParaApurar[] = [];
  for (const numero of numeros) {
    itens.push({ numero, situacao: situacaoPorItem.get(numero) ?? null, resultados: await buscarResultadosItem(chave, numero) });
  }
  const apurado = apurarResultado(itens, p.cnpjEmpresa);
  const saiuAgora = await gravarResultado(p.empresaId, p.id, apurado);
  if (saiuAgora) {
    const aviso = avisoResultado({ id: p.id, titulo: p.titulo, apurado });
    if (aviso) await entregarAvisos(p.empresaId, [aviso]);
  }
  return apurado.situacao;
}

/**
 * Consulta no PNCP o resultado das propostas enviadas e grava Ganhou / Perdeu / Aguardando,
 * com vencedor e valor. Uma proposta por vez, para não sobrecarregar o portal. Nunca lança.
 */
export async function atualizarResultadosPropostas(agora: Date = new Date()): Promise<ResumoResultados> {
  const resumo: ResumoResultados = { consultadas: 0, ganhas: 0, perdidas: 0, aguardando: 0, falhas: 0 };
  let pendentes: PropostaSemResultado[];
  try {
    pendentes = await listarPropostasSemResultado(POR_RODADA);
  } catch (e) {
    console.error("[resultado] leitura:", e instanceof Error ? e.message : e);
    return { ...resumo, falhas: 1 };
  }
  const inicio = Date.now();
  for (const p of pendentes) {
    if (Date.now() - inicio > ORCAMENTO_MS) break;
    if (!precisaConsultar({ enviadaEm: p.enviadaEm, consultadoEm: p.consultadoEm }, agora)) continue;
    resumo.consultadas += 1;
    try {
      const r = await consultar(p);
      if (r === "ganhou") resumo.ganhas += 1;
      else if (r === "perdeu") resumo.perdidas += 1;
      else if (r === "aguardando") resumo.aguardando += 1;
      else resumo.falhas += 1;
    } catch (e) {
      resumo.falhas += 1;
      console.error("[resultado] proposta", p.id, e instanceof Error ? e.message : e);
      await marcarConsultaResultado(p.empresaId, p.id).catch(() => undefined);
    }
  }
  return resumo;
}
