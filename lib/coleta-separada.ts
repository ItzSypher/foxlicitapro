import "server-only";
import { linkAbsoluto } from "@/lib/email";

/** Só para o pedido sair; a coleta continua na outra chamada. */
const ESPERA_MS = 5_000;

/**
 * Pede a coleta das UFs em outra chamada (`/api/cron/coleta`), para não travar a tela de quem pediu.
 * Nunca lança. Sem CRON_SECRET não faz nada: o cron diário cobre.
 */
export async function pedirColeta(ufs: ReadonlyArray<string>): Promise<void> {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || ufs.length === 0) return;
  try {
    await fetch(linkAbsoluto(`/api/cron/coleta?ufs=${encodeURIComponent(ufs.join(","))}`), {
      headers: { Authorization: `Bearer ${segredo}` },
      signal: AbortSignal.timeout(ESPERA_MS),
      cache: "no-store",
    });
  } catch (e) {
    console.error("[coleta] pedido falhou:", e instanceof Error ? e.message : e);
  }
}
