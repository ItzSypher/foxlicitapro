import { formatarNumeroBR, parseNumeroBR } from "@/components/calculadora/numero";
import type { ModeloId } from "@/core/proposta-modelos";
import type { DadosProposta, ItemProposta } from "@/core/types-detalhe";

/** Item como o formulário o edita: números em texto, para aceitar "12,5" no meio da digitação. */
export interface ItemFormulario {
  /** Identidade estável para o React; não vai para o banco */
  chave: number;
  descricao: string;
  unidade: string;
  quantidade: string;
  marcaModelo: string;
  valorUnitario: string;
  /** Custo de compra por unidade (interno, nunca vai para o documento); vazio = não informado */
  custoUnitario: string;
  /** De onde o sistema tirou o custo; some quando a pessoa digita outro valor */
  fonteCusto: string;
  /** Valor unitário estimado pelo órgão; só da tela, não faz parte da proposta */
  referencia: number | null;
}

export interface Formulario {
  titulo: string;
  modelo: ModeloId;
  orgao: string;
  unidade: string;
  objeto: string;
  numeroCompra: string;
  processo: string;
  itens: ItemFormulario[];
  validadeDias: string;
  prazoEntrega: string;
  localEntrega: string;
  pagamento: string;
  garantia: string;
  observacoes: string;
  data: string;
  /** Incluir a imagem da assinatura da empresa no documento */
  assinar: boolean;
}

function numeroOuZero(texto: string): number {
  const n = parseNumeroBR(texto);
  return n === null || !Number.isFinite(n) || n < 0 ? 0 : n;
}

export function itemParaDados(item: ItemFormulario, numero: number): ItemProposta {
  const custo = numeroOuZero(item.custoUnitario);
  return {
    numero,
    descricao: item.descricao,
    unidade: item.unidade,
    quantidade: numeroOuZero(item.quantidade),
    marcaModelo: item.marcaModelo,
    valorUnitario: numeroOuZero(item.valorUnitario),
    ...(custo > 0 ? { custoUnitario: custo } : {}),
    ...(custo > 0 && item.fonteCusto !== "" ? { fonteCusto: item.fonteCusto } : {}),
  };
}

/** Os itens são renumerados de 1 em diante, na ordem da tela. */
export function formularioParaDados(f: Formulario): DadosProposta {
  return {
    orgao: f.orgao,
    unidade: f.unidade,
    objeto: f.objeto,
    numeroCompra: f.numeroCompra,
    processo: f.processo,
    itens: f.itens.map((item, i) => itemParaDados(item, i + 1)),
    validadeDias: Math.round(numeroOuZero(f.validadeDias)),
    prazoEntrega: f.prazoEntrega,
    localEntrega: f.localEntrega,
    pagamento: f.pagamento,
    garantia: f.garantia,
    observacoes: f.observacoes,
    data: f.data,
    assinar: f.assinar,
  };
}

export function dadosParaFormulario(
  titulo: string,
  modelo: ModeloId,
  dados: DadosProposta,
  referencias: Record<number, number>,
): Formulario {
  return {
    titulo,
    modelo,
    orgao: dados.orgao,
    unidade: dados.unidade,
    objeto: dados.objeto,
    numeroCompra: dados.numeroCompra,
    processo: dados.processo,
    itens: dados.itens.map((item) => ({
      chave: item.numero,
      descricao: item.descricao,
      unidade: item.unidade,
      quantidade: formatarNumeroBR(item.quantidade, 3),
      marcaModelo: item.marcaModelo,
      valorUnitario: item.valorUnitario > 0 ? formatarNumeroBR(item.valorUnitario, 2) : "",
      custoUnitario: item.custoUnitario !== undefined && item.custoUnitario > 0 ? formatarNumeroBR(item.custoUnitario, 2) : "",
      fonteCusto: item.fonteCusto ?? "",
      referencia: referencias[item.numero] ?? null,
    })),
    validadeDias: String(dados.validadeDias),
    prazoEntrega: dados.prazoEntrega,
    localEntrega: dados.localEntrega,
    pagamento: dados.pagamento,
    garantia: dados.garantia,
    observacoes: dados.observacoes,
    data: dados.data,
    assinar: dados.assinar !== false,
  };
}

export function itemVazio(chave: number): ItemFormulario {
  return { chave, descricao: "", unidade: "UN", quantidade: "1",
    marcaModelo: "",
    valorUnitario: "",
    custoUnitario: "",
    fonteCusto: "",
    referencia: null,
  };
}
