import { connection } from "next/server";
import { listarPipeline } from "@/db/pipeline";
import { listarUsuariosAtivos } from "@/db/usuarios";
import { temPermissao } from "@/core/permissoes";
import { exigirSessao } from "@/lib/sessao";
import { PipelineView } from "@/components/pipeline/pipeline-view";
import { ehEtapa, type EtapaId, type ItemPipeline, type PessoaPipeline } from "@/components/pipeline/tipos";

/** Instante do pedido; o cliente parte dele para evitar divergência na hidratação. */
function momento(): number {
  return Date.now();
}

async function lerPessoas(): Promise<PessoaPipeline[]> {
  try {
    return (await listarUsuariosAtivos()).map((u) => ({ id: u.id, nome: u.nome }));
  } catch (e) {
    console.error("[pipeline] equipe indisponível:", e instanceof Error ? e.message : e);
    return [];
  }
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ [chave: string]: string | string[] | undefined }>;
}) {
  await connection();
  const sessao = await exigirSessao();
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
  const pessoas = await lerPessoas();

  return (
    <PipelineView
      itens={itens}
      etapaInicial={etapaInicial}
      agoraInicial={momento()}
      usuarioId={sessao.usuarioId}
      pessoas={pessoas}
      podeEditar={temPermissao(sessao, "mover_pipeline")}
      podeRevisar={temPermissao(sessao, "revisao_juridica")}
    />
  );
}
