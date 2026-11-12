import type { Papel } from "@/core/types-equipe";

export function rotuloPapel(papel: Papel): string {
  return papel === "dono" ? "Dono" : "Gestor";
}
