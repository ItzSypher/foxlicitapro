import type { Papel } from "@/core/types-equipe";

/** Nome do cookie com a empresa que o usuário escolheu no seletor. */
export const COOKIE_EMPRESA_ATIVA = "empresa_ativa";

const FORMATO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehIdEmpresa(valor: unknown): valor is string {
  return typeof valor === "string" && FORMATO_ID.test(valor);
}

/** O cookie só interessa se for um id válido e diferente da empresa própria (a própria é o padrão). */
export function cookieEmpresaRelevante(cookie: string | undefined, propriaId: string): string | null {
  if (!ehIdEmpresa(cookie)) return null;
  return cookie.toLowerCase() === propriaId.toLowerCase() ? null : cookie;
}

export interface EmpresaDecidida {
  empresaId: string;
  /** true se a empresa ativa é a do cadastro da pessoa */
  propria: boolean;
}

/**
 * Empresa ativa: a do cookie se a pessoa acessa essa empresa (própria ou da lista de acessos extras); senão, a própria.
 * `acessosExtras` deve conter só empresas ativas.
 */
export function decidirEmpresaAtiva(cookie: string | undefined, propriaId: string, acessosExtras: readonly string[]): EmpresaDecidida {
  const alvo = cookieEmpresaRelevante(cookie, propriaId);
  if (alvo !== null) {
    const achada = acessosExtras.find((id) => id.toLowerCase() === alvo.toLowerCase());
    if (achada !== undefined) return { empresaId: achada, propria: false };
  }
  return { empresaId: propriaId, propria: true };
}

/** Papel que vale na empresa ativa: na própria, o do cadastro; nas outras, sempre gestor. */
export function papelNaEmpresa(papelProprio: Papel, propria: boolean): Papel {
  return propria ? papelProprio : "gestor";
}
