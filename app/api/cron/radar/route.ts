import { NextResponse } from "next/server";
import { atualizarRadar } from "@/lib/radar-dados";
import { gerarAvisosDiarios } from "@/lib/avisos-diarios";
import { enviarResumosDiarios } from "@/lib/resumo-diario";

/** Coleta diária do PNCP, resumo por e-mail e avisos da central (painel, e-mail e WhatsApp) (Vercel Cron). Só roda com `Authorization: Bearer <CRON_SECRET>`. */
export const maxDuration = 300;

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  const soResumo = new URL(request.url).searchParams.get("so") === "resumo";
  const coleta = soResumo ? null : await atualizarRadar();
  const resumo = await enviarResumosDiarios();
  const avisos = await gerarAvisosDiarios().catch((e: unknown) => {
    console.error("[cron] avisos:", e instanceof Error ? e.message : e);
    return [];
  });
  return NextResponse.json({ coleta, resumo, avisos });
}
