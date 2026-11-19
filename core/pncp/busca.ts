import { z } from "zod";

/**
 * Busca por texto do próprio site do PNCP (a mesma da caixa "Buscar" de pncp.gov.br).
 * Serve para achar o que a coleta por estado não trouxe: procura em todo o Brasil ou nas UFs pedidas,
 * só editais recebendo proposta.
 */
const URL_BUSCA = "https://pncp.gov.br/api/search/";
export const TAMANHO_BUSCA = 50;

export interface ConsultaBuscaPncp {
  texto: string;
  /** Vazio busca no Brasil todo */
  ufs: ReadonlyArray<string>;
  pagina?: number;
}

export interface ResultadoBuscaPncp {
  id: string;
  titulo: string;
  objeto: string;
  orgao: string;
  municipio: string;
  uf: string;
  modalidade: string;
  /** Fim do prazo de propostas (ISO) ou null */
  encerramento: string | null;
  valor: number | null;
  /** Página interna `/licitacao/{cnpj}/{ano}/{sequencial}` */
  href: string;
}

export interface RespostaBuscaPncp {
  total: number;
  itens: ResultadoBuscaPncp[];
}

export function montarUrlBusca(consulta: ConsultaBuscaPncp): string {
  const params = new URLSearchParams({
    q: consulta.texto.trim(),
    tipos_documento: "edital",
    ordenacao: "-data",
    pagina: String(Math.max(1, consulta.pagina ?? 1)),
    tam_pagina: String(TAMANHO_BUSCA),
    status: "recebendo_proposta",
  });
  if (consulta.ufs.length > 0) params.set("ufs", consulta.ufs.join("|"));
  return `${URL_BUSCA}?${params.toString()}`;
}

const itemSchema = z.object({
  title: z.string().nullish(),
  description: z.string().nullish(),
  orgao_cnpj: z.string().nullish(),
  orgao_nome: z.string().nullish(),
  ano: z.union([z.string(), z.number()]).nullish(),
  numero_sequencial: z.union([z.string(), z.number()]).nullish(),
  numero_controle_pncp: z.string().nullish(),
  municipio_nome: z.string().nullish(),
  uf: z.string().nullish(),
  modalidade_licitacao_nome: z.string().nullish(),
  data_fim_vigencia: z.string().nullish(),
  valor_global: z.number().nullish(),
  cancelado: z.boolean().nullish(),
});

const respostaSchema = z.object({
  total: z.number().nullish(),
  items: z.array(z.unknown()).nullish(),
});

/** Converte a resposta crua; ignora item sem chave do PNCP, cancelado ou com prazo já vencido. */
export function converterBusca(cru: unknown, agora: Date): RespostaBuscaPncp {
  const r = respostaSchema.safeParse(cru);
  if (!r.success) return { total: 0, itens: [] };
  const itens: ResultadoBuscaPncp[] = [];
  for (const bruto of r.data.items ?? []) {
    const p = itemSchema.safeParse(bruto);
    if (!p.success) continue;
    const i = p.data;
    const cnpj = (i.orgao_cnpj ?? "").replace(/\D/g, "");
    const ano = Number(i.ano);
    const seq = Number(i.numero_sequencial);
    if (!/^\d{14}$/.test(cnpj) || !(ano > 0) || !(seq > 0) || i.cancelado === true) continue;
    // O PNCP manda a data sem fuso; é horário de Brasília.
    const fim = i.data_fim_vigencia ? `${i.data_fim_vigencia.slice(0, 19)}-03:00` : null;
    if (fim !== null && !Number.isNaN(Date.parse(fim)) && Date.parse(fim) < agora.getTime()) continue;
    itens.push({
      id: i.numero_controle_pncp ?? `${cnpj}-${ano}-${seq}`,
      titulo: (i.title ?? "").trim(),
      objeto: (i.description ?? "").replace(/\s+/g, " ").trim(),
      orgao: (i.orgao_nome ?? "").trim(),
      municipio: (i.municipio_nome ?? "").trim(),
      uf: (i.uf ?? "").trim().toUpperCase(),
      modalidade: (i.modalidade_licitacao_nome ?? "").trim(),
      encerramento: fim !== null && !Number.isNaN(Date.parse(fim)) ? new Date(fim).toISOString() : null,
      valor: i.valor_global ?? null,
      href: `/licitacao/${cnpj}/${ano}/${seq}`,
    });
  }
  return { total: r.data.total ?? itens.length, itens };
}
