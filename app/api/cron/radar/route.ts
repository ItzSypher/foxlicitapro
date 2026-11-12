import { NextResponse } from "next/server";
import { atualizarRadar } from "@/lib/radar-dados";

/** Coleta diária do PNCP (Vercel Cron). Só roda com `Authorization: Bearer <CRON_SECRET>`. */
export const maxDuration = 300;

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  const resumo = await atualizarRadar();
  return NextResponse.json(resumo);
}
