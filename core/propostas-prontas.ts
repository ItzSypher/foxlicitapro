import type { OportunidadeComScore } from "./types";
import type { AutorProposta, StatusPropostaEquipe } from "./types-equipe";

/**
 * "Proposta pronta": toda manhã o assistente monta o rascunho das melhores oportunidades do ramo que fecham logo.
 * Funções puras; o que fala com banco e assistente fica em lib/propostas-prontas.ts.
 */

/** Quantas propostas o assistente monta por empresa a cada manhã. */
export const MAXIMO_PRONTAS_POR_EMPRESA = 3;
/** A oportunidade precisa encerrar em até este número de dias. */
export const DIAS_PARA_FECHAR = 5;

/**
 * Chave de liga e desliga das partes novas (PROPOSTA_PRONTA_ATIVA, DESERTAS_ATIVA): ligada por padrão;
 * só "false", "0", "nao", "não" ou "off" desligam.
 */
export function propostaProntaLigada(valor: string | undefined): boolean {
  const v = (valor ?? "").trim().toLowerCase();
  return !(v === "false" || v === "0" || v === "nao" || v === "não" || v === "off");
}

/**
 * As melhores do ramo que fecham em até `diasParaFechar` dias e ainda não têm proposta, pela nota.
 * Recebe as listas das duas frentes: a mesma oportunidade vale pela maior nota. Fora do ramo (nenhum CNAE casou),
 * sem CNPJ do órgão (não dá para ler o edital) e faixa "nogo" ficam de fora.
 */
export function escolherParaProposta(
  listas: ReadonlyArray<ReadonlyArray<OportunidadeComScore>>,
  agora: Date,
  comProposta: ReadonlySet<string>,
  maximo: number = MAXIMO_PRONTAS_POR_EMPRESA,
  diasParaFechar: number = DIAS_PARA_FECHAR,
): OportunidadeComScore[] {
  const inicio = agora.getTime();
  const fim = inicio + diasParaFechar * 24 * 60 * 60 * 1000;
  const melhores = new Map<string, OportunidadeComScore>();
  for (const lista of listas) {
    for (const o of lista) {
      if (comProposta.has(o.id) || o.orgaoCnpj === "") continue;
      if ((o.score.cnaesCasados.length === 0 && !o.score.foco) || o.score.faixa === "nogo") continue;
      const encerra = Date.parse(o.dataEncerramento);
      if (Number.isNaN(encerra) || encerra <= inicio || encerra > fim) continue;
      const atual = melhores.get(o.id);
      if (!atual || o.score.total > atual.score.total) melhores.set(o.id, o);
    }
  }
  return [...melhores.values()]
    .sort(
      (a, b) =>
        b.score.total - a.score.total ||
        Date.parse(a.dataEncerramento) - Date.parse(b.dataEncerramento) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, Math.max(0, maximo));
}

interface PropostaParaSelo {
  id: string;
  compraId: string | null;
  autor: AutorProposta;
  status: StatusPropostaEquipe;
}

/**
 * compra -> proposta que o assistente montou e que ainda não foi enviada, para o selo "Proposta pronta".
 * A lista chega da mais recente para a mais antiga; vale a primeira de cada compra.
 */
export function prontasPorCompra(propostas: ReadonlyArray<PropostaParaSelo>): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const p of propostas) {
    if (p.autor !== "assistente" || p.status === "enviada" || p.compraId === null) continue;
    if (!(p.compraId in mapa)) mapa[p.compraId] = p.id;
  }
  return mapa;
}
