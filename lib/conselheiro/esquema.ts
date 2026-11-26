import { z } from "zod";

/**
 * Saída do conselheiro. Não há campo numérico de preço de propósito: todo número em reais vem do sistema
 * (core/preco-sugerido.ts) e o assistente só comenta. Funções e tipos puros, usados no servidor e na tela.
 */

/** "talvez" fica só para ler pareceres antigos; o assistente agora decide entre vale e não vale. */
export const VEREDITOS_CONSELHEIRO = ["vale", "talvez", "nao-vale"] as const;
export type VereditoConselheiro = (typeof VEREDITOS_CONSELHEIRO)[number];
/** O que o assistente pode responder: sem meio-termo. */
export const VEREDITOS_DECISIVOS = ["vale", "nao-vale"] as const;

export const ROTULO_VEREDITO_CONSELHEIRO: Record<VereditoConselheiro, string> = {
  vale: "Vale a pena",
  talvez: "Talvez",
  "nao-vale": "Não vale a pena",
};

const texto = (max: number) => z.string().trim().min(1).max(max);

export const ComoConseguirSchema = z.object({
  /** Onde comprar ou contratar: revenda parceira, distribuidor, fabricante, subcontratação... */
  canal: texto(200),
  passos: z.array(texto(400)).min(1).max(8),
  prazoTipico: texto(200),
  cuidados: z.array(texto(400)).max(6),
});
export type ComoConseguir = z.infer<typeof ComoConseguirSchema>;

export const ModalidadeAvisoSchema = z.object({
  ehPregao: z.boolean(),
  foraDoFoco: z.boolean(),
  observacao: texto(500),
});
export type ModalidadeAviso = z.infer<typeof ModalidadeAvisoSchema>;

export const SaidaConselheiroSchema = z.object({
  veredito: z.enum(VEREDITOS_CONSELHEIRO),
  /** Condição em números para o veredito valer (ex.: preço mínimo sem prejuízo); vazia em pareceres antigos. */
  condicao: z.string().trim().max(300).default(""),
  resumo: texto(800),
  porQue: z.array(texto(400)).min(1).max(6),
  comoConseguir: z.array(ComoConseguirSchema).min(1).max(4),
  precoComentario: texto(1000),
  riscos: z.array(texto(400)).max(8),
  proximosPassos: z.array(texto(300)).min(1).max(6),
  modalidade: ModalidadeAvisoSchema,
});
export type SaidaConselheiro = z.infer<typeof SaidaConselheiroSchema>;

/** Lê o que veio do banco; conteúdo fora do formato atual é tratado como ausente. */
export function lerSaidaConselheiro(bruto: unknown): SaidaConselheiro | null {
  const lido = SaidaConselheiroSchema.safeParse(bruto);
  return lido.success ? lido.data : null;
}

const LISTA_TEXTOS = (descricao: string, minimo: number, maximo: number) => ({
  type: "array",
  description: descricao,
  minItems: minimo,
  maxItems: maximo,
  items: { type: "string" },
});

/** Mesmo formato de SaidaConselheiroSchema, em JSON Schema, para generationConfig.responseJsonSchema. */
export const ESQUEMA_JSON_CONSELHEIRO: { [chave: string]: unknown } = {
  type: "object",
  properties: {
    veredito: { type: "string", enum: [...VEREDITOS_DECISIVOS], description: "vale ou nao-vale para esta empresa, neste item. Sem meio-termo." },
    condicao: { type: "string", description: "Uma frase com a condição em números do sistema para o veredito se manter (ex.: vale se o lance ficar acima de R$ X, o preço mínimo sem prejuízo)." },
    resumo: { type: "string", description: "Duas ou três frases com a conclusão." },
    porQue: LISTA_TEXTOS("Razões do veredito, uma frase cada.", 1, 6),
    comoConseguir: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      description: "Canais para conseguir o produto ou serviço, do mais indicado para o menos.",
      items: {
        type: "object",
        properties: {
          canal: { type: "string", description: "Onde comprar ou contratar (revenda parceira, distribuidor, fabricante...)." },
          passos: LISTA_TEXTOS("Passo a passo, na ordem.", 1, 8),
          prazoTipico: { type: "string", description: "Prazo típico para ter o item em mãos, em texto." },
          cuidados: LISTA_TEXTOS("Cuidados práticos e legais deste canal.", 0, 6),
        },
        required: ["canal", "passos", "prazoTipico", "cuidados"],
        additionalProperties: false,
      },
    },
    precoComentario: { type: "string", description: "Comentário sobre o preço sugerido, usando só os números do sistema." },
    riscos: LISTA_TEXTOS("Riscos concretos deste item, cada um com a saída (\"o risco: a saída\"). Vazio quando não houver.", 0, 8),
    proximosPassos: LISTA_TEXTOS("O que o gestor e o jurídico fazem a seguir.", 1, 6),
    modalidade: {
      type: "object",
      properties: {
        ehPregao: { type: "boolean" },
        foraDoFoco: { type: "boolean" },
        observacao: { type: "string", description: "Uma frase sobre a modalidade e o foco atual." },
      },
      required: ["ehPregao", "foraDoFoco", "observacao"],
      additionalProperties: false,
    },
  },
  required: ["veredito", "condicao", "resumo", "porQue", "comoConseguir", "precoComentario", "riscos", "proximosPassos", "modalidade"],
  additionalProperties: false,
};

/** Análise gravada, com quem pediu e quando. Datas em ISO para atravessar o servidor e o navegador. */
export interface AnaliseSalva {
  id: string;
  itemId: string;
  criadoEm: string;
  criadoPorNome: string | null;
  modelo: string;
  resultado: SaidaConselheiro;
}
