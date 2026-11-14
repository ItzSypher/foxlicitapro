/** Resumo das cotações de um item do pipeline (funções puras, sem banco). */
import type { Frente } from "@/core/types";
import { normalizarTexto } from "@/core/texto-busca";

export interface CotacaoParaResumo {
  descricao: string;
  frente: Frente;
  /** Preço de venda (alvo) da cotação, em reais */
  precoVenda: number;
  /** Custo informado na cotação, em reais */
  custo: number;
  /** Margem alvo como fração (0,2 = 20%) */
  margem: number;
  /** ISO 8601 */
  criadoEm: string;
}

export interface Estatistica {
  media: number;
  menor: number;
  maior: number;
}

export interface ListaCotada {
  /** Descrição normalizada: junta "Monitor 24" e "monitor 24" */
  chave: string;
  /** Descrição da cotação mais recente da lista */
  descricao: string;
  quantidade: number;
  venda: Estatistica;
  custo: Estatistica;
}

export interface GrupoFrente {
  frente: Frente;
  quantidade: number;
  venda: Estatistica;
  custo: Estatistica;
  listas: ListaCotada[];
}

export interface ResumoCotacoes {
  quantidade: number;
  /** Cotação mais recente: base do selo do card */
  ultima: { precoVenda: number; margem: number; criadoEm: string };
  /** Produtos antes de serviços; só as frentes com cotação */
  frentes: GrupoFrente[];
}

const ORDEM_FRENTES: readonly Frente[] = ["produtos", "servicos"];

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function estatistica(valores: readonly number[]): Estatistica {
  const primeiro = valores[0];
  if (primeiro === undefined) return { media: 0, menor: 0, maior: 0 };
  let soma = 0;
  let menor = primeiro;
  let maior = primeiro;
  for (const v of valores) {
    soma += v;
    if (v < menor) menor = v;
    if (v > maior) maior = v;
  }
  return { media: arredondar(soma / valores.length), menor, maior };
}

function maisRecente(a: CotacaoParaResumo, b: CotacaoParaResumo): number {
  return b.criadoEm.localeCompare(a.criadoEm);
}

/** Null quando não há cotação. Agrupa por frente e, dentro dela, por descrição normalizada. */
export function resumirCotacoes(cotacoes: readonly CotacaoParaResumo[]): ResumoCotacoes | null {
  const ordenadas = [...cotacoes].sort(maisRecente);
  const ultima = ordenadas[0];
  if (!ultima) return null;

  const frentes: GrupoFrente[] = [];
  for (const frente of ORDEM_FRENTES) {
    const daFrente = ordenadas.filter((c) => c.frente === frente);
    if (daFrente.length === 0) continue;
    const porLista = new Map<string, CotacaoParaResumo[]>();
    for (const c of daFrente) {
      const chave = normalizarTexto(c.descricao);
      const atual = porLista.get(chave);
      if (atual) atual.push(c);
      else porLista.set(chave, [c]);
    }
    const listas: ListaCotada[] = [...porLista.entries()].map(([chave, itens]) => ({
      chave,
      descricao: itens[0]?.descricao ?? chave,
      quantidade: itens.length,
      venda: estatistica(itens.map((i) => i.precoVenda)),
      custo: estatistica(itens.map((i) => i.custo)),
    }));
    frentes.push({
      frente,
      quantidade: daFrente.length,
      venda: estatistica(daFrente.map((c) => c.precoVenda)),
      custo: estatistica(daFrente.map((c) => c.custo)),
      listas,
    });
  }

  return {
    quantidade: ordenadas.length,
    ultima: { precoVenda: ultima.precoVenda, margem: ultima.margem, criadoEm: ultima.criadoEm },
    frentes,
  };
}

/** Margem como número inteiro de pontos percentuais (0,2 vira 20). */
export function margemEmPercentual(fracao: number): number {
  return Math.round(fracao * 100);
}
