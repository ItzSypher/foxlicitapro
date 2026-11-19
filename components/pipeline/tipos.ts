import type { ResumoCotacoes } from "@/core/cotacoes-resumo";
import type { PrecoSugerido } from "@/core/preco-sugerido";
import type { MarcaJuridica } from "@/core/revisao-juridica";
import { acharUf } from "@/core/ufs";
import type { OportunidadeComScore, Regiao } from "@/core/types";

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
  /** Preço sugerido calculado no servidor pela página (null: ainda não calculado, ex. listagem sem perfil) */
  preco: PrecoSugerido | null;
  /** Total da proposta aprovada, pronta ou enviada ligada ao item (null: nenhuma) */
  valorProposto: number | null;
}

/** Pessoa que pode ser responsável por um item */
export interface PessoaPipeline {
  id: string;
  nome: string;
}

/** "Só os meus": sou o responsável, ou adicionei e ninguém assumiu. */
export function ehMeu(item: Pick<ItemPipeline, "responsavelId" | "criadoPorId">, usuarioId: string): boolean {
  return item.responsavelId === usuarioId || (item.responsavelId === null && item.criadoPorId === usuarioId);
}

/** O mínimo de um item encerrado que o Pipeline precisa para contar quantos há sob os filtros ativos. */
export interface ResumoEncerrada {
  uf: string;
  responsavelId: string | null;
  criadoPorId: string | null;
}

/** Rótulo curto da região, usado na etiqueta do card e no filtro. */
export const ROTULO_REGIAO: Record<Regiao, string> = {
  "nova-iguacu": "Nova Iguaçu",
  capital: "Capital",
  baixada: "Baixada",
  rj: "Interior RJ",
  "fora-rj": "Fora do RJ",
};

export const REGIOES_PIPELINE: readonly Regiao[] = ["nova-iguacu", "baixada", "capital", "rj", "fora-rj"];

/** "todas" não filtra; as demais são a sigla da UF (maiúsculas) e mostram só os itens daquele estado. */
export type FiltroUfPipeline = string;

export const TODAS_AS_UFS = "todas";

/** Lê o filtro de UF vindo da URL: "todas" ou uma sigla válida (aceita minúsculas). Qualquer outra coisa vira "todas". */
export function lerFiltroUf(valor: unknown): FiltroUfPipeline {
  if (typeof valor !== "string") return TODAS_AS_UFS;
  const sigla = valor.trim().toUpperCase();
  return acharUf(sigla) ? sigla : TODAS_AS_UFS;
}

export function filtrarPorUf<T extends { item: { uf: string } }>(itens: readonly T[], filtro: FiltroUfPipeline): T[] {
  return filtro === TODAS_AS_UFS ? [...itens] : itens.filter((i) => i.item.uf.trim().toUpperCase() === filtro);
}

/** Itens por UF (sigla em maiúsculas), mais a chave "todas" com o total. */
export function contarPorUf(itens: readonly { item: { uf: string } }[]): Record<string, number> {
  const contagem: Record<string, number> = { [TODAS_AS_UFS]: itens.length };
  for (const i of itens) {
    const uf = i.item.uf.trim().toUpperCase();
    contagem[uf] = (contagem[uf] ?? 0) + 1;
  }
  return contagem;
}

/** UFs do filtro: as das áreas da empresa mais as que já têm item, sem repetir e em ordem alfabética. */
export function ufsDoFiltro(ufsDasAreas: readonly string[], itens: readonly { item: { uf: string } }[]): string[] {
  const siglas = new Set<string>();
  for (const u of ufsDasAreas) siglas.add(u.trim().toUpperCase());
  for (const i of itens) siglas.add(i.item.uf.trim().toUpperCase());
  siglas.delete("");
  return [...siglas].sort();
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
