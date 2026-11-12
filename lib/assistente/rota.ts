import type { ChaveCompra } from "@/core/types-detalhe";

/** Em que página o chat foi aberto. O cliente só informa o caminho; o servidor monta o contexto. */
export type RotaAssistente =
  | { tipo: "licitacao"; chave: ChaveCompra }
  | { tipo: "proposta"; id: string }
  | { tipo: "radar" }
  | { tipo: "outra" };

const LICITACAO = /^\/licitacao\/(\d{14})\/(\d{4})\/(\d{1,9})$/;
const PROPOSTA = /^\/propostas\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** Aceita só os caminhos conhecidos; qualquer outro texto vira "outra". */
export function interpretarRota(caminho: string): RotaAssistente {
  const limpo = caminho.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  const licitacao = LICITACAO.exec(limpo);
  if (licitacao) {
    return { tipo: "licitacao", chave: { cnpj: licitacao[1], ano: Number(licitacao[2]), sequencial: Number(licitacao[3]) } };
  }
  const proposta = PROPOSTA.exec(limpo);
  if (proposta) return { tipo: "proposta", id: proposta[1].toLowerCase() };
  if (limpo === "/radar") return { tipo: "radar" };
  return { tipo: "outra" };
}

/** Perguntas de início conforme a página. */
export function sugestoesRapidas(rota: RotaAssistente): string[] {
  switch (rota.tipo) {
    case "licitacao":
      return ["Vale a pena para mim?", "Quais documentos preciso?", "Quais as pegadinhas?"];
    case "radar":
      return ["Quais as melhores de software hoje?", "O que fecha hoje?"];
    case "proposta":
      return ["O que falta nesta proposta?"];
    case "outra":
      return [];
  }
}

export function caminhoDaLicitacao(chave: ChaveCompra): string {
  return `/licitacao/${chave.cnpj}/${chave.ano}/${chave.sequencial}`;
}
