import { NextResponse } from "next/server";
import { atualizarRadar } from "@/lib/radar-dados";
import { gerarAvisosDesertas, gerarAvisosDiarios } from "@/lib/avisos-diarios";
import { coletarDesertas } from "@/lib/desertas-coleta";
import { montarPropostasProntas } from "@/lib/propostas-prontas";
import { propostaProntaLigada } from "@/core/propostas-prontas";
import { atualizarResultadosPropostas } from "@/lib/propostas-resultado";
import { enviarResumosDiarios } from "@/lib/resumo-diario";

/**
 * Coleta diária do PNCP, resumo por e-mail, avisos da central (painel, e-mail e WhatsApp), resultado das propostas
 * enviadas e dispensas desertas (Vercel Cron). Só roda com `Authorization: Bearer <CRON_SECRET>`.
 * `?so=resumo` pula a coleta; `?so=prontas` só monta os rascunhos de proposta (cron próprio, para ter o tempo todo da função).
 */
export const maxDuration = 300;

/** Depois deste tempo desde o início, as desertas não entram na rodada: o que veio antes tem prioridade. */
const LIMITE_PARA_DESERTAS_MS = 200_000;
/** A coleta de desertas termina antes dos 300 s da função. */
const FIM_DESERTAS_MS = 270_000;
/** Os rascunhos precisam de folga: cada um pode levar mais de um minuto. */
const FIM_PRONTAS_MS = 200_000;

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  const inicio = Date.now();
  const modo = new URL(request.url).searchParams.get("so");

  if (modo === "prontas") {
    const prontas = await montarPropostasProntas(new Date(), inicio + FIM_PRONTAS_MS);
    return NextResponse.json({ prontas });
  }

  const soResumo = modo === "resumo";
  const coleta = soResumo ? null : await atualizarRadar();
  const resumo = await enviarResumosDiarios();
  const avisos = await gerarAvisosDiarios().catch((e: unknown) => {
    console.error("[cron] avisos:", e instanceof Error ? e.message : e);
    return [];
  });
  // Por último: o que vem antes não pode esperar pelo PNCP.
  const resultados = soResumo ? null : await atualizarResultadosPropostas();
  const desertas =
    soResumo || !propostaProntaLigada(process.env.DESERTAS_ATIVA) || Date.now() - inicio > LIMITE_PARA_DESERTAS_MS
      ? null : await coletarDesertas({ prazoMs: inicio + FIM_DESERTAS_MS });
  // Depois da coleta: só então há desertas novas para contar.
  const avisosDesertas = desertas
    ? await gerarAvisosDesertas().catch((e: unknown) => {
        console.error("[cron] avisos de desertas:", e instanceof Error ? e.message : e);
        return null;
      })
    : null;
  return NextResponse.json({ coleta, resumo, avisos, resultados, desertas, avisosDesertas });
}
