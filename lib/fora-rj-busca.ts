import { palavrasDe } from "@/core/texto-busca";
import type { ModalidadeId, OportunidadeComScore } from "@/core/types";

/**
 * Busca sob demanda no PNCP fora do Rio de Janeiro: formulário, URL, limites e frases.
 * Só lógica leve (sem consulta ao PNCP), para a interface e os testes usarem à vontade.
 */

export const UF_BRASIL_TODO = "BR";

/** Tamanho máximo da palavra-chave, igual ao do campo de busca do Radar. */
export const MAX_PALAVRA = 100;

/** Limites de cada busca para não estourar o tempo da página. */
export const LIMITES_FORA_RJ = {
  /** Páginas (de 50) por modalidade */
  maxPaginas: 5,
  /** Propostas que encerram em até tantos dias a partir de hoje */
  diasAFrente: 15,
  /** Timeout de cada chamada ao PNCP */
  timeoutMs: 6000,
  /** Itens mostrados, os de maior nota primeiro */
  maxResultados: 60,
} as const;

export interface UfBrasil {
  sigla: string;
  nome: string;
  /** Código IBGE do estado: os 2 primeiros dígitos do código de seus municípios */
  codigo: string;
}

/** As 27 UFs. */
export const UFS: ReadonlyArray<UfBrasil> = [
  { sigla: "AC", nome: "Acre", codigo: "12" },
  { sigla: "AL", nome: "Alagoas", codigo: "27" },
  { sigla: "AP", nome: "Amapá", codigo: "16" },
  { sigla: "AM", nome: "Amazonas", codigo: "13" },
  { sigla: "BA", nome: "Bahia", codigo: "29" },
  { sigla: "CE", nome: "Ceará", codigo: "23" },
  { sigla: "DF", nome: "Distrito Federal", codigo: "53" },
  { sigla: "ES", nome: "Espírito Santo", codigo: "32" },
  { sigla: "GO", nome: "Goiás", codigo: "52" },
  { sigla: "MA", nome: "Maranhão", codigo: "21" },
  { sigla: "MT", nome: "Mato Grosso", codigo: "51" },
  { sigla: "MS", nome: "Mato Grosso do Sul", codigo: "50" },
  { sigla: "MG", nome: "Minas Gerais", codigo: "31" },
  { sigla: "PA", nome: "Pará", codigo: "15" },
  { sigla: "PB", nome: "Paraíba", codigo: "25" },
  { sigla: "PR", nome: "Paraná", codigo: "41" },
  { sigla: "PE", nome: "Pernambuco", codigo: "26" },
  { sigla: "PI", nome: "Piauí", codigo: "22" },
  { sigla: "RJ", nome: "Rio de Janeiro", codigo: "33" },
  { sigla: "RN", nome: "Rio Grande do Norte", codigo: "24" },
  { sigla: "RS", nome: "Rio Grande do Sul", codigo: "43" },
  { sigla: "RO", nome: "Rondônia", codigo: "11" },
  { sigla: "RR", nome: "Roraima", codigo: "14" },
  { sigla: "SC", nome: "Santa Catarina", codigo: "42" },
  { sigla: "SP", nome: "São Paulo", codigo: "35" },
  { sigla: "SE", nome: "Sergipe", codigo: "28" },
  { sigla: "TO", nome: "Tocantins", codigo: "17" },
];

/** UFs que a busca oferece: todas, menos o RJ (que já é o Radar). */
export const UFS_FORA_RJ: ReadonlyArray<UfBrasil> = UFS.filter((u) => u.sigla !== "RJ");

export function acharUf(sigla: string): UfBrasil | null {
  const s = sigla.trim().toUpperCase();
  return UFS.find((u) => u.sigla === s) ?? null;
}

export interface BuscaForaRj {
  /** Sigla da UF ou "BR" (Brasil todo) */
  uf: string;
  /** Código IBGE do município (7 dígitos); null para o estado inteiro */
  codigoMunicipioIbge: string | null;
  /** Palavra-chave do objeto; vazia quando não há. Obrigatória no Brasil todo. */
  palavra: string;
  /** Por padrão só serviços; com true entram também as oportunidades de produtos */
  incluirProdutos: boolean;
}

export type LeituraBuscaForaRj =
  | { tipo: "vazia" }
  | { tipo: "invalida"; erro: string }
  | { tipo: "ok"; busca: BuscaForaRj };

export const ERRO_PALAVRA_BRASIL =
  "Para buscar no Brasil todo, informe uma palavra-chave (por exemplo: software, suporte técnico).";

/** Valida uma busca já montada (formulário ou URL). Função pura. */
export function validarBuscaForaRj(bruta: {
  uf: string;
  codigoMunicipioIbge?: string | null;
  palavra?: string | null;
  incluirProdutos?: boolean;
}): LeituraBuscaForaRj {
  const uf = bruta.uf.trim().toUpperCase();
  const palavra = (bruta.palavra ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_PALAVRA);
  const incluirProdutos = bruta.incluirProdutos === true;

  if (uf === UF_BRASIL_TODO) {
    if (palavrasDe(palavra).length === 0) return { tipo: "invalida", erro: ERRO_PALAVRA_BRASIL };
    return { tipo: "ok", busca: { uf, codigoMunicipioIbge: null, palavra, incluirProdutos } };
  }

  if (uf === "RJ") {
    return { tipo: "invalida", erro: "O Rio de Janeiro já está no Radar. Escolha outro estado." };
  }
  const estado = acharUf(uf);
  if (!estado) return { tipo: "invalida", erro: "Escolha um estado da lista." };

  const municipio = (bruta.codigoMunicipioIbge ?? "").trim();
  if (municipio !== "" && (!/^\d{7}$/.test(municipio) || !municipio.startsWith(estado.codigo))) {
    return { tipo: "invalida", erro: "O município não pertence ao estado escolhido." };
  }
  return {
    tipo: "ok",
    busca: { uf: estado.sigla, codigoMunicipioIbge: municipio === "" ? null : municipio, palavra, incluirProdutos },
  };
}

/** Lê a busca de ?uf=, ?mun=, ?q= e ?prod=1. Sem ?uf= não há busca. */
export function lerBuscaForaRj(params: { get(nome: string): string | null }): LeituraBuscaForaRj {
  const uf = params.get("uf");
  if (uf === null || uf.trim() === "") return { tipo: "vazia" };
  return validarBuscaForaRj({
    uf,
    codigoMunicipioIbge: params.get("mun"),
    palavra: params.get("q"),
    incluirProdutos: params.get("prod") === "1",
  });
}

/** Texto de query string que a página de resultado entende (inverso de `lerBuscaForaRj`). */
export function montarQueryForaRj(busca: BuscaForaRj): string {
  const params = new URLSearchParams({ uf: busca.uf });
  if (busca.codigoMunicipioIbge) params.set("mun", busca.codigoMunicipioIbge);
  if (busca.palavra !== "") params.set("q", busca.palavra);
  if (busca.incluirProdutos) params.set("prod", "1");
  return params.toString();
}

export interface ResultadoForaRj {
  busca: BuscaForaRj;
  /** Os melhores resultados, até `LIMITES_FORA_RJ.maxResultados` */
  itens: OportunidadeComScore[];
  /** Quantos passaram pelos filtros, antes do corte de `maxResultados` */
  totalFiltrado: number;
  /** Quantas contratações o PNCP devolveu nas páginas lidas */
  lidas: number;
  paginasConsultadas: number;
  /** Total de páginas que o PNCP tem para essa busca (nas duas modalidades) */
  paginasNoPncp: number;
  /** true quando o limite de páginas deixou parte da busca de fora */
  cortouPaginas: boolean;
  /** Modalidades em que alguma página não carregou */
  falhas: ModalidadeId[];
  /** Janela da consulta, em dias a partir de hoje */
  diasJanela: number;
  /** ISO 8601 do momento da busca */
  atualizadoEm: string;
}

export function frasePaginas(n: number): string {
  return `${n} ${n === 1 ? "página" : "páginas"}`;
}

/** Aviso de corte quando o limite de páginas deixou parte da busca de fora; null quando leu tudo. */
export function avisoCorteForaRj(r: ResultadoForaRj): string | null {
  if (!r.cortouPaginas) return null;
  const dica = r.busca.codigoMunicipioIbge
    ? "Acrescente uma palavra-chave para focar."
    : r.busca.uf === UF_BRASIL_TODO
      ? "Escolha um estado e, se puder, um município para uma busca mais completa."
      : "Escolha um município para uma busca mais completa.";
  return `Busca cortada pelo limite: lemos ${r.paginasConsultadas} de ${frasePaginas(r.paginasNoPncp)} do PNCP (até ${LIMITES_FORA_RJ.maxPaginas} por modalidade). Pode haver mais licitações. ${dica}`;
}

/** Aviso de falha parcial; null quando tudo carregou. */
export function avisoFalhaForaRj(r: ResultadoForaRj): string | null {
  const pregao = r.falhas.includes(6);
  const dispensa = r.falhas.includes(8);
  if (pregao && dispensa) return "O PNCP não entregou tudo agora; a lista pode estar incompleta.";
  if (pregao) return "Parte dos pregões não carregou agora; a lista pode estar incompleta.";
  if (dispensa) return "Parte das dispensas não carregou agora; a lista pode estar incompleta.";
  return null;
}

/** Nome do local da busca, para o título. */
export function nomeLocalForaRj(busca: BuscaForaRj, nomeMunicipio?: string | null): string {
  if (busca.uf === UF_BRASIL_TODO) return "Brasil todo";
  const estado = acharUf(busca.uf)?.nome ?? busca.uf;
  return nomeMunicipio ? `${nomeMunicipio} (${busca.uf})` : estado;
}

/** O que a busca olha, dito com clareza: frentes e janela de prazo. */
export function fraseEscopoForaRj(busca: BuscaForaRj): string {
  const frentes = busca.incluirProdutos
    ? "serviços (software, infraestrutura e suporte) e também produtos"
    : "só serviços (software, infraestrutura e suporte)";
  return `Mostra ${frentes}, nas propostas que encerram nos próximos ${LIMITES_FORA_RJ.diasAFrente} dias.`;
}
