import { describe, expect, it } from "vitest";
import {
  ampliarCaixa,
  caixaDeConteudo,
  dimensoesFinais,
  dimensoesLimitadas,
  luminancia,
  removerFundoClaro,
} from "./assinatura-imagem";

/** Imagem RGBA de uma cor só */
function imagem(largura: number, altura: number, rgba: [number, number, number, number]): Uint8ClampedArray {
  const p = new Uint8ClampedArray(largura * altura * 4);
  for (let i = 0; i < p.length; i += 4) p.set(rgba, i);
  return p;
}

function pintar(p: Uint8ClampedArray, largura: number, x: number, y: number, rgba: [number, number, number, number]) {
  p.set(rgba, (y * largura + x) * 4);
}

describe("luminancia", () => {
  it("vai de 0 no preto a 255 no branco", () => {
    expect(luminancia(0, 0, 0)).toBe(0);
    expect(luminancia(255, 255, 255)).toBeCloseTo(255, 5);
  });
});

describe("removerFundoClaro", () => {
  it("deixa o fundo branco transparente e a tinta escura opaca", () => {
    const p = imagem(2, 1, [255, 255, 255, 255]);
    p.set([10, 10, 10, 255], 4);
    removerFundoClaro(p);
    expect(p[3]).toBe(0);
    expect(p[7]).toBe(255);
  });

  it("faz transição gradual nos tons médios", () => {
    const p = imagem(1, 1, [180, 180, 180, 255]);
    removerFundoClaro(p);
    expect(p[3]).toBeGreaterThan(0);
    expect(p[3]).toBeLessThan(255);
  });

  it("não reabre pixel já transparente", () => {
    const p = imagem(1, 1, [0, 0, 0, 0]);
    removerFundoClaro(p);
    expect(p[3]).toBe(0);
  });
});

describe("caixaDeConteudo", () => {
  it("acha o retângulo dos pixels visíveis", () => {
    const p = imagem(10, 8, [0, 0, 0, 0]);
    pintar(p, 10, 3, 2, [0, 0, 0, 255]);
    pintar(p, 10, 6, 5, [0, 0, 0, 255]);
    expect(caixaDeConteudo(p, 10, 8)).toEqual({ x: 3, y: 2, largura: 4, altura: 4 });
  });

  it("devolve null quando não há nada", () => {
    expect(caixaDeConteudo(imagem(4, 4, [0, 0, 0, 0]), 4, 4)).toBeNull();
  });

  it("ignora ruído abaixo do alfa mínimo", () => {
    const p = imagem(4, 4, [0, 0, 0, 0]);
    pintar(p, 4, 0, 0, [0, 0, 0, 5]);
    pintar(p, 4, 2, 2, [0, 0, 0, 200]);
    expect(caixaDeConteudo(p, 4, 4)).toEqual({ x: 2, y: 2, largura: 1, altura: 1 });
  });
});

describe("ampliarCaixa", () => {
  it("aplica a margem e respeita os limites da imagem", () => {
    expect(ampliarCaixa({ x: 1, y: 1, largura: 4, altura: 4 }, 10, 10, 3)).toEqual({ x: 0, y: 0, largura: 8, altura: 8 });
    expect(ampliarCaixa({ x: 4, y: 4, largura: 2, altura: 2 }, 20, 20, 2)).toEqual({ x: 2, y: 2, largura: 6, altura: 6 });
  });
});

describe("dimensoesFinais", () => {
  it("limita a largura e mantém a proporção", () => {
    expect(dimensoesFinais(1200, 400, 600)).toEqual({ largura: 600, altura: 200 });
  });
  it("não amplia imagem pequena", () => {
    expect(dimensoesFinais(300, 100, 600)).toEqual({ largura: 300, altura: 100 });
  });
  it("aplica a escala de redução", () => {
    expect(dimensoesFinais(1200, 400, 600, 0.5)).toEqual({ largura: 300, altura: 100 });
  });
});

describe("dimensoesLimitadas", () => {
  it("limita o maior lado", () => {
    expect(dimensoesLimitadas(4000, 3000, 2000)).toEqual({ largura: 2000, altura: 1500 });
    expect(dimensoesLimitadas(800, 600, 2000)).toEqual({ largura: 800, altura: 600 });
  });
});
