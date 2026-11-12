import { regiaoDe } from "../regioes";
import type { ModalidadeId, Oportunidade } from "../types";
import type { ContratacaoPncp } from "./schema";

const FUSO_BRASILIA = "-03:00";

function ehModalidadeValida(id: number): id is ModalidadeId {
  return id === 6 || id === 8;
}

/**
 * Converte a data da API em ISO 8601 com fuso. A API devolve data e hora sem
 * fuso; nesse caso vale o horário de Brasília (-03:00). Devolve null se inválida.
 */
export function paraIsoBrasilia(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const texto = valor.trim();
  if (texto === "") return null;

  let iso = texto;
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    iso = `${texto}T00:00:00${FUSO_BRASILIA}`;
  } else if (!/(Z|[+-]\d{2}(:?\d{2})?)$/i.test(texto.slice(10))) {
    iso = `${texto}${FUSO_BRASILIA}`;
  }
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

function limparTexto(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\s+/g, " ").trim();
}

function textoOuNulo(valor: string | null | undefined): string | null {
  const limpo = limparTexto(valor);
  return limpo === "" ? null : limpo;
}

/**
 * Converte uma contratação do PNCP em Oportunidade.
 * Devolve null quando o item não serve: modalidade fora de 6/8, sem data de
 * encerramento válida ou com encerramento já no passado.
 */
export function normalizarContratacao(c: ContratacaoPncp, agora: Date = new Date()): Oportunidade | null {
  if (!ehModalidadeValida(c.modalidadeId)) return null;

  const dataEncerramento = paraIsoBrasilia(c.dataEncerramentoProposta);
  if (dataEncerramento === null) return null;
  if (new Date(dataEncerramento).getTime() < agora.getTime()) return null;

  const uf = limparTexto(c.unidadeOrgao.ufSigla).toUpperCase();
  const codigoIbge = String(c.unidadeOrgao.codigoIbge ?? "").trim();
  const cnpj = c.orgaoEntidade.cnpj;
  const valor = c.valorTotalEstimado;

  return {
    id: c.numeroControlePNCP,
    objeto: limparTexto(c.objetoCompra),
    valorEstimado: typeof valor === "number" && valor > 0 ? valor : null,
    orgao: limparTexto(c.orgaoEntidade.razaoSocial),
    orgaoCnpj: cnpj,
    unidade: limparTexto(c.unidadeOrgao.nomeUnidade),
    municipio: limparTexto(c.unidadeOrgao.municipioNome),
    codigoIbge,
    uf,
    regiao: regiaoDe(codigoIbge, uf),
    modalidadeId: c.modalidadeId,
    modalidadeNome: limparTexto(c.modalidadeNome) || (c.modalidadeId === 6 ? "Pregão - Eletrônico" : "Dispensa"),
    dataAbertura: paraIsoBrasilia(c.dataAberturaProposta),
    dataEncerramento,
    anoCompra: c.anoCompra,
    sequencialCompra: c.sequencialCompra,
    linkPncp: `https://pncp.gov.br/app/editais/${cnpj}/${c.anoCompra}/${c.sequencialCompra}`,
    linkOrigem: textoOuNulo(c.linkSistemaOrigem) ?? textoOuNulo(c.linkProcessoEletronico),
  };
}

/** Normaliza a lista, descartando itens inválidos e repetidos (mesmo id). */
export function normalizarLista(contratacoes: readonly ContratacaoPncp[], agora: Date = new Date()): Oportunidade[] {
  const vistos = new Set<string>();
  const resultado: Oportunidade[] = [];
  for (const c of contratacoes) {
    const o = normalizarContratacao(c, agora);
    if (o === null || vistos.has(o.id)) continue;
    vistos.add(o.id);
    resultado.push(o);
  }
  return resultado;
}
