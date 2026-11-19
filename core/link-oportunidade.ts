import type { Oportunidade } from "./types";

/** Para onde levar quem clica numa oportunidade: página interna da licitação ou link externo. */
export interface LinkDaOportunidade {
  href: string;
  /** true: endereço de fora do sistema (portal de origem ou Alerta Licitação); abrir em nova aba */
  externo: boolean;
}

type CamposDoLink = Pick<Oportunidade, "orgaoCnpj" | "anoCompra" | "sequencialCompra" | "linkOrigem"> &
  Partial<Pick<Oportunidade, "linkAlerta" | "linkPncp">>;

/** A oportunidade tem a chave do PNCP (CNPJ de 14 dígitos, ano e sequencial), que a página interna exige. */
export function temChavePncp(o: Pick<Oportunidade, "orgaoCnpj" | "anoCompra" | "sequencialCompra">): boolean {
  return /^\d{14}$/.test(o.orgaoCnpj) && o.anoCompra > 0 && o.sequencialCompra > 0;
}

function enderecoWeb(valor: string | null | undefined): string | null {
  const v = (valor ?? "").trim();
  return /^https?:\/\//i.test(v) ? v : null;
}

/**
 * Link da oportunidade. Com chave do PNCP, a página interna `/licitacao/{cnpj}/{ano}/{sequencial}`.
 * Sem ela (caso do que veio só do Alerta Licitação), o link externo: portal de origem, senão a página do
 * Alerta Licitação, senão o link do PNCP. Null quando não há nenhum endereço utilizável.
 */
export function linkInternoDaOportunidade(o: CamposDoLink): LinkDaOportunidade | null {
  if (temChavePncp(o)) return { href: `/licitacao/${o.orgaoCnpj}/${o.anoCompra}/${o.sequencialCompra}`, externo: false };
  const externo = enderecoWeb(o.linkOrigem) ?? enderecoWeb(o.linkAlerta) ?? enderecoWeb(o.linkPncp);
  return externo === null ? null : { href: externo, externo: true };
}
