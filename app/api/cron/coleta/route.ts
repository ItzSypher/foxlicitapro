import { after, NextResponse } from "next/server";
import { acharUf } from "@/core/ufs";
import { atualizarRadar } from "@/lib/radar-dados";

/**
 * Coleta do PNCP de algumas UFs, pedida pelo próprio sistema (Radar com cache velho ou estado novo).
 * Responde na hora e coleta depois, nesta chamada separada: a coleta longa não divide conexão
 * com quem está abrindo as telas. Só roda com `Authorization: Bearer <CRON_SECRET>`.
 */
export const maxDuration = 300;

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  const ufs = (new URL(request.url).searchParams.get("ufs") ?? "")
    .split(",")
    .map((u) => acharUf(u)?.sigla ?? null)
    .filter((u): u is string => u !== null);
  if (ufs.length === 0) return NextResponse.json({ erro: "Informe as UFs." }, { status: 400 });

  after(() => atualizarRadar({ ufs }).then(() => undefined));
  return NextResponse.json({ agendada: ufs });
}
