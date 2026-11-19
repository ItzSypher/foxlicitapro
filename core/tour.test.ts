import { describe, expect, it } from "vitest";
import {
  calcularBalao,
  chaveVisto,
  deslocamentoParaVer,
  escolherPassos,
  recorteDoAlvo,
  rotaDoCaminho,
  vizinho,
  type Retangulo,
} from "@/components/tour/logica";

const PC = { largura: 1280, altura: 800 };
const BALAO = { largura: 360, altura: 200 };

describe("escolherPassos", () => {
  it("mantém passos sem alvo e passos cujo alvo existe; descarta os demais", () => {
    const passos = [{ id: "a", alvo: "x" }, { id: "b", alvo: "y" }, { id: "c" }];
    expect(escolherPassos(passos, (a) => a === "x").map((p) => p.id)).toEqual(["a", "c"]);
    expect(escolherPassos(passos, () => false).map((p) => p.id)).toEqual(["c"]);
  });
});

describe("rotaDoCaminho e chaveVisto", () => {
  it("reconhece só as telas com roteiro", () => {
    expect(rotaDoCaminho("/radar")).toBe("radar");
    expect(rotaDoCaminho("/pipeline/")).toBe("pipeline");
    expect(rotaDoCaminho("/propostas")).toBe("propostas");
    expect(rotaDoCaminho("/empresa")).toBe("empresa");
    expect(rotaDoCaminho("/propostas/123")).toBeNull();
    expect(rotaDoCaminho("/")).toBeNull();
  });
  it("separa por pessoa e por tela", () => {
    expect(chaveVisto("u1", "radar")).not.toBe(chaveVisto("u2", "radar"));
    expect(chaveVisto("u1", "radar")).not.toBe(chaveVisto("u1", "pipeline"));
  });
});

describe("calcularBalao", () => {
  const alvo: Retangulo = { x: 400, y: 100, largura: 300, altura: 80 };

  it("coloca abaixo do alvo quando cabe, centralizado e dentro da tela", () => {
    const p = calcularBalao({ alvo, balao: BALAO, viewport: PC });
    expect(p.lado).toBe("abaixo");
    expect(p.y).toBeGreaterThan(alvo.y + alvo.altura);
    expect(p.x).toBe(alvo.x + alvo.largura / 2 - BALAO.largura / 2);
  });

  it("vai para cima quando não há espaço embaixo", () => {
    const baixo: Retangulo = { x: 400, y: 650, largura: 300, altura: 100 };
    const p = calcularBalao({ alvo: baixo, balao: BALAO, viewport: PC });
    expect(p.lado).toBe("acima");
    expect(p.y + BALAO.altura).toBeLessThan(baixo.y);
  });

  it("usa o lado quando o alvo ocupa a altura toda", () => {
    const alto: Retangulo = { x: 20, y: 10, largura: 240, altura: 780 };
    const p = calcularBalao({ alvo: alto, balao: BALAO, viewport: PC });
    expect(p.lado).toBe("direita");
    expect(p.x).toBeGreaterThan(alto.x + alto.largura);
  });

  it("nunca sai da tela, mesmo com alvo na borda", () => {
    const borda: Retangulo = { x: 1200, y: 100, largura: 70, altura: 40 };
    const p = calcularBalao({ alvo: borda, balao: BALAO, viewport: PC });
    expect(p.x).toBeGreaterThanOrEqual(16);
    expect(p.x + BALAO.largura).toBeLessThanOrEqual(PC.largura - 16);
  });

  it("alvo gigante: balão embaixo, ao centro", () => {
    const todo: Retangulo = { x: 0, y: 0, largura: 1280, altura: 800 };
    const p = calcularBalao({ alvo: todo, balao: BALAO, viewport: PC });
    expect(p.lado).toBe("centro");
    expect(p.y + BALAO.altura).toBeLessThanOrEqual(PC.altura);
  });

  it("sem alvo, fica no centro", () => {
    const p = calcularBalao({ alvo: null, balao: BALAO, viewport: PC });
    expect(p).toEqual({ x: 460, y: 300, lado: "centro" });
  });

  it("no celular vira folha colada no rodapé", () => {
    const p = calcularBalao({ alvo, balao: { largura: 375, altura: 260 }, viewport: { largura: 375, altura: 700 } });
    expect(p).toEqual({ x: 0, y: 440, lado: "folha" });
  });
});

describe("deslocamentoParaVer", () => {
  it("não rola quando o alvo já está na área", () => {
    expect(deslocamentoParaVer({ x: 0, y: 100, largura: 10, altura: 50 }, 64, 500)).toBe(0);
  });
  it("rola para baixo quando o alvo está abaixo da área", () => {
    expect(deslocamentoParaVer({ x: 0, y: 600, largura: 10, altura: 50 }, 64, 500)).toBe(150);
  });
  it("rola para cima quando o alvo está acima da área", () => {
    expect(deslocamentoParaVer({ x: 0, y: -200, largura: 10, altura: 50 }, 64, 500)).toBe(-264);
  });
  it("alvo maior que a área fica alinhado ao topo", () => {
    expect(deslocamentoParaVer({ x: 0, y: 300, largura: 10, altura: 900 }, 64, 500)).toBe(236);
  });
});

describe("recorteDoAlvo e vizinho", () => {
  it("amplia o alvo sem sair da tela", () => {
    expect(recorteDoAlvo({ x: 2, y: 2, largura: 100, altura: 50 }, 6, PC)).toEqual({ x: 0, y: 0, largura: 108, altura: 58 });
    const r = recorteDoAlvo({ x: 1200, y: 780, largura: 100, altura: 50 }, 6, PC);
    expect(r.x + r.largura).toBe(PC.largura);
    expect(r.y + r.altura).toBe(PC.altura);
  });
  it("vizinho não passa dos limites", () => {
    expect(vizinho(0, 5, -1)).toBe(0);
    expect(vizinho(4, 5, 1)).toBe(4);
    expect(vizinho(2, 5, 1)).toBe(3);
    expect(vizinho(0, 0, 1)).toBe(0);
  });
});
