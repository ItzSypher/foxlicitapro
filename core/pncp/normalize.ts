import { regiaoDe } from "../regioes";
import type { ModalidadeId, Oportunidade } from "../types";
import type { ContratacaoPncp } from "./schema";

const FUSO_BRASILIA = "-03:00";

/** Grupo do Radar de cada modalidade do PNCP coletada; null para as que o Radar não trata. */
export function grupoDaModalidadePncp(id: number): ModalidadeId | null {
  if (id === 4 || id === 5 || id === 6 || id === 7) return 6;
  if (id === 8 || id === 12) return 8;
  return null;
}

/** Grupos do Radar das modalidades do PNCP, sem repetir. */
export function gruposDeModalidades(codigos: ReadonlyArray<number>): ModalidadeId[] {
  const grupos = new Set<ModalidadeId>();
  for (const codigo of codigos) {
    const grupo = grupoDaModalidadePncp(codigo);
    if (grupo !== null) grupos.add(grupo);
  }
  return [...grupos];
}

const NOME_PADRAO: Readonly<Record<number, string>> = {
  4: "Concorrência - Eletrônica",
  5: "Concorrência - Presencial",
  6: "Pregão - Eletrônico",
  7: "Pregão - Presencial",
  8: "Dispensa",
  12: "Credenciamento",
};

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
 * Devolve null quando o item não serve: modalidade que o Radar não coleta (4, 5, 6, 7, 8, 12), sem data de
 * encerramento válida ou com encerramento já no passado.
 */
export function normalizarContratacao(c: ContratacaoPncp, agora: Date = new Date()): Oportunidade | null {
  const grupo = grupoDaModalidadePncp(c.modalidadeId);
  if (grupo === null) return null;

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
    modalidadeId: grupo,
    modalidadeNome: limparTexto(c.modalidadeNome) || (NOME_PADRAO[c.modalidadeId] ?? "Dispensa"),
    dataAbertura: paraIsoBrasilia(c.dataAberturaProposta),
    dataPublicacao: paraIsoBrasilia(c.dataPublicacaoPncp),
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
