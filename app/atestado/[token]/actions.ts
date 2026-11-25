"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { AssinaturaClienteSchema } from "@/core/atestados";
import { assinar } from "@/db/atestados";

export type ResultadoAssinar = { ok: true; codigo: string } | { ok: false; erro: string };

const MENSAGEM: Record<"indisponivel" | "expirado" | "ja-assinado", string> = {
  indisponivel: "Este link não está mais disponível.",
  expirado: "O prazo deste link terminou. Peça um novo link à empresa.",
  "ja-assinado": "Este atestado já foi assinado.",
};

/** Primeiro endereço de x-forwarded-for (o do cliente); sem ele, x-real-ip. */
function enderecoDoCliente(h: Headers): string {
  const encaminhado = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return encaminhado || h.get("x-real-ip")?.trim() || "desconhecido";
}

/** Assina pelo link. Sem login: o token no endereço é a credencial e a conferência de prazo e status fica no banco. */
export async function assinarAtestadoAction(token: string, entrada: unknown): Promise<ResultadoAssinar> {
  const lido = AssinaturaClienteSchema.safeParse(entrada);
  if (!lido.success) return { ok: false, erro: lido.error.issues[0]?.message ?? "Confira os dados e tente de novo." };
  const h = await headers();
  try {
    const r = await assinar(String(token).slice(0, 80), lido.data, {
      ip: enderecoDoCliente(h),
      agente: h.get("user-agent") ?? "desconhecido",
    });
    if (!r.ok) return { ok: false, erro: MENSAGEM[r.motivo] };
    revalidatePath("/atestados");
    revalidatePath("/acervo");
    return { ok: true, codigo: r.codigo };
  } catch (e) {
    console.error("[atestado] assinatura falhou:", e instanceof Error ? e.message : e);
    return { ok: false, erro: "Não foi possível registrar a assinatura agora. Tente de novo em instantes." };
  }
}
