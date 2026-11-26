/**
 * Conta da proposta: receita, custo, margem e, para o dono, comissão e resultado final.
 * O custo é interno (nunca sai no documento). Funções puras, sem rede nem banco.
 */
import { contaLucro, precoMinimoSemPrejuizo } from "./lucro";
import { normalizarTexto } from "./texto-busca";
import { sugerirPrecos, type PrecoFornecedor } from "./fornecedores";
import type { ResumoCotacoes } from "./cotacoes-resumo";
import type { DadosProposta, ItemProposta } from "./types-detalhe";

export type SituacaoProposta = "prejuizo" | "lucro" | "empate" | "sem-receita";

export interface LinhaResultado {
  numero: number;
  /** Custo do item (custo unitário × quantidade) em reais; null sem custo informado */
  custo: number | null;
  /** Menor valor unitário sem prejuízo; null sem custo informado */
  precoMinimoUnitario: number | null;
  /** O valor unitário está abaixo do preço mínimo */
  prejuizo: boolean;
}

export interface ResultadoProposta {
  /** Total da proposta em reais */
  receita: number;
  /** Soma dos custos informados, em reais */
  custo: number;
  /** Itens sem custo unitário */
  itensSemCusto: number;
  /** Receita menos custo, sem comissão */
  margemBruta: number;
  /** Margem bruta sobre a receita, em % (1 casa) */
  margemBrutaPercentual: number;
  /** Só quando a comissão foi informada (o dono); null para o gestor */
  comissaoPercentual: number | null;
  comissao: number | null;
  /** Receita menos custo e comissão; null sem comissão informada */
  resultado: number | null;
  /** Valor do prejuízo em reais (positivo); 0 quando não há. Com comissão informada vale o resultado final, sem ela a margem bruta */
  prejuizo: number;
  situacao: SituacaoProposta;
  itens: LinhaResultado[];
}

function arredondar(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Custo informado: número finito maior que zero. */
export function temCusto(item: Pick<ItemProposta, "custoUnitario">): boolean {
  return typeof item.custoUnitario === "number" && Number.isFinite(item.custoUnitario) && item.custoUnitario > 0;
}

/** Custo total de um item em centavos inteiros. */
function custoItemCentavos(item: ItemProposta): number {
  if (!temCusto(item)) return 0;
  return Math.round(Math.round((item.custoUnitario ?? 0) * 100) * item.quantidade);
}

/**
 * A conta da proposta. `comissaoPercentual` só vem para o dono: sem ele a conta fica na margem bruta
 * (receita menos custo), que é o que o gestor enxerga.
 */
export function resultadoDaProposta(dados: DadosProposta, comissaoPercentual: number | null): ResultadoProposta {
  const receitaCentavos = dados.itens.reduce((s, i) => s + Math.round(Math.round(i.valorUnitario * 100) * i.quantidade), 0);
  const custoCentavos = dados.itens.reduce((s, i) => s + custoItemCentavos(i), 0);
  const receita = receitaCentavos / 100;
  const custo = custoCentavos / 100;
  const margemBruta = arredondar(receita - custo);
  const margemBrutaPercentual = receita > 0 ? Math.round((margemBruta / receita) * 1000) / 10 : 0;

  const conta = comissaoPercentual === null ? null : contaLucro({ receita, custo, comissaoPercentual });
  const resultado = comissaoPercentual === null ? null : (conta?.resultado ?? 0);
  const comissao = comissaoPercentual === null ? null : (conta?.comissao ?? 0);
  const efetivo = resultado ?? margemBruta;

  const situacao: SituacaoProposta =
    receita <= 0 ? "sem-receita" : efetivo < -0.005 ? "prejuizo" : efetivo > 0.005 ? "lucro" : "empate";

  const itens: LinhaResultado[] = dados.itens.map((i) => {
    if (!temCusto(i)) return { numero: i.numero, custo: null, precoMinimoUnitario: null, prejuizo: false };
    const minimo = precoMinimoSemPrejuizo(i.custoUnitario ?? 0, comissaoPercentual ?? 0);
    return {
      numero: i.numero,
      custo: custoItemCentavos(i) / 100,
      precoMinimoUnitario: minimo,
      prejuizo: i.valorUnitario > 0 && i.valorUnitario + 0.005 < minimo,
    };
  });

  return {
    receita,
    custo,
    itensSemCusto: dados.itens.filter((i) => !temCusto(i)).length,
    margemBruta,
    margemBrutaPercentual,
    comissaoPercentual,
    comissao,
    resultado,
    prejuizo: situacao === "prejuizo" ? arredondar(-efetivo) : 0,
    situacao,
    itens,
  };
}

/** Texto da confirmação ao enviar para revisão; null quando não há prejuízo nem custo faltando. */
export function textoConfirmacaoEnvio(r: Pick<ResultadoProposta, "prejuizo" | "itensSemCusto">): string | null {
  const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const faltando = r.itensSemCusto === 1 ? "Falta o custo de 1 item" : `Falta o custo de ${r.itensSemCusto} itens`;
  if (r.prejuizo > 0) {
    const base = `Esta proposta dá prejuízo de ${reais.format(r.prejuizo)}`;
    return r.itensSemCusto > 0 ? `${base}, e ${faltando.toLowerCase()}. Enviar mesmo assim?` : `${base}. Enviar mesmo assim?`;
  }
  if (r.itensSemCusto > 0) return `${faltando}, então não dá para saber se há prejuízo. Enviar mesmo assim?`;
  return null;
}

/** Custo unitário que o sistema achou para um item, com a fonte dita em frase curta. */
export interface CustoDeReferencia {
  custoUnitario: number;
  fonte: string;
}

function brl(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

/**
 * Custo de referência por número de item, só do que o sistema já sabe: cotação salva da licitação ou
 * preço de fornecedor parecido. Sem referência, o item fica fora (nunca se inventa custo).
 *
 * A cotação guarda o custo do lote cotado (com a quantidade do edital): vale quando a descrição bate
 * com a do item ou quando a licitação tem um item só e uma única lista cotada.
 */
export function custosDeReferencia(
  itens: readonly ItemProposta[],
  cotacoes: ResumoCotacoes | null,
  precosFornecedor: readonly PrecoFornecedor[],
): Map<number, CustoDeReferencia> {
  const saida = new Map<number, CustoDeReferencia>();
  const listas = cotacoes === null ? [] : cotacoes.frentes.flatMap((f) => f.listas);
  for (const item of itens) {
    if (!(item.quantidade > 0)) continue;
    const chave = normalizarTexto(item.descricao);
    const lista =
      listas.find((l) => l.chave === chave) ?? (itens.length === 1 && listas.length === 1 ? listas[0] : undefined);
    if (lista && lista.custoTotal.media > 0) {
      const unitario = Math.round((lista.custoTotal.media / item.quantidade) * 100) / 100;
      if (unitario > 0) {
        saida.set(item.numero, { custoUnitario: unitario, fonte: `Cotação salva (${brl(lista.custoTotal.media)} no lote, média)` });
        continue;
      }
    }
    const preco = sugerirPrecos(item.descricao, precosFornecedor);
    if (preco && preco.menor.preco > 0) {
      saida.set(item.numero, {
        custoUnitario: preco.menor.preco,
        fonte: `Preço de ${preco.menor.fornecedorNome} em ${preco.menor.data.slice(0, 10).split("-").reverse().join("/")}`,
      });
    }
  }
  return saida;
}

/** Preenche custoUnitario e fonteCusto dos itens que têm referência e ainda não têm custo. */
export function aplicarCustosDeReferencia(dados: DadosProposta, referencias: ReadonlyMap<number, CustoDeReferencia>): DadosProposta {
  return {
    ...dados,
    itens: dados.itens.map((item) => {
      const ref = referencias.get(item.numero);
      if (!ref || temCusto(item)) return item;
      return { ...item, custoUnitario: ref.custoUnitario, fonteCusto: ref.fonte };
    }),
  };
}
