import type { Faixa, ModalidadeId, OportunidadeComScore, Regiao } from "@/core/types";
import { normalizarTexto } from "@/core/cnae-keywords";

export type FiltroRegiao = "todo" | "nova-iguacu" | "baixada" | "capital";
export type FiltroModalidade = "todas" | "dispensa" | "pregao";
export type Ordem = "sinal" | "prazo" | "valor";

export interface Filtros {
  regiao: FiltroRegiao;
  modalidade: FiltroModalidade;
  ordem: Ordem;
}

export type Visao = "cards" | "lista";

export type Aba = "para-voce" | "todas";

export const ABA_PADRAO: Aba = "para-voce";

export const ABAS: ReadonlyArray<{ id: Aba; rotulo: string }> = [
  { id: "para-voce", rotulo: "Para você" },
  { id: "todas", rotulo: "Todas" },
];

/** Aba pedida em ?aba= (a padrão quando falta ou é inválida). */
export function lerAba(params: { get(nome: string): string | null }): Aba {
  const bruto = params.get("aba");
  return ABAS.some((aba) => aba.id === bruto) ? (bruto as Aba) : ABA_PADRAO;
}

export const COOKIE_VISAO = "visao";
export const VISAO_PADRAO: Visao = "cards";

/** Itens por página em cada visualização. */
export const POR_PAGINA: Record<Visao, number> = { cards: 12, lista: 25 };

export const VISOES: ReadonlyArray<{ id: Visao; rotulo: string }> = [
  { id: "cards", rotulo: "Cards" },
  { id: "lista", rotulo: "Lista" },
];

export function ehVisao(valor: unknown): valor is Visao {
  return valor === "cards" || valor === "lista";
}

export function lerVisao(valor: string | null | undefined): Visao {
  return ehVisao(valor) ? valor : VISAO_PADRAO;
}

export const FILTROS_PADRAO: Filtros = { regiao: "todo", modalidade: "todas", ordem: "sinal" };

export const REGIOES: ReadonlyArray<{ id: FiltroRegiao; rotulo: string }> = [
  { id: "todo", rotulo: "Todo o RJ" },
  { id: "nova-iguacu", rotulo: "Nova Iguaçu" },
  { id: "baixada", rotulo: "Baixada Fluminense" },
  { id: "capital", rotulo: "RJ Capital" },
];

export const MODALIDADES: ReadonlyArray<{ id: FiltroModalidade; rotulo: string }> = [
  { id: "todas", rotulo: "Todas" },
  { id: "dispensa", rotulo: "Dispensa" },
  { id: "pregao", rotulo: "Pregão" },
];

export const ORDENS: ReadonlyArray<{ id: Ordem; rotulo: string }> = [
  { id: "sinal", rotulo: "Melhor nota" },
  { id: "prazo", rotulo: "Prazo" },
  { id: "valor", rotulo: "Maior valor" },
];

/** Identificadores do PNCP: 6 = Pregão eletrônico, 8 = Dispensa. */
export function nomeModalidade(id: ModalidadeId): string {
  return id === 6 ? "Pregão" : "Dispensa";
}

export function nomeFaixa(faixa: Faixa): string {
  if (faixa === "go") return "Bom";
  if (faixa === "atencao") return "Atenção";
  return "Evitar";
}

function ehUmDe<T extends string>(valor: string | null, opcoes: ReadonlyArray<{ id: T }>): valor is T {
  return opcoes.some((opcao) => opcao.id === valor);
}

export function lerFiltros(params: { get(nome: string): string | null }): Filtros {
  const regiao = params.get("regiao");
  const modalidade = params.get("modalidade");
  const ordem = params.get("ordem");
  return {
    regiao: ehUmDe(regiao, REGIOES) ? regiao : FILTROS_PADRAO.regiao,
    modalidade: ehUmDe(modalidade, MODALIDADES) ? modalidade : FILTROS_PADRAO.modalidade,
    ordem: ehUmDe(ordem, ORDENS) ? ordem : FILTROS_PADRAO.ordem,
  };
}

/** Regiões do RJ; "Baixada Fluminense" inclui Nova Iguaçu. */
function pertenceARegiao(regiao: Regiao, filtro: FiltroRegiao): boolean {
  if (regiao === "fora-rj") return false;
  if (filtro === "todo") return true;
  if (filtro === "baixada") return regiao === "baixada" || regiao === "nova-iguacu";
  return regiao === filtro;
}

export function contarPorRegiao(
  lista: ReadonlyArray<OportunidadeComScore>,
): Record<FiltroRegiao, number> {
  const contagem: Record<FiltroRegiao, number> = { todo: 0, "nova-iguacu": 0, baixada: 0, capital: 0 };
  for (const item of lista) {
    for (const { id } of REGIOES) {
      if (pertenceARegiao(item.regiao, id)) contagem[id] += 1;
    }
  }
  return contagem;
}

function pertenceAModalidade(id: ModalidadeId, filtro: FiltroModalidade): boolean {
  if (filtro === "todas") return true;
  return filtro === "dispensa" ? id === 8 : id === 6;
}

function prazo(item: OportunidadeComScore): number {
  const valor = Date.parse(item.dataEncerramento);
  return Number.isNaN(valor) ? Number.POSITIVE_INFINITY : valor;
}

/** Aplica só os filtros de região e modalidade, sem ordenar. */
export function filtrar(lista: ReadonlyArray<OportunidadeComScore>, filtros: Filtros): OportunidadeComScore[] {
  return lista.filter(
    (item) =>
      pertenceARegiao(item.regiao, filtros.regiao) &&
      pertenceAModalidade(item.modalidadeId, filtros.modalidade),
  );
}

export function filtrarEOrdenar(
  lista: ReadonlyArray<OportunidadeComScore>,
  filtros: Filtros,
): OportunidadeComScore[] {
  const filtrada = filtrar(lista, filtros);

  const porPrazo = (a: OportunidadeComScore, b: OportunidadeComScore): number => prazo(a) - prazo(b);

  return filtrada.sort((a, b) => {
    if (filtros.ordem === "prazo") return porPrazo(a, b);
    if (filtros.ordem === "valor") {
      const va = a.valorEstimado;
      const vb = b.valorEstimado;
      if (va === null && vb === null) return porPrazo(a, b);
      if (va === null) return 1;
      if (vb === null) return -1;
      return vb - va || porPrazo(a, b);
    }
    return b.score.total - a.score.total || porPrazo(a, b);
  });
}

export interface Resumo {
  abertas: number;
  encerram24h: number;
  sinalVerde: number;
}

export function resumir(lista: ReadonlyArray<OportunidadeComScore>, agora: number): Resumo {
  let abertas = 0;
  let encerram24h = 0;
  let sinalVerde = 0;
  for (const item of lista) {
    if (item.regiao === "fora-rj") continue;
    abertas += 1;
    const restante = prazo(item) - agora;
    if (restante > 0 && restante < 24 * 3_600_000) encerram24h += 1;
    if (item.score.faixa === "go") sinalVerde += 1;
  }
  return { abertas, encerram24h, sinalVerde };
}

/** Número da página pedido na URL (1 quando falta ou é inválido). */
export function lerPagina(params: { get(nome: string): string | null }): number {
  const bruto = Number.parseInt(params.get("pagina") ?? "", 10);
  return Number.isFinite(bruto) && bruto >= 1 ? bruto : 1;
}

export type ItemPaginacao = number | "reticencias-inicio" | "reticencias-fim";

/** Até 7 itens: números e reticências, sempre com a primeira e a última página. */
export function itensPaginacao(atual: number, total: number): ItemPaginacao[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (atual <= 4) return [1, 2, 3, 4, 5, "reticencias-fim", total];
  if (atual >= total - 3) return [1, "reticencias-inicio", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "reticencias-inicio", atual - 1, atual, atual + 1, "reticencias-fim", total];
}

/**
 * Quantos filtros do painel (modalidade e ordem) estão fora do padrão.
 * Em "Para você" a ordem é a da recomendação e não conta.
 */
export function contarFiltrosAtivos(filtros: Filtros, contarOrdem = true): number {
  let n = 0;
  if (filtros.modalidade !== FILTROS_PADRAO.modalidade) n += 1;
  if (contarOrdem && filtros.ordem !== FILTROS_PADRAO.ordem) n += 1;
  return n;
}

/** "12 escolhidas para o seu perfil de 891 abertas" */
export function fraseRecomendadas(escolhidas: number, abertas: number): string {
  const e = escolhidas === 1 ? "escolhida" : "escolhidas";
  const a = abertas === 1 ? "aberta" : "abertas";
  return `${escolhidas} ${e} para o seu perfil de ${abertas} ${a}`;
}

/** "880 abertas · 210 fecham em 24 h · 24 boas" */
export function fraseResumo(resumo: Resumo): string {
  const abertas = resumo.abertas === 1 ? "aberta" : "abertas";
  const fecham = resumo.encerram24h === 1 ? "fecha" : "fecham";
  const boas = resumo.sinalVerde === 1 ? "boa" : "boas";
  return `${resumo.abertas} ${abertas} · ${resumo.encerram24h} ${fecham} em 24 h · ${resumo.sinalVerde} ${boas}`;
}

export function frasePlural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** Frase do estado vazio, por exemplo "Nenhuma oportunidade em Nova Iguaçu hoje." */
export function fraseVazio(filtros: Filtros): string {
  const tipo =
    filtros.modalidade === "dispensa" ? "dispensa" : filtros.modalidade === "pregao" ? "pregão" : "oportunidade";
  const local: Record<FiltroRegiao, string> = {
    todo: "no RJ",
    "nova-iguacu": "em Nova Iguaçu",
    baixada: "na Baixada Fluminense",
    capital: "na capital do Rio de Janeiro",
  };
  return `Nenhuma ${tipo} ${local[filtros.regiao]} hoje.`;
}

/** Busca por texto e palavras-chave do Radar. */
export interface FiltroTexto {
  /** Texto digitado; todas as palavras precisam aparecer (objeto, órgão, unidade ou município) */
  busca: string;
  /** Palavras-chave marcadas; basta uma aparecer (OU). Combina com a busca (E). */
  palavras: ReadonlyArray<string>;
}

export const MAX_BUSCA = 100;
export const MAX_PALAVRAS_SELECIONADAS = 20;

/** Sem acento, sem caixa, só letras e dígitos separados por um espaço. */
export function normalizarBusca(texto: string): string {
  return normalizarTexto(texto.slice(0, 400));
}

/** Texto da busca pedido em ?q= (aparado e limitado). */
export function lerBusca(params: { get(nome: string): string | null }): string {
  return (params.get("q") ?? "").slice(0, MAX_BUSCA).trim();
}

/** Palavras-chave marcadas em ?pc= (separadas por vírgula), normalizadas e sem repetir. */
export function lerPalavras(params: { get(nome: string): string | null }): string[] {
  const vistos = new Set<string>();
  for (const parte of (params.get("pc") ?? "").split(",")) {
    const termo = normalizarBusca(parte);
    if (termo !== "") vistos.add(termo);
    if (vistos.size >= MAX_PALAVRAS_SELECIONADAS) break;
  }
  return [...vistos];
}

export function textoDaOportunidade(item: OportunidadeComScore): string {
  return normalizarBusca(`${item.objeto} ${item.orgao} ${item.unidade} ${item.municipio}`);
}

export function temFiltroTexto(filtro: FiltroTexto): boolean {
  return normalizarBusca(filtro.busca) !== "" || filtro.palavras.length > 0;
}

/** Aplica a busca (todas as palavras digitadas) e as palavras-chave (qualquer uma). Sem nada marcado, devolve a lista inteira. */
export function filtrarPorTexto(
  lista: ReadonlyArray<OportunidadeComScore>,
  filtro: FiltroTexto,
): OportunidadeComScore[] {
  const palavrasDaBusca = normalizarBusca(filtro.busca).split(" ").filter((p) => p !== "");
  const termos = filtro.palavras.map(normalizarBusca).filter((t) => t !== "");
  if (palavrasDaBusca.length === 0 && termos.length === 0) return [...lista];
  return lista.filter((item) => {
    const texto = ` ${textoDaOportunidade(item)} `;
    const buscaOk = palavrasDaBusca.every((p) => texto.includes(p));
    const palavrasOk = termos.length === 0 || termos.some((t) => texto.includes(t));
    return buscaOk && palavrasOk;
  });
}
