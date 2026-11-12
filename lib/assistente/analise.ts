import { z } from "zod";
import type { EsquemaJson } from "@/lib/gemini";
import type { ModeloId } from "@/core/proposta-modelos";
import type { ArquivoCompra, DadosProposta } from "@/core/types-detalhe";

/** Funções puras da análise do assistente: esquema de saída, validação, sugestões e escolha do edital. */

export const MODELO_IDS = ["dispensa-produtos", "dispensa-servicos", "pregao-produtos", "cotacao-simples"] as const satisfies readonly ModeloId[];

export interface SugestaoItem {
  numero: number;
  marcaModelo: string;
  precoSugerido: number | null;
  observacao: string;
}

/** O que o modelo devolve; `geradoEm` e `modelo` são acrescentados por nós. */
export interface SaidaAnalise {
  modeloId: ModeloId;
  resumo: string;
  pegadinhas: string[];
  documentosExigidos: string[];
  sugestoesPorItem: SugestaoItem[];
}

const SugestaoSchema = z.object({
  numero: z.number().int(),
  marcaModelo: z.string().max(200),
  precoSugerido: z.number().nonnegative().nullable(),
  observacao: z.string().max(600),
});

const SaidaBase = z.object({
  modeloId: z.enum(MODELO_IDS),
  resumo: z.string().trim().min(1).max(2000),
  pegadinhas: z.array(z.string().max(500)).max(25),
  documentosExigidos: z.array(z.string().max(300)).max(40),
  sugestoesPorItem: z.array(SugestaoSchema).max(200),
});

/** Esquema zod da saída; sugestão para número de item que não existe na licitação é erro. */
export function esquemaSaidaAnalise(numerosItens: readonly number[]): z.ZodType<SaidaAnalise> {
  const validos = new Set(numerosItens);
  return SaidaBase.superRefine((saida, ctx) => {
    saida.sugestoesPorItem.forEach((s, i) => {
      if (!validos.has(s.numero)) {
        ctx.addIssue({
          code: "custom",
          path: ["sugestoesPorItem", i, "numero"],
          message: `O item ${s.numero} não existe nesta licitação; use só os números de item informados.`,
        });
      }
    });
  });
}

export function validarSaidaAnalise(
  bruto: unknown,
  numerosItens: readonly number[],
): { ok: true; saida: SaidaAnalise } | { ok: false; erros: string[] } {
  const lido = esquemaSaidaAnalise(numerosItens).safeParse(bruto);
  if (lido.success) return { ok: true, saida: lido.data };
  return { ok: false, erros: lido.error.issues.map((i) => `${i.path.map(String).join(".")}: ${i.message}`) };
}

/** Mesmo formato do esquema zod, em JSON Schema, para generationConfig.responseJsonSchema. */
export const ESQUEMA_JSON_ANALISE: EsquemaJson = {
  type: "object",
  properties: {
    modeloId: {
      type: "string",
      enum: [...MODELO_IDS],
      description: "Modelo de proposta mais adequado a esta licitação.",
    },
    resumo: {
      type: "string",
      description: "De 3 a 5 frases: o que se compra, prazo, valor, se vale a pena para um MEI de TI e o principal risco.",
    },
    pegadinhas: {
      type: "array",
      items: { type: "string" },
      description: "Cada exigência ou condição do edital que pode eliminar a proposta ou sair cara.",
    },
    documentosExigidos: {
      type: "array",
      items: { type: "string" },
      description: "Documentos de habilitação e de proposta exigidos.",
    },
    sugestoesPorItem: {
      type: "array",
      items: {
        type: "object",
        properties: {
          numero: { type: "integer", description: "Número do item, como na lista informada." },
          marcaModelo: { type: "string", description: "Marca e modelo reais; vazio se não houver certeza ou for serviço." },
          precoSugerido: {
            type: ["number", "null"],
            description: "Preço unitário de referência em reais, nunca acima do valor unitário estimado; null sem referência.",
          },
          observacao: { type: "string", description: "Uma frase: de onde vem a sugestão e o que conferir." },
        },
        required: ["numero", "marcaModelo", "precoSugerido", "observacao"],
        additionalProperties: false,
      },
    },
  },
  required: ["modeloId", "resumo", "pegadinhas", "documentosExigidos", "sugestoesPorItem"],
  additionalProperties: false,
};

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function juntar(observacao: string, nota: string): string {
  const base = observacao.trim();
  return base === "" ? nota : `${base} ${nota}`;
}

/**
 * Deixa as sugestões seguras: uma por item, preço nunca acima do valor unitário estimado pelo órgão
 * e sem preço quando o órgão não informou estimativa (sigilo ou ausência).
 */
export function normalizarSugestoes(
  sugestoes: readonly SugestaoItem[],
  referencias: Readonly<Record<number, number>>,
): SugestaoItem[] {
  const vistos = new Set<number>();
  const saida: SugestaoItem[] = [];
  for (const s of sugestoes) {
    if (vistos.has(s.numero)) continue;
    vistos.add(s.numero);
    const marcaModelo = s.marcaModelo.trim();
    let observacao = s.observacao.trim();
    let preco: number | null = s.precoSugerido !== null && s.precoSugerido > 0 ? arredondar(s.precoSugerido) : null;
    const teto = referencias[s.numero];
    if (preco !== null) {
      if (teto === undefined) {
        preco = null;
        observacao = juntar(observacao, "O órgão não informou valor estimado: defina o preço depois de cotar.");
      } else if (preco > teto) {
        preco = arredondar(teto);
        observacao = juntar(observacao, "Preço limitado ao valor estimado pelo órgão.");
      }
    }
    saida.push({ numero: s.numero, marcaModelo, precoSugerido: preco, observacao });
  }
  return saida;
}

/** Preenche marca/modelo e valor unitário dos itens; item sem sugestão ou sem preço fica com valor 0. */
export function aplicarSugestoes(
  dados: DadosProposta,
  sugestoes: readonly SugestaoItem[],
  referencias: Readonly<Record<number, number>>,
): { dados: DadosProposta; sugestoes: SugestaoItem[] } {
  const normalizadas = normalizarSugestoes(sugestoes, referencias);
  const porNumero = new Map(normalizadas.map((s) => [s.numero, s]));
  return {
    sugestoes: normalizadas,
    dados: {
      ...dados,
      itens: dados.itens.map((item) => {
        const s = porNumero.get(item.numero);
        if (!s) return item;
        return { ...item, marcaModelo: s.marcaModelo, valorUnitario: s.precoSugerido ?? 0 };
      }),
    },
  };
}

const PADRAO_ADITIVO = /retifica|errata|impugna|esclarec|resposta|ata de|adendo|recurso|homologa|resultado/i;

function pontuacaoArquivo(a: ArquivoCompra): number {
  const texto = `${a.tipo ?? ""} ${a.titulo}`;
  let pontos = 0;
  if (/edital/i.test(texto)) pontos = 30;
  else if (/termo de refer/i.test(texto)) pontos = 20;
  else if (/aviso/i.test(texto)) pontos = 10;
  else return 0;
  if (PADRAO_ADITIVO.test(texto)) pontos -= 25;
  return pontos;
}

/** Principal arquivo da compra: Edital, depois Termo de Referência, depois Aviso; null se nenhum serve. */
export function escolherArquivoPrincipal(arquivos: readonly ArquivoCompra[]): ArquivoCompra | null {
  let melhor: ArquivoCompra | null = null;
  let melhorPontos = 0;
  for (const a of arquivos) {
    const pontos = pontuacaoArquivo(a);
    if (pontos <= 0) continue;
    if (pontos > melhorPontos || (pontos === melhorPontos && melhor !== null && a.sequencial < melhor.sequencial)) {
      melhor = a;
      melhorPontos = pontos;
    }
  }
  return melhor;
}

/** Os arquivos PDF começam com "%PDF-". */
export function parecePdf(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}
