"use server";

import { preferenciasSchema } from "@/core/preferencias";
import type { Preferencias } from "@/core/types-equipe";
import { salvarPreferencias } from "@/db/preferencias";
import { verificarPermissao } from "@/lib/sessao";

export type ResultadoSalvar = { ok: true; preferencias: Preferencias } | { ok: false; erro: string };

/** Grava as preferências. Exige a permissão de editar preferências; os termos voltam normalizados (sem acento, sem repetidos). */
export async function salvarPreferenciasAction(entrada: Preferencias): Promise<ResultadoSalvar> {
  const v = await verificarPermissao("editar_preferencias");
  if (!v.ok) return { ok: false, erro: v.erro };

  const validado = preferenciasSchema.safeParse(entrada);
  if (!validado.success) {
    return { ok: false, erro: validado.error.issues[0]?.message ?? "Confira os dados e tente de novo." };
  }

  try {
    const salvas = await salvarPreferencias(validado.data);
    return { ok: true, preferencias: salvas };
  } catch {
    return { ok: false, erro: "Não foi possível salvar agora. Tente de novo em instantes." };
  }
}
