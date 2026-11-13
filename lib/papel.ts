import { ROTULO_PAPEL } from "@/core/permissoes";
import type { Papel } from "@/core/types-equipe";

export function rotuloPapel(papel: Papel): string {
  return ROTULO_PAPEL[papel];
}
