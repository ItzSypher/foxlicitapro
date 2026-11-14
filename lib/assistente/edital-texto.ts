import { normalizarTexto } from "@/core/cnae-keywords";

/** Texto do edital enviado ao modelo: até este tamanho, em caracteres. */
export const LIMITE_CARACTERES_EDITAL = 60_000;
/** Abaixo disso o PDF é tratado como escaneado (sem texto) e vai inline ao modelo. */
export const MINIMO_CARACTERES_EDITAL = 500;

/** Termos que decidem a ficha; páginas com mais ocorrências têm prioridade quando o texto passa do limite. */
export const TERMOS_PRIORITARIOS: ReadonlyArray<string> = [
  "pagamento",
  "prazo",
  "entrega",
  "garantia",
  "habilitacao",
  "multa",
  "reajuste",
  "medicao",
];

/** Linhas do topo e do pé de cada página consideradas ao procurar cabeçalho e rodapé repetidos. */
const LINHAS_DE_BORDA = 3;

/** Junta palavras partidas por hífen na quebra de linha, tira espaços repetidos e linhas em branco demais. */
export function limparTextoPagina(texto: string): string {
  return texto
    .replace(/\r\n?/g, "\n")
    .replace(/­/g, "")
    .replace(/([\p{L}])-[ \t]*\n[ \t]*(\p{Ll})/gu, "$1$2")
    .replace(/[ \t ]+/g, " ")
    .split("\n")
    .map((linha) => linha.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Chave de comparação da linha: números viram "#" para que "Página 3 de 40" e "Página 4 de 40" sejam iguais. */
function chaveDaLinha(linha: string): string {
  return linha.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
}

/**
 * Tira cabeçalho e rodapé: linha do topo ou do pé que se repete em mais da metade das páginas.
 * Com menos de 3 páginas não há como saber o que se repete, então nada sai.
 */
export function removerCabecalhoRodape(paginas: ReadonlyArray<string>): string[] {
  if (paginas.length < 3) return [...paginas];
  const linhasPorPagina = paginas.map((p) => p.split("\n"));

  function indicesDeBorda(linhas: string[]): number[] {
    const naoVazias: number[] = [];
    linhas.forEach((l, i) => {
      if (l.trim() !== "") naoVazias.push(i);
    });
    return [...naoVazias.slice(0, LINHAS_DE_BORDA), ...naoVazias.slice(-LINHAS_DE_BORDA)];
  }

  const contagem = new Map<string, number>();
  for (const linhas of linhasPorPagina) {
    const chaves = new Set(indicesDeBorda(linhas).map((i) => chaveDaLinha(linhas[i])));
    for (const chave of chaves) contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }
  const repetidas = new Set<string>();
  for (const [chave, vezes] of contagem) if (vezes > paginas.length / 2) repetidas.add(chave);
  if (repetidas.size === 0) return [...paginas];

  return linhasPorPagina.map((linhas) => {
    const sair = new Set(indicesDeBorda(linhas).filter((i) => repetidas.has(chaveDaLinha(linhas[i]))));
    return linhas
      .filter((_, i) => !sair.has(i))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  });
}

/** Quantas vezes os termos de pagamento, prazo, entrega etc. aparecem na página (sem acento nem caixa). */
export function relevanciaDaPagina(texto: string): number {
  const base = ` ${normalizarTexto(texto)} `;
  let total = 0;
  for (const termo of TERMOS_PRIORITARIOS) {
    let de = 0;
    for (;;) {
      const achou = base.indexOf(termo, de);
      if (achou === -1) break;
      total += 1;
      de = achou + termo.length;
    }
  }
  return total;
}

function blocoDaPagina(numero: number, texto: string): string {
  return `## Página ${numero}\n\n${texto}`;
}

export interface EditalEmMarkdown {
  markdown: string;
  /** Caracteres de texto do edital, sem os títulos de página */
  caracteres: number;
  /** Páginas que ficaram de fora por causa do limite (números a partir de 1) */
  omitidas: number[];
}

/**
 * Converte o texto das páginas em Markdown: "## Página N" e o texto limpo, sem cabeçalho e rodapé repetidos.
 * Passando do limite, escolhe as páginas com mais termos de pagamento, prazo, entrega, garantia,
 * habilitação, multa, reajuste e medição (empate: as primeiras) e mantém a ordem original.
 */
export function editalParaMarkdown(paginasBrutas: ReadonlyArray<string>, limite = LIMITE_CARACTERES_EDITAL): EditalEmMarkdown {
  const limpas = removerCabecalhoRodape(paginasBrutas.map(limparTextoPagina));
  const paginas = limpas.map((texto, i) => ({ numero: i + 1, texto })).filter((p) => p.texto !== "");
  const caracteres = paginas.reduce((soma, p) => soma + p.texto.length, 0);
  const blocos = paginas.map((p) => ({ ...p, bloco: blocoDaPagina(p.numero, p.texto) }));
  const tamanho = (b: { bloco: string }): number => b.bloco.length + 2;

  const total = blocos.reduce((soma, b) => soma + tamanho(b), 0);
  if (total <= limite) {
    return { markdown: blocos.map((b) => b.bloco).join("\n\n"), caracteres, omitidas: [] };
  }

  const porRelevancia = blocos
    .map((b) => ({ b, pontos: relevanciaDaPagina(b.texto) }))
    .sort((x, y) => y.pontos - x.pontos || x.b.numero - y.b.numero);
  const escolhidas = new Set<number>();
  let usado = 0;
  for (const { b } of porRelevancia) {
    if (usado + tamanho(b) > limite) continue;
    escolhidas.add(b.numero);
    usado += tamanho(b);
  }
  const mantidas = blocos.filter((b) => escolhidas.has(b.numero));
  const omitidas = blocos.filter((b) => !escolhidas.has(b.numero)).map((b) => b.numero);
  return { markdown: mantidas.map((b) => b.bloco).join("\n\n"), caracteres, omitidas };
}

/** O texto extraído serve para ler o edital? Abaixo do mínimo é PDF escaneado: usa o PDF inline. */
export function textoSuficiente(edital: EditalEmMarkdown): boolean {
  return edital.caracteres >= MINIMO_CARACTERES_EDITAL;
}
