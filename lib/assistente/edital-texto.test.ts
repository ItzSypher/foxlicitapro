import { describe, expect, it } from "vitest";
import {
  LIMITE_CARACTERES_EDITAL,
  MINIMO_CARACTERES_EDITAL,
  editalParaMarkdown,
  limparTextoPagina,
  relevanciaDaPagina,
  removerCabecalhoRodape,
  textoSuficiente,
} from "./edital-texto";

const NOMES = ["alfa", "beta", "gama", "delta", "epsilon", "zeta", "eta", "teta", "iota", "capa"];

const CABECALHO = "PREFEITURA MUNICIPAL DE EXEMPLO\nPregão Eletrônico nº 12/2026";

function pagina(n: number, corpo: string): string {
  return `${CABECALHO}\n${corpo}\nPágina ${n} de 6`;
}

describe("limparTextoPagina", () => {
  it("junta hífen de quebra de linha, tira espaços repetidos e linhas em branco demais", () => {
    const bruto = "O paga-\nmento   será feito\t em 30   dias.\n\n\n\nFim  ";
    expect(limparTextoPagina(bruto)).toBe("O pagamento será feito em 30 dias.\n\nFim");
  });

  it("não junta hífen de verdade (palavra seguinte em maiúscula ou número)", () => {
    expect(limparTextoPagina("Lei 14.133 -\nArt. 5")).toBe("Lei 14.133 -\nArt. 5");
    expect(limparTextoPagina("Sul-\nAmérica")).toBe("Sul-\nAmérica");
  });
});

describe("removerCabecalhoRodape", () => {
  it("tira linha repetida em mais da metade das páginas, mesmo com o número da página mudando", () => {
    const paginas = [1, 2, 3, 4, 5, 6].map((n) => pagina(n, `Cláusula ${NOMES[n]} com texto próprio ${NOMES[n]}.`));
    const limpas = removerCabecalhoRodape(paginas);
    expect(limpas[0]).toBe("Cláusula beta com texto próprio beta.");
    expect(limpas[5]).toBe("Cláusula eta com texto próprio eta.");
    expect(limpas.join("\n")).not.toContain("PREFEITURA");
    expect(limpas.join("\n")).not.toContain("Página");
  });

  it("mantém linha repetida no meio da página e o que não se repete em mais da metade", () => {
    const paginas = [
      "Linha rara\nCorpo A\nmeio\nmeio 2\nmeio 3\nCorpo B\nFim 1",
      "Outra\nCorpo C\nmeio\nmeio 2\nmeio 3\nCorpo D\nFim 2",
      "Mais uma\nCorpo E\nmeio\nmeio 2\nmeio 3\nCorpo F\nFim 3",
    ];
    expect(removerCabecalhoRodape(paginas).join("\n")).toContain("meio 2");
  });

  it("com menos de 3 páginas não remove nada", () => {
    const duas = [pagina(1, "A"), pagina(2, "B")];
    expect(removerCabecalhoRodape(duas)).toEqual(duas);
  });
});

describe("editalParaMarkdown", () => {
  it("gera '## Página N' com o texto limpo, em ordem, sem cabeçalho e rodapé", () => {
    const paginas = [1, 2, 3, 4].map((n) => pagina(n, `Texto da cláusula ${NOMES[n]}.`));
    const r = editalParaMarkdown(paginas);
    expect(r.markdown).toBe(
      [
        "## Página 1",
        "",
        "Texto da cláusula beta.",
        "",
        "## Página 2",
        "",
        "Texto da cláusula gama.",
        "",
        "## Página 3",
        "",
        "Texto da cláusula delta.",
        "",
        "## Página 4",
        "",
        "Texto da cláusula epsilon.",
      ].join("\n"),
    );
    expect(r.omitidas).toEqual([]);
  });

  it("páginas vazias ficam de fora mas a numeração segue a do PDF", () => {
    const r = editalParaMarkdown(["Primeira página", "", "Terceira página"]);
    expect(r.markdown).toBe("## Página 1\n\nPrimeira página\n\n## Página 3\n\nTerceira página");
  });

  it("passando do limite, mantém as páginas com mais termos de pagamento, prazo, garantia... e a ordem", () => {
    const enchimento = "x".repeat(300);
    const paginas = [
      `Introdução geral ${enchimento}`,
      `Pagamento em 30 dias, prazo de entrega, garantia e multa. ${enchimento}`,
      `Objeto e histórico ${enchimento}`,
      `Reajuste e medição mensal; pagamento após medição. ${enchimento}`,
      `Anexo de endereços ${enchimento}`,
    ];
    const r = editalParaMarkdown(paginas, 800);
    expect(r.markdown).toContain("## Página 2");
    expect(r.markdown).toContain("## Página 4");
    expect([...r.omitidas].sort()).toEqual([1, 3, 5]);
    expect(r.markdown.indexOf("## Página 2")).toBeLessThan(r.markdown.indexOf("## Página 4"));
    expect(r.markdown.length).toBeLessThanOrEqual(800);
  });

  it("o limite padrão é de 60 mil caracteres", () => {
    const grande = Array.from({ length: 40 }, (_, i) => `Capítulo ${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + (i % 26))} ${"palavra ".repeat(300)}`);
    const r = editalParaMarkdown(grande);
    expect(LIMITE_CARACTERES_EDITAL).toBe(60_000);
    expect(r.markdown.length).toBeLessThanOrEqual(60_000);
    expect(r.omitidas.length).toBeGreaterThan(0);
  });
});

describe("relevanciaDaPagina", () => {
  it("conta os termos sem acento e sem caixa", () => {
    expect(relevanciaDaPagina("HABILITAÇÃO jurídica; Medição; multa de 2%. Nada mais.")).toBe(3);
    expect(relevanciaDaPagina("Texto neutro.")).toBe(0);
  });
});

describe("textoSuficiente (fallback para o PDF inline)", () => {
  it("PDF escaneado, sem texto ou com poucos caracteres, não serve", () => {
    expect(textoSuficiente(editalParaMarkdown(["", "  ", ""]))).toBe(false);
    expect(textoSuficiente(editalParaMarkdown(["Só um número 12"]))).toBe(false);
  });

  it("a partir de 500 caracteres de texto serve", () => {
    const texto = "a".repeat(MINIMO_CARACTERES_EDITAL);
    expect(textoSuficiente(editalParaMarkdown([texto]))).toBe(true);
    expect(textoSuficiente(editalParaMarkdown([texto.slice(1)]))).toBe(false);
  });
});
