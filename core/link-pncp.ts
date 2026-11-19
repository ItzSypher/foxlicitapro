import type { ChaveCompra } from "./types-detalhe";

/**
 * Lê links do PNCP (e o link interno do sistema) e o número de controle solto no texto.
 * Função pura: não consulta nada, só extrai a chave {cnpj, ano, sequencial}.
 */

const ANO_MIN = 2000;
const ANO_MAX = 2100;

/** /app/editais/{cnpj}/{ano}/{seq}, /editais/... e o link interno /licitacao/{cnpj}/{ano}/{seq}. */
const POR_CAMINHO = /\/(?:editais|licitacao)\/(\d{14})\/(\d{4})\/(\d{1,9})(?!\d)/g;
/** Número de controle: {cnpj}-{tipo}-{seq}/{ano}; também dentro de /app/editais/{cnpj}-1-{seq}/{ano}. */
const POR_CONTROLE = /(?<!\d)(\d{14})-\d{1,2}-(\d{1,9})\/(\d{4})(?!\d)/g;
/** Endereço da API do PNCP: /orgaos/{cnpj}/compras/{ano}/{seq}. */
const POR_API = /\/orgaos\/(\d{14})\/compras\/(\d{4})\/(\d{1,9})(?!\d)/g;

function chaveValida(cnpj: string, ano: string, seq: string): ChaveCompra | null {
  const a = Number.parseInt(ano, 10);
  const s = Number.parseInt(seq, 10);
  if (!/^\d{14}$/.test(cnpj) || !Number.isInteger(a) || a < ANO_MIN || a > ANO_MAX) return null;
  if (!Number.isSafeInteger(s) || s <= 0) return null;
  return { cnpj, ano: a, sequencial: s };
}

function decodificar(texto: string): string {
  try {
    return decodeURIComponent(texto);
  } catch {
    return texto.replace(/%2F/gi, "/");
  }
}

/** Todas as chaves do texto, na ordem em que aparecem e sem repetir. */
export function lerLinksPncp(texto: string): ChaveCompra[] {
  const base = decodificar(texto);
  const achados: Array<{ indice: number; chave: ChaveCompra }> = [];

  for (const m of base.matchAll(POR_CAMINHO)) {
    const chave = chaveValida(m[1] ?? "", m[2] ?? "", m[3] ?? "");
    if (chave) achados.push({ indice: m.index ?? 0, chave });
  }
  for (const m of base.matchAll(POR_API)) {
    const chave = chaveValida(m[1] ?? "", m[2] ?? "", m[3] ?? "");
    if (chave) achados.push({ indice: m.index ?? 0, chave });
  }
  for (const m of base.matchAll(POR_CONTROLE)) {
    const chave = chaveValida(m[1] ?? "", m[3] ?? "", m[2] ?? "");
    if (chave) achados.push({ indice: m.index ?? 0, chave });
  }

  achados.sort((a, b) => a.indice - b.indice);
  const vistos = new Set<string>();
  const lista: ChaveCompra[] = [];
  for (const { chave } of achados) {
    const id = `${chave.cnpj}/${chave.ano}/${chave.sequencial}`;
    if (vistos.has(id)) continue;
    vistos.add(id);
    lista.push(chave);
  }
  return lista;
}

/** A primeira chave do texto, ou null se não houver link reconhecido. */
export function lerLinkPncp(texto: string): ChaveCompra | null {
  return lerLinksPncp(texto)[0] ?? null;
}

/** Caminho da página interna da licitação. */
export function caminhoInterno(chave: ChaveCompra): string {
  return `/licitacao/${chave.cnpj}/${chave.ano}/${chave.sequencial}`;
}
