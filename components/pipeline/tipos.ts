import type { ResumoCotacoes } from "@/core/cotacoes-resumo";
import type { MarcaJuridica } from "@/core/revisao-juridica";
import type { OportunidadeComScore } from "@/core/types";

/** Tipos e regras puras do pipeline, compartilhados entre servidor e cliente. */

export const ETAPAS = [
  { id: "radar", rotulo: "No radar" },
  { id: "analisando", rotulo: "Analisando edital" },
  { id: "cotando", rotulo: "Cotando fornecedor" },
  { id: "revisao_juridica", rotulo: "Revisão jurídica" },
  { id: "proposta", rotulo: "Proposta pronta" },
  { id: "disputa", rotulo: "Em disputa" },
  { id: "ganha", rotulo: "Ganha" },
  { id: "perdida", rotulo: "Perdida" },
] as const;

export type EtapaId = (typeof ETAPAS)[number]["id"];

export const ROTULO_ETAPA: Record<EtapaId, string> = {
  radar: "No radar",
  analisando: "Analisando edital",
  cotando: "Cotando fornecedor",
  revisao_juridica: "Revisão jurídica",
  proposta: "Proposta pronta",
  disputa: "Em disputa",
  ganha: "Ganha",
  perdida: "Perdida",
};

/** Etapas em que a oportunidade ainda está viva. */
export const ETAPAS_ATIVAS: readonly EtapaId[] = ["radar", "analisando", "cotando", "revisao_juridica", "proposta", "disputa"];

export function ehEtapa(valor: unknown): valor is EtapaId {
  return ETAPAS.some((e) => e.id === valor);
}

export interface ItemPipeline {
  id: string;
  etapa: EtapaId;
  ordem: number;
  notas: string;
  criadoEm: string;
  atualizadoEm: string;
  item: OportunidadeComScore;
  /** Quem adicionou ao pipeline (null: item antigo ou pessoa removida) */
  criadoPorId: string | null;
  criadoPorNome: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  comentarios: number;
  /** Passos do checklist jurídico já marcados (vazio para itens sem revisão) */
  revisao: MarcaJuridica[];
  /** Resumo das cotações da calculadora ligadas ao item (null: nenhuma) */
  cotacoes: ResumoCotacoes | null;
}

/** Pessoa que pode ser responsável por um item */
export interface PessoaPipeline {
  id: string;
  nome: string;
}

/** "Só os meus": sou o responsável, ou adicionei e ninguém assumiu. */
export function ehMeu(item: ItemPipeline, usuarioId: string): boolean {
  return item.responsavelId === usuarioId || (item.responsavelId === null && item.criadoPorId === usuarioId);
}

export interface ResumoEtapa {
  quantidade: number;
  valor: number;
}

export interface ResumoPipeline {
  porEtapa: Record<EtapaId, ResumoEtapa>;
  /** Itens fora de ganha e perdida */
  ativas: number;
  /** Soma do valor estimado dos itens ativos */
  valorAtivo: number;
  emDisputa: ResumoEtapa;
  ganhas: number;
  perdidas: number;
  /** ganhas / (ganhas + perdidas); null enquanto não houver nenhuma encerrada */
  taxaVitoria: number | null;
}

export type ResultadoAcao = { ok: true } | { ok: false; erro: string };

/** Cada linha agrega `quantidade` itens da etapa com `valor` somado (itens sem valor contam como 0). */
export function montarResumo(
  linhas: ReadonlyArray<{ etapa: EtapaId; quantidade: number; valor: number | null }>,
): ResumoPipeline {
  const porEtapa: Record<EtapaId, ResumoEtapa> = {
    radar: { quantidade: 0, valor: 0 },
    analisando: { quantidade: 0, valor: 0 },
    cotando: { quantidade: 0, valor: 0 },
    revisao_juridica: { quantidade: 0, valor: 0 },
    proposta: { quantidade: 0, valor: 0 },
    disputa: { quantidade: 0, valor: 0 },
    ganha: { quantidade: 0, valor: 0 },
    perdida: { quantidade: 0, valor: 0 },
  };
  for (const linha of linhas) {
    porEtapa[linha.etapa].quantidade += linha.quantidade;
    porEtapa[linha.etapa].valor += linha.valor ?? 0;
  }
  let ativas = 0;
  let valorAtivo = 0;
  for (const id of ETAPAS_ATIVAS) {
    ativas += porEtapa[id].quantidade;
    valorAtivo += porEtapa[id].valor;
  }
  const ganhas = porEtapa.ganha.quantidade;
  const perdidas = porEtapa.perdida.quantidade;
  return {
    porEtapa,
    ativas,
    valorAtivo,
    emDisputa: porEtapa.disputa,
    ganhas,
    perdidas,
    taxaVitoria: ganhas + perdidas > 0 ? ganhas / (ganhas + perdidas) : null,
  };
}
