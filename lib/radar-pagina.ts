import type { PerfilEmpresa } from "@/core/perfil";
import { recomendar, type PreferenciasDeRecomendacao } from "@/core/recomendacao";
import type { Frente, ModalidadeId, OportunidadeComScore } from "@/core/types";
import {
  contarPorRegiao,
  filtrar,
  filtrarEOrdenar,
  filtrarPorTexto,
  resumir,
  type Aba,
  type FiltroRegiao,
  type Filtros,
  type Resumo,
} from "./radar-filtros";

/** Itens por página que o seletor oferece. */
export const POR_PAGINA_OPCOES = [6, 12, 18] as const;
export type PorPagina = (typeof POR_PAGINA_OPCOES)[number];
export const POR_PAGINA_PADRAO: PorPagina = 12;

/** Itens por página pedidos em ?por= (12 quando falta ou é inválido). */
export function lerPorPagina(params: { get(nome: string): string | null }): PorPagina {
  const bruto = Number.parseInt(params.get("por") ?? "", 10);
  return POR_PAGINA_OPCOES.find((n) => n === bruto) ?? POR_PAGINA_PADRAO;
}

export interface Fatia<T> {
  itens: T[];
  /** Página efetiva (a pedida, limitada ao total de páginas) */
  pagina: number;
  totalPaginas: number;
  /** Posição do primeiro e do último item da página, contando de 1; 0 e 0 quando a lista é vazia */
  inicio: number;
  fim: number;
}

/** Recorta uma página; página fora do intervalo vira a última. Função pura. */
export function paginar<T>(lista: ReadonlyArray<T>, paginaPedida: number, porPagina: number): Fatia<T> {
  const tamanho = Math.max(1, Math.floor(porPagina));
  const totalPaginas = Math.max(1, Math.ceil(lista.length / tamanho));
  const pagina = Math.min(Math.max(1, Math.floor(paginaPedida) || 1), totalPaginas);
  const primeiro = (pagina - 1) * tamanho;
  const itens = lista.slice(primeiro, primeiro + tamanho);
  return {
    itens,
    pagina,
    totalPaginas,
    inicio: itens.length === 0 ? 0 : primeiro + 1,
    fim: primeiro + itens.length,
  };
}

/** Tudo que a URL decide sobre a lista do Radar. */
export interface ConsultaRadar {
  frente: Frente;
  filtros: Filtros;
  aba: Aba;
  busca: string;
  /** Palavras-chave marcadas na URL; só valem as que a pessoa guardou */
  palavras: ReadonlyArray<string>;
  palavrasSalvas: ReadonlyArray<string>;
  pagina: number;
  porPagina: number;
  preferencias?: PreferenciasDeRecomendacao;
  /** Perfil da empresa logada; sem ele, vale o perfil de origem (testes) */
  perfil?: PerfilEmpresa;
}

/** O que o cliente recebe: só a página atual e os totais das abas e dos filtros. */
export interface PaginaRadar {
  itens: OportunidadeComScore[];
  /** Motivos de cada recomendação da página (aba "Para você") */
  motivos: Record<string, string[]>;
  /** Quantos itens a aba atual tem, somando todas as páginas */
  total: number;
  pagina: number;
  totalPaginas: number;
  porPagina: number;
  inicio: number;
  fim: number;
  contagensRegiao: Record<FiltroRegiao, number>;
  contagensAbas: Record<Aba, number>;
  /** Quantas abertas passaram pelos filtros, base da frase "escolhidas de N abertas" */
  baseRecomendacao: number;
  resumo: Resumo;
  /** Palavras-chave marcadas que existem entre as guardadas */
  selecionadas: string[];
  atualizadoEm: string;
  falhas: ModalidadeId[];
}

/**
 * Filtra, ordena e pagina no servidor. `agora` (ms) mede os prazos do resumo;
 * `referencia` (ms) é o relógio das recomendações, estável entre cliques.
 */
export function montarPaginaRadar(
  oportunidades: ReadonlyArray<OportunidadeComScore>,
  consulta: ConsultaRadar,
  agora: number,
  referencia: number,
  atualizadoEm: string,
  falhas: ModalidadeId[],
): PaginaRadar {
  const selecionadas = consulta.palavras.filter((p) => consulta.palavrasSalvas.includes(p));
  const porTexto = filtrarPorTexto(oportunidades, { busca: consulta.busca, palavras: selecionadas });
  const todas = filtrarEOrdenar(porTexto, consulta.filtros);
  const base = filtrar(porTexto, consulta.filtros);
  const recomendadas = recomendar(base, consulta.frente, new Date(referencia), undefined, consulta.preferencias, consulta.perfil);

  const paraVoce = consulta.aba === "para-voce";
  const visiveis = paraVoce ? recomendadas.map((r) => r.item) : todas;
  const fatia = paginar(visiveis, consulta.pagina, consulta.porPagina);

  const motivos: Record<string, string[]> = {};
  if (paraVoce) {
    const porId = new Map(recomendadas.map((r) => [r.item.id, r.motivos] as const));
    for (const item of fatia.itens) {
      const m = porId.get(item.id);
      if (m) motivos[item.id] = m;
    }
  }

  return {
    itens: fatia.itens,
    motivos,
    total: visiveis.length,
    pagina: fatia.pagina,
    totalPaginas: fatia.totalPaginas,
    porPagina: consulta.porPagina,
    inicio: fatia.inicio,
    fim: fatia.fim,
    contagensRegiao: contarPorRegiao(porTexto),
    contagensAbas: { "para-voce": recomendadas.length, todas: todas.length },
    baseRecomendacao: base.length,
    resumo: resumir(oportunidades, agora),
    selecionadas,
    atualizadoEm,
    falhas,
  };
}
