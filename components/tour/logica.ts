import type { LucideIcon } from "lucide-react";

/** Evento de janela que reabre o tour da tela atual (menu lateral e menu "Mais"). */
export const EVENTO_TOUR_TELA = "foxlicita:tour-tela";

/** Abaixo desta largura o balão vira uma folha no rodapé. */
export const LARGURA_CELULAR = 640;

export type RotaTour = "radar" | "pipeline" | "propostas" | "empresa";

export interface PassoTour {
  id: string;
  /** Valor do atributo data-tour do elemento destacado. Sem alvo, o balão aparece no centro. */
  alvo?: string;
  icone: LucideIcon;
  titulo: string;
  texto: string;
}

export interface Retangulo {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface Tamanho {
  largura: number;
  altura: number;
}

export type LadoBalao = "abaixo" | "acima" | "direita" | "esquerda" | "centro" | "folha";

export interface PosicaoBalao {
  x: number;
  y: number;
  lado: LadoBalao;
}

/** Tela do tour a partir do caminho; null onde não há roteiro. */
export function rotaDoCaminho(caminho: string): RotaTour | null {
  const limpo = caminho.length > 1 ? caminho.replace(/\/+$/, "") : caminho;
  if (limpo === "/radar") return "radar";
  if (limpo === "/pipeline") return "pipeline";
  if (limpo === "/propostas") return "propostas";
  if (limpo === "/empresa") return "empresa";
  return null;
}

/** Chave do "já visto" no aparelho: por pessoa e por tela. */
export function chaveVisto(usuarioId: string, rota: RotaTour): string {
  return `foxlicita:tour-visto:${usuarioId}:${rota}`;
}

/** Mantém os passos sem alvo e os passos cujo alvo existe na tela agora. */
export function escolherPassos<T extends { alvo?: string }>(passos: ReadonlyArray<T>, existe: (alvo: string) => boolean): T[] {
  return passos.filter((p) => p.alvo === undefined || existe(p.alvo));
}

export function temArea(r: Retangulo): boolean {
  return r.largura > 0 && r.altura > 0;
}

export function ehCelular(viewport: Tamanho): boolean {
  return viewport.largura < LARGURA_CELULAR;
}

function limitar(valor: number, minimo: number, maximo: number): number {
  if (maximo < minimo) return minimo;
  return Math.min(Math.max(valor, minimo), maximo);
}

/** Recorte em volta do alvo: margem extra, sem sair da tela. */
export function recorteDoAlvo(alvo: Retangulo, folga: number, viewport: Tamanho): Retangulo {
  const x = Math.max(0, alvo.x - folga);
  const y = Math.max(0, alvo.y - folga);
  const direita = Math.min(viewport.largura, alvo.x + alvo.largura + folga);
  const base = Math.min(viewport.altura, alvo.y + alvo.altura + folga);
  return { x, y, largura: Math.max(0, direita - x), altura: Math.max(0, base - y) };
}

/**
 * Onde pôr o balão (canto superior esquerdo, em px da janela).
 * No celular é uma folha no rodapé. No computador tenta abaixo, acima, à direita e à esquerda do alvo;
 * se nada couber, fica embaixo, centralizado. Sem alvo, no centro.
 */
export function calcularBalao({
  alvo,
  balao,
  viewport,
  folga = 14,
  margem = 16,
}: {
  alvo: Retangulo | null;
  balao: Tamanho;
  viewport: Tamanho;
  folga?: number;
  margem?: number;
}): PosicaoBalao {
  if (ehCelular(viewport)) return { x: 0, y: Math.max(0, viewport.altura - balao.altura), lado: "folha" };

  const centroX = limitar((viewport.largura - balao.largura) / 2, margem, viewport.largura - balao.largura - margem);
  const xMax = viewport.largura - balao.largura - margem;
  const yMax = viewport.altura - balao.altura - margem;
  if (alvo === null) {
    return { x: centroX, y: limitar((viewport.altura - balao.altura) / 2, margem, yMax), lado: "centro" };
  }

  const alinhadoX = limitar(alvo.x + alvo.largura / 2 - balao.largura / 2, margem, xMax);
  const alinhadoY = limitar(alvo.y + alvo.altura / 2 - balao.altura / 2, margem, yMax);
  const abaixo = alvo.y + alvo.altura + folga;
  if (abaixo + balao.altura + margem <= viewport.altura) return { x: alinhadoX, y: abaixo, lado: "abaixo" };
  const acima = alvo.y - folga - balao.altura;
  if (acima >= margem) return { x: alinhadoX, y: acima, lado: "acima" };
  const direita = alvo.x + alvo.largura + folga;
  if (direita + balao.largura + margem <= viewport.largura) return { x: direita, y: alinhadoY, lado: "direita" };
  const esquerda = alvo.x - folga - balao.largura;
  if (esquerda >= margem) return { x: esquerda, y: alinhadoY, lado: "esquerda" };
  return { x: centroX, y: Math.max(margem, yMax), lado: "centro" };
}

/**
 * Quanto rolar a página (positivo desce) para o alvo ficar entre `topo` e `base`.
 * Alvo maior que a área útil fica alinhado ao topo.
 */
export function deslocamentoParaVer(alvo: Retangulo, topo: number, base: number): number {
  const fundo = alvo.y + alvo.altura;
  if (alvo.y >= topo && fundo <= base) return 0;
  if (alvo.y < topo) return alvo.y - topo;
  return Math.min(fundo - base, alvo.y - topo);
}

/** Índice vizinho, sem sair da lista. */
export function vizinho(indice: number, total: number, passo: 1 | -1): number {
  return Math.min(Math.max(indice + passo, 0), Math.max(0, total - 1));
}
