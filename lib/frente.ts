import type { Frente } from "@/core/types";

export const COOKIE_FRENTE = "frente";
export const FRENTE_PADRAO: Frente = "servicos";

export function ehFrente(valor: unknown): valor is Frente {
  return valor === "servicos" || valor === "produtos";
}

export function lerFrente(valor: string | undefined): Frente {
  return ehFrente(valor) ? valor : FRENTE_PADRAO;
}
