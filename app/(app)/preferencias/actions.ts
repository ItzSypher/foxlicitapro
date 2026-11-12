"use server";

import { preferenciasSchema } from "@/core/preferencias";
import type { Preferencias } from "@/core/types-equipe";
import { salvarPreferencias } from "@/db/preferencias";
import { exigirDono } from "@/lib/sessao";

export type ResultadoSalvar = { ok: true; preferencias: Preferencias } | { ok: false; erro: string };

/** Grava as preferências. Só o dono passa; os termos voltam normalizados (sem acento, sem repetidos). */
export async function salvarPreferenciasAction(entrada: Preferencias): Promise<ResultadoSalvar> {
  try {
    await exigirDono();
  } catch {
    return { ok: false, erro: "Só o dono altera as preferências." };
  }

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
