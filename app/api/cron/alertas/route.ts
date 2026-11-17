import { NextResponse } from "next/server";
import { executarAlertasWa } from "@/lib/whatsapp-alertas-cron";

/** Alertas de WhatsApp de hora em hora (pg_cron do Supabase). Só roda com `Authorization: Bearer <ALERTAS_CRON_SECRET>` (ou `CRON_SECRET`). */
export const maxDuration = 300;

function autorizado(request: Request): boolean {
  const cabecalho = request.headers.get("authorization");
  if (!cabecalho) return false;
  const segredos = [process.env.ALERTAS_CRON_SECRET, process.env.CRON_SECRET].filter(
    (s): s is string => typeof s === "string" && s !== "",
  );
  return segredos.some((s) => cabecalho === `Bearer ${s}`);
}

export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  try {
    const resultado = await executarAlertasWa(new Date());
    return NextResponse.json(resultado);
  } catch (e) {
    console.error("[cron] alertas:", e instanceof Error ? e.message : "falha");
    return NextResponse.json({ erro: "Falha ao executar os alertas." }, { status: 500 });
  }
}
