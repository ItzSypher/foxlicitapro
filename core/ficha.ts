import { z } from "zod";

/**
 * Ficha do edital: o que o assistente leu no PDF, campo a campo, com o trecho e a página de onde saiu.
 * Campo que o edital não traz fica com valor nulo (ou "não informado no edital", nos textos).
 */

export const NAO_INFORMADO = "não informado no edital";

export const NATUREZAS = ["servico-continuo", "fornecimento-unico", "parcelado", "registro-precos", "nao-informado"] as const;
export type NaturezaContratacao = (typeof NATUREZAS)[number];

export const NOME_NATUREZA: Record<NaturezaContratacao, string> = {
  "servico-continuo": "Serviço contínuo",
  "fornecimento-unico": "Fornecimento único",
  parcelado: "Fornecimento parcelado",
  "registro-precos": "Registro de preços",
  "nao-informado": NAO_INFORMADO,
};

const trecho = z.string().trim().max(500).nullable();
const pagina = z.number().int().positive().max(5000).nullable();

function campo<T extends z.ZodType>(valor: T) {
  return z.object({ valor, trecho, pagina });
}

const texto = z.string().trim().min(1).max(800);
const dias = z.number().int().min(0).max(3650).nullable();

export const FichaEditalSchema = z.object({
  natureza: campo(z.enum(NATUREZAS)),
  formaPagamento: campo(texto),
  prazoPagamentoDias: campo(dias),
  medicaoMensal: campo(z.boolean().nullable()),
  pagamentoAntecipado: z.object({
    valor: z.boolean().nullable(),
    condicao: z.string().trim().max(500).nullable(),
    trecho,
    pagina,
  }),
  prazoEntregaDias: campo(dias),
  localEntrega: campo(texto),
  garantiaContratualPercentual: campo(z.number().min(0).max(100).nullable()),
  reajuste: campo(texto),
  multasSancoes: campo(texto),
  amostraProvaConceito: campo(texto),
  visitaTecnica: campo(texto),
  documentosHabilitacao: campo(z.array(z.string().trim().min(1).max(300)).max(40)),
  criterioJulgamento: campo(texto),
  modoDisputa: campo(texto),
  exclusividadeMeEpp: campo(z.boolean().nullable()),
  comoCompetir: z.array(z.string().trim().min(1).max(500)).min(3).max(5),
});

export type FichaEdital = z.infer<typeof FichaEditalSchema>;

/** Ficha gravada no banco, com quem gerou e quem conferiu. Datas em ISO para atravessar o servidor e o navegador. */
export interface FichaSalva {
  ficha: FichaEdital;
  geradaEm: string;
  geradaPorNome: string | null;
  confirmadaPorNome: string | null;
  confirmadaEm: string | null;
}

export function lerFichaSalva(bruto: unknown): FichaEdital | null {
  const lido = FichaEditalSchema.safeParse(bruto);
  return lido.success ? lido.data : null;
}
