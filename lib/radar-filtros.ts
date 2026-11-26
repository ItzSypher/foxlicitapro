import type { Faixa, ModalidadeId, OportunidadeComScore } from "@/core/types";
import { normalizarTexto } from "@/core/cnae-keywords";
import { acharUf } from "@/core/ufs";
import { FONTES, fonteDaOportunidade, type Fonte } from "@/core/fonte";
import { nivelCaixa, valorEstimadoCaixa } from "@/core/caminho-dinheiro";

export type FiltroModalidade = "todas" | "dispensa" | "pregao";
export type Ordem = "sinal" | "prazo" | "valor" | "recentes";

export interface Filtros {
  /** Siglas das UFs marcadas; vazio mostra todas as áreas da empresa */
  ufs: string[];
  modalidade: FiltroModalidade;
  ordem: Ordem;
  /** Faixa de valor estimado em reais; null não limita. Itens sem valor saem quando há limite. */
  valorMin: number | null;
  valorMax: number | null;
  /** Portais marcados; vazio mostra todos */
  fontes: Fonte[];
  /** "Tudo do meu ramo" pedido na URL; null segue o padrão do perfil */
  tudoDoRamo: boolean | null;
  /** "Pouco caixa": só oportunidades de nível de caixa baixo (?caixa=1) */
  poucoCaixa: boolean;
  /** "Caixa até R$ X": máximo do caixa estimado antes de receber (?caixaMax=5000); null não limita. Sem estimativa, não passa. */
  caixaMax: number | null;
}

export type Visao = "cards" | "lista";

export type Aba = "para-voce" | "todas" | "desertas";

export const ABA_PADRAO: Aba = "para-voce";

export const ABAS: ReadonlyArray<{ id: Aba; rotulo: string }> = [
  { id: "para-voce", rotulo: "Para você" },
  { id: "todas", rotulo: "Todas" },
  { id: "desertas", rotulo: "Desertas" },
];

/** Aba pedida em ?aba= (a padrão quando falta ou é inválida). */
export function lerAba(params: { get(nome: string): string | null }): Aba {
  const bruto = params.get("aba");
  return ABAS.some((aba) => aba.id === bruto) ? (bruto as Aba) : ABA_PADRAO;
}

export const COOKIE_VISAO = "visao";
export const VISAO_PADRAO: Visao = "cards";

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

export const FILTROS_PADRAO: Filtros = {
  ufs: [],
  modalidade: "todas",
  ordem: "sinal",
  valorMin: null,
  valorMax: null,
  fontes: [],
  tudoDoRamo: null,
  poucoCaixa: false,
  caixaMax: null,
};

/** Valores prontos do seletor "Caixa até", em reais. */
export const LIMITES_CAIXA: ReadonlyArray<number> = [1_000, 2_000, 5_000, 10_000, 20_000];

export const MODALIDADES: ReadonlyArray<{ id: FiltroModalidade; rotulo: string }> = [
  { id: "todas", rotulo: "Todas" },
  { id: "dispensa", rotulo: "Dispensa" },
  { id: "pregao", rotulo: "Pregão" },
];

export const ORDENS: ReadonlyArray<{ id: Ordem; rotulo: string }> = [
  { id: "sinal", rotulo: "Melhor nota" },
  { id: "prazo", rotulo: "Prazo" },
  { id: "valor", rotulo: "Maior valor" },
  { id: "recentes", rotulo: "Mais recentes" },
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

/** Lista separada por vírgula, sem repetir e com no máximo `limite` itens. */
function lerLista(bruto: string | null, limite: number): string[] {
  const vistos = new Set<string>();
  for (const parte of (bruto ?? "").split(",")) {
    const termo = parte.trim();
    if (termo !== "") vistos.add(termo);
    if (vistos.size >= limite) break;
  }
  return [...vistos];
}

function lerValor(bruto: string | null): number | null {
  if (bruto === null || bruto.trim() === "") return null;
  const n = Number(bruto);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

export function lerFiltros(params: { get(nome: string): string | null }): Filtros {
  const modalidade = params.get("modalidade");
  const ordem = params.get("ordem");
  const ramo = params.get("ramo");
  let valorMin = lerValor(params.get("vmin"));
  let valorMax = lerValor(params.get("vmax"));
  if (valorMin !== null && valorMax !== null && valorMin > valorMax) [valorMin, valorMax] = [valorMax, valorMin];
  return {
    ufs: lerLista(params.get("uf"), 27)
      .map((u) => acharUf(u)?.sigla)
      .filter((u): u is string => u !== undefined),
    modalidade: ehUmDe(modalidade, MODALIDADES) ? modalidade : FILTROS_PADRAO.modalidade,
    ordem: ehUmDe(ordem, ORDENS) ? ordem : FILTROS_PADRAO.ordem,
    valorMin,
    valorMax,
    fontes: lerLista(params.get("fonte"), FONTES.length).filter((f): f is Fonte => (FONTES as readonly string[]).includes(f)),
    tudoDoRamo: ramo === "1" ? true : ramo === "0" ? false : null,
    poucoCaixa: params.get("caixa") === "1",
    caixaMax: lerValor(params.get("caixaMax")),
  };
}

/** Quantas oportunidades há em cada UF, para os chips do filtro e o resumo do dia. */
export function contarPorUf(lista: ReadonlyArray<OportunidadeComScore>): Record<string, number> {
  const contagem: Record<string, number> = {};
  for (const item of lista) contagem[item.uf] = (contagem[item.uf] ?? 0) + 1;
  return contagem;
}

/** Quantas oportunidades há em cada fonte. */
export function contarPorFonte(lista: ReadonlyArray<OportunidadeComScore>): Record<string, number> {
  const contagem: Record<string, number> = {};
  for (const item of lista) {
    const fonte = fonteDaOportunidade(item.linkOrigem, item.linkAlerta);
    contagem[fonte] = (contagem[fonte] ?? 0) + 1;
  }
  return contagem;
}

function pertenceAModalidade(id: ModalidadeId, filtro: FiltroModalidade): boolean {
  if (filtro === "todas") return true;
  return filtro === "dispensa" ? id === 8 : id === 6;
}

/** Instante da publicação no PNCP; itens sem a data valem 0 e ficam por último em "mais recentes". */
function publicacao(item: OportunidadeComScore): number {
  const valor = Date.parse(item.dataPublicacao ?? "");
  return Number.isNaN(valor) ? 0 : valor;
}

function prazo(item: OportunidadeComScore): number {
  const valor = Date.parse(item.dataEncerramento);
  return Number.isNaN(valor) ? Number.POSITIVE_INFINITY : valor;
}

function dentroDaFaixaDeValor(valor: number | null, filtros: Filtros): boolean {
  if (filtros.valorMin === null && filtros.valorMax === null) return true;
  if (valor === null) return false;
  return (filtros.valorMin === null || valor >= filtros.valorMin) && (filtros.valorMax === null || valor <= filtros.valorMax);
}

function dentroDoCaixaMax(item: OportunidadeComScore, filtros: Filtros): boolean {
  if (filtros.caixaMax === null) return true;
  const caixa = valorEstimadoCaixa(item);
  return caixa !== null && caixa <= filtros.caixaMax;
}

/** Aplica os filtros de UF, modalidade, faixa de valor, fonte, pouco caixa e caixa até, sem ordenar. */
export function filtrar(lista: ReadonlyArray<OportunidadeComScore>, filtros: Filtros): OportunidadeComScore[] {
  return lista.filter(
    (item) =>
      (filtros.ufs.length === 0 || filtros.ufs.includes(item.uf)) &&
      pertenceAModalidade(item.modalidadeId, filtros.modalidade) &&
      dentroDaFaixaDeValor(item.valorEstimado, filtros) &&
      (filtros.fontes.length === 0 || filtros.fontes.includes(fonteDaOportunidade(item.linkOrigem, item.linkAlerta))) &&
      (!filtros.poucoCaixa || nivelCaixa(item) === "baixo") &&
      dentroDoCaixaMax(item, filtros),
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
    if (filtros.ordem === "recentes") return publicacao(b) - publicacao(a) || porPrazo(a, b);
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
 * Quantos filtros da folha (UF, valor, modalidade, fonte, "tudo do ramo", pouco caixa, caixa até e ordem) estão fora do padrão.
 * Em "Para você" a ordem é a da recomendação e não conta.
 */
export function contarFiltrosAtivos(filtros: Filtros, contarOrdem = true): number {
  let n = 0;
  if (filtros.ufs.length > 0) n += 1;
  if (filtros.valorMin !== null || filtros.valorMax !== null) n += 1;
  if (filtros.fontes.length > 0) n += 1;
  if (filtros.tudoDoRamo !== null) n += 1;
  if (filtros.poucoCaixa) n += 1;
  if (filtros.caixaMax !== null) n += 1;
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

/** "30 do seu ramo de 891 abertas" */
export function fraseRamo(doRamo: number, abertas: number): string {
  const a = abertas === 1 ? "aberta" : "abertas";
  return `${doRamo} do seu ramo de ${abertas} ${a}`;
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

/** Frase do estado vazio, por exemplo "Nenhuma oportunidade em MG hoje." */
export function fraseVazio(filtros: Filtros): string {
  const tipo =
    filtros.modalidade === "dispensa" ? "dispensa" : filtros.modalidade === "pregao" ? "pregão" : "oportunidade";
  const local = filtros.ufs.length > 0 ? ` em ${filtros.ufs.join(", ")}` : "";
  return `Nenhuma ${tipo}${local} hoje.`;
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
