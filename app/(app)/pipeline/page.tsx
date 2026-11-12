import { connection } from "next/server";
import { listarPipeline } from "@/db/pipeline";
import { PipelineView } from "@/components/pipeline/pipeline-view";
import { ehEtapa, type EtapaId, type ItemPipeline } from "@/components/pipeline/tipos";

/** Instante do pedido; o cliente parte dele para evitar divergência na hidratação. */
function momento(): number {
  return Date.now();
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ [chave: string]: string | string[] | undefined }>;
}) {
  await connection();
  const params = await searchParams;
  const bruto = Array.isArray(params.etapa) ? params.etapa[0] : params.etapa;
  const etapaInicial: EtapaId = ehEtapa(bruto) ? bruto : "radar";

  let itens: ItemPipeline[] | null;
  try {
    itens = await listarPipeline();
  } catch (e) {
    console.error("[pipeline] leitura falhou:", e instanceof Error ? e.message : e);
    itens = null;
  }

  return <PipelineView itens={itens} etapaInicial={etapaInicial} agoraInicial={momento()} />;
}
