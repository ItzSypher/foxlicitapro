import type { Deserta } from "@/core/desertas";
import type { PerfilEmpresa } from "@/core/perfil";
import { recomendar, type PreferenciasDeRecomendacao } from "@/core/recomendacao";
import type { Frente, ModalidadeId, OportunidadeComScore } from "@/core/types";
import {
  contarPorFonte,
  contarPorUf,
  filtrar,
  filtrarEOrdenar,
  filtrarPorTexto,
  resumir,
  textoDaOportunidade,
  normalizarBusca,
  type Aba,
  type Filtros,
  type Resumo,
} from "./radar-filtros";
import { calcularPainel, type PainelDia } from "./radar-painel";

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
  /** Desertas e fracassadas das áreas da empresa (aba "Desertas"), da mais recente para a mais antiga */
  desertas?: ReadonlyArray<Deserta>;
}

/** O que o cliente recebe: só a página atual e os totais das abas e dos filtros. */
export interface PaginaRadar {
  itens: OportunidadeComScore[];
  /** Página atual da aba "Desertas" (vazia nas outras abas) */
  desertas: Deserta[];
  /** Oportunidade (id) -> proposta que o assistente montou, para o selo "Proposta pronta"; o servidor preenche */
  prontas: Record<string, string>;
  /** Motivos de cada recomendação da página (aba "Para você") */
  motivos: Record<string, string[]>;
  /** Quantos itens a aba atual tem, somando todas as páginas */
  total: number;
  pagina: number;
  totalPaginas: number;
  porPagina: number;
  inicio: number;
  fim: number;
  /** Oportunidades por UF (sem o filtro de UF), para os chips e o resumo */
  contagensUf: Record<string, number>;
  /** Oportunidades por portal de origem (sem o filtro de fonte) */
  contagensFonte: Record<string, number>;
  /** "Tudo do meu ramo" valendo nesta consulta (URL ou padrão do perfil) */
  tudoDoRamo: boolean;
  /** UFs das áreas que ainda não têm nenhuma coleta no cache */
  ufsPendentes: string[];
  contagensAbas: Record<Aba, number>;
  /** Quantas abertas passaram pelos filtros, base da frase "escolhidas de N abertas" */
  baseRecomendacao: number;
  resumo: Resumo;
  /** Resumo do dia sobre as abertas que passaram pelos filtros atuais */
  painel: PainelDia;
  /** Palavras-chave marcadas que existem entre as guardadas */
  selecionadas: string[];
  atualizadoEm: string;
  falhas: ModalidadeId[];
}

/** Lista do ramo: casa com algum CNAE da empresa ou com uma palavra-chave guardada; só a nota ordena. */
function listaDoRamo(
  base: ReadonlyArray<OportunidadeComScore>,
  palavrasSalvas: ReadonlyArray<string>,
): Array<{ item: OportunidadeComScore; motivo: string }> {
  const termos = palavrasSalvas.map(normalizarBusca).filter((t) => t !== "");
  const achadas: Array<{ item: OportunidadeComScore; motivo: string }> = [];
  for (const item of base) {
    if (item.score.cnaesCasados.length > 0) {
      achadas.push({ item, motivo: `Casa com o CNAE ${item.score.cnaesCasados[0]}` });
      continue;
    }
    const texto = ` ${textoDaOportunidade(item)} `;
    const termo = termos.find((t) => texto.includes(t));
    if (termo !== undefined) achadas.push({ item, motivo: `Palavra-chave: ${termo}` });
  }
  const prazo = (o: OportunidadeComScore): number => Date.parse(o.dataEncerramento);
  return achadas.sort((a, b) => b.item.score.total - a.item.score.total || prazo(a.item) - prazo(b.item));
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
  ufsPendentes: string[] = [],
): PaginaRadar {
  const selecionadas = consulta.palavras.filter((p) => consulta.palavrasSalvas.includes(p));
  const porTexto = filtrarPorTexto(oportunidades, { busca: consulta.busca, palavras: selecionadas });
  const todas = filtrarEOrdenar(porTexto, consulta.filtros);
  const base = filtrar(porTexto, consulta.filtros);
  const tudoDoRamo = consulta.filtros.tudoDoRamo ?? consulta.perfil?.radarTudoDoRamo ?? false;
  const recomendadas: Array<{ item: OportunidadeComScore; motivos: string[] }> = tudoDoRamo
    ? listaDoRamo(base, consulta.palavrasSalvas).map((r) => ({ item: r.item, motivos: [r.motivo] }))
    : recomendar(base, consulta.frente, new Date(referencia), undefined, consulta.preferencias, consulta.perfil);

  const paraVoce = consulta.aba === "para-voce";
  const emDesertas = consulta.aba === "desertas";
  const todasDesertas = consulta.desertas ?? [];
  const visiveis = paraVoce ? recomendadas.map((r) => r.item) : emDesertas ? [] : todas;
  const fatia = paginar(visiveis, consulta.pagina, consulta.porPagina);
  const fatiaDesertas = emDesertas ? paginar(todasDesertas, consulta.pagina, consulta.porPagina) : null;

  const motivos: Record<string, string[]> = {};
  if (paraVoce) {
    const porId = new Map(recomendadas.map((r) => [r.item.id, r.motivos] as const));
    for (const item of fatia.itens) {
      const m = porId.get(item.id);
      if (m) motivos[item.id] = m;
    }
  }

  const paginaAtual = fatiaDesertas ?? fatia;
  return {
    itens: fatia.itens,
    desertas: fatiaDesertas ? fatiaDesertas.itens : [],
    prontas: {},
    motivos,
    total: fatiaDesertas ? todasDesertas.length : visiveis.length,
    pagina: paginaAtual.pagina,
    totalPaginas: paginaAtual.totalPaginas,
    porPagina: consulta.porPagina,
    inicio: paginaAtual.inicio,
    fim: paginaAtual.fim,
    contagensUf: contarPorUf(filtrar(porTexto, { ...consulta.filtros, ufs: [] })),
    contagensFonte: contarPorFonte(filtrar(porTexto, { ...consulta.filtros, fontes: [] })),
    tudoDoRamo,
    ufsPendentes,
    contagensAbas: { "para-voce": recomendadas.length, todas: todas.length, desertas: todasDesertas.length },
    baseRecomendacao: base.length,
    resumo: resumir(oportunidades, agora),
    painel: calcularPainel(base, agora),
    selecionadas,
    atualizadoEm,
    falhas,
  };
}
