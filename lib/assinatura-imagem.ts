/**
 * Funções puras para tratar a imagem da assinatura (foto ou desenho). Operam sobre os pixels RGBA
 * (Uint8ClampedArray de ImageData), sem depender de canvas, para poder testar sem navegador.
 */

/** Retângulo em pixels */
export interface Caixa {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Luminância percebida (0 a 255) de uma cor RGB */
export function luminancia(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export interface OpcoesFundo {
  /** Até esta luminância o pixel é tinta e fica opaco */
  de?: number;
  /** A partir desta luminância o pixel é fundo e fica transparente; entre as duas a transparência é gradual */
  ate?: number;
}

/**
 * Tira o fundo claro da foto: quanto mais claro o pixel, mais transparente ele fica.
 * Altera o próprio vetor (RGBA, 4 bytes por pixel).
 */
export function removerFundoClaro(pixels: Uint8ClampedArray, opcoes: OpcoesFundo = {}): void {
  const de = opcoes.de ?? 140;
  const ate = Math.max(opcoes.ate ?? 220, de + 1);
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const alfa = pixels[i + 3];
    if (alfa === 0) continue;
    const lum = luminancia(pixels[i], pixels[i + 1], pixels[i + 2]);
    if (lum <= de) continue;
    const fator = lum >= ate ? 0 : (ate - lum) / (ate - de);
    pixels[i + 3] = Math.round(alfa * fator);
  }
}

/**
 * Menor retângulo que contém os pixels com alfa acima do mínimo; null quando a imagem está vazia.
 */
export function caixaDeConteudo(pixels: Uint8ClampedArray, largura: number, altura: number, alfaMinimo = 16): Caixa | null {
  let minX = largura;
  let minY = altura;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < altura; y++) {
    const linha = y * largura * 4;
    for (let x = 0; x < largura; x++) {
      if (pixels[linha + x * 4 + 3] > alfaMinimo) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, largura: maxX - minX + 1, altura: maxY - minY + 1 };
}

/** Aumenta a caixa pela margem em cada lado, sem passar dos limites da imagem. */
export function ampliarCaixa(caixa: Caixa, largura: number, altura: number, margem: number): Caixa {
  const x = Math.max(0, caixa.x - margem);
  const y = Math.max(0, caixa.y - margem);
  const direita = Math.min(largura, caixa.x + caixa.largura + margem);
  const baixo = Math.min(altura, caixa.y + caixa.altura + margem);
  return { x, y, largura: direita - x, altura: baixo - y };
}

/** Tamanho final: reduz para caber em `larguraMaxima`, aplicando a escala, e nunca amplia. Mínimo de 1 pixel. */
export function dimensoesFinais(
  largura: number,
  altura: number,
  larguraMaxima: number,
  escala = 1,
): { largura: number; altura: number } {
  const fator = Math.min(1, larguraMaxima / largura) * escala;
  return {
    largura: Math.max(1, Math.round(largura * fator)),
    altura: Math.max(1, Math.round(altura * fator)),
  };
}

/** Escala que cabe em `maximo` no maior lado, sem ampliar. */
export function dimensoesLimitadas(largura: number, altura: number, maximo: number): { largura: number; altura: number } {
  const fator = Math.min(1, maximo / Math.max(largura, altura));
  return { largura: Math.max(1, Math.round(largura * fator)), altura: Math.max(1, Math.round(altura * fator)) };
}
