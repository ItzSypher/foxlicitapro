/** Fornecedores e preços de fornecedor (funções puras, sem banco). */
import { z } from "zod";
import { cnpjValido, somenteDigitos } from "@/core/brasilapi";
import { normalizarTexto, palavrasDe } from "@/core/texto-busca";

export const ORIGENS_PRECO = ["manual", "cotacao"] as const;
export type OrigemPreco = (typeof ORIGENS_PRECO)[number];

export interface Fornecedor {
  id: string;
  nome: string;
  cnpj: string | null;
  contato: string;
  telefone: string;
  email: string;
  site: string;
  /** Categorias ou palavras separadas por vírgula */
  categorias: string;
  observacao: string;
  ativo: boolean;
}

export type DadosFornecedor = Omit<Fornecedor, "id">;

const texto = (max: number) => z.string().trim().max(max);

/** Cadastro vindo do formulário: CNPJ opcional (só dígitos depois de validado). */
export const DadosFornecedorSchema: z.ZodType<DadosFornecedor> = z.object({
  nome: texto(160).min(1, "Informe o nome do fornecedor."),
  cnpj: z
    .string()
    .trim()
    .max(30)
    .transform((v) => somenteDigitos(v))
    .refine((v) => v === "" || cnpjValido(v), "CNPJ inválido.")
    .transform((v) => (v === "" ? null : v)),
  contato: texto(120),
  telefone: texto(40),
  email: texto(160).refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido."),
  site: texto(200),
  categorias: texto(300),
  observacao: texto(2000),
  ativo: z.boolean(),
});

export interface PrecoFornecedor {
  id: string;
  fornecedorId: string;
  fornecedorNome: string;
  descricao: string;
  unidade: string;
  preco: number;
  prazoDias: number | null;
  /** AAAA-MM-DD */
  data: string;
  origem: OrigemPreco;
}

/** Busca simples sem acento: todas as palavras digitadas precisam aparecer em nome, CNPJ, contato, e-mail ou categorias. */
export function filtrarFornecedores<T extends Fornecedor>(lista: readonly T[], busca: string): T[] {
  const termos = normalizarTexto(busca).split(" ").filter((t) => t !== "");
  if (termos.length === 0) return [...lista];
  return lista.filter((f) => {
    const palheiro = normalizarTexto(`${f.nome} ${f.cnpj ?? ""} ${f.contato} ${f.categorias} ${f.email}`);
    return termos.every((t) => palheiro.includes(t));
  });
}

export interface ItemPrecificado {
  chave: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  media: number;
  menor: number;
  maior: number;
  /** Preço mais recente do item */
  ultimo: number;
  ultimaData: string;
}

function maisNovo(a: PrecoFornecedor, b: PrecoFornecedor): boolean {
  return a.data > b.data;
}

/** Histórico agrupado por descrição normalizada: média, menor, maior e último preço. Mais citados primeiro. */
export function agruparPrecosPorItem(precos: readonly PrecoFornecedor[]): ItemPrecificado[] {
  const grupos = new Map<string, PrecoFornecedor[]>();
  for (const p of precos) {
    const chave = normalizarTexto(p.descricao);
    const atual = grupos.get(chave);
    if (atual) atual.push(p);
    else grupos.set(chave, [p]);
  }
  const itens: ItemPrecificado[] = [];
  for (const [chave, lista] of grupos) {
    let recente = lista[0];
    if (!recente) continue;
    let soma = 0;
    let menor = recente.preco;
    let maior = recente.preco;
    for (const p of lista) {
      soma += p.preco;
      if (p.preco < menor) menor = p.preco;
      if (p.preco > maior) maior = p.preco;
      if (maisNovo(p, recente)) recente = p;
    }
    itens.push({
      chave,
      descricao: recente.descricao,
      unidade: recente.unidade,
      quantidade: lista.length,
      media: Math.round((soma / lista.length) * 100) / 100,
      menor,
      maior,
      ultimo: recente.preco,
      ultimaData: recente.data,
    });
  }
  return itens.sort((a, b) => b.quantidade - a.quantidade || b.ultimaData.localeCompare(a.ultimaData));
}

export interface SugestaoPreco {
  /** Preço mais recente entre os itens parecidos (empate: o primeiro da lista, que vem do mais novo) */
  ultimo: PrecoFornecedor;
  menor: PrecoFornecedor;
  /** Quantos preços parecidos foram considerados */
  total: number;
}

/**
 * Itens parecidos: pelo menos metade das palavras da descrição digitada (mínimo 1) aparece na descrição do preço.
 * Descrição sem palavra útil não gera sugestão.
 */
export function sugerirPrecos(descricao: string, precos: readonly PrecoFornecedor[]): SugestaoPreco | null {
  const palavras = palavrasDe(descricao);
  if (palavras.length === 0) return null;
  const exigidas = Math.max(1, Math.ceil(palavras.length / 2));
  const parecidos = precos.filter((p) => {
    const dele = new Set(palavrasDe(p.descricao));
    return palavras.filter((w) => dele.has(w)).length >= exigidas;
  });
  let ultimo = parecidos[0];
  let menor = parecidos[0];
  if (!ultimo || !menor) return null;
  for (const p of parecidos) {
    if (maisNovo(p, ultimo)) ultimo = p;
    if (p.preco < menor.preco) menor = p;
  }
  return { ultimo, menor, total: parecidos.length };
}
