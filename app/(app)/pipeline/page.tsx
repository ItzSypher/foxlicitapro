import { connection } from "next/server";
import { lerAmostrasEmCache } from "@/db/concorrentes";
import { listarPrecosRecentes } from "@/db/fornecedores";
import { carregarPainelMeta } from "@/db/meta";
import { listarPipeline } from "@/db/pipeline";
import { listarUsuariosAtivos } from "@/db/usuarios";
import { separarEncerrados } from "@/core/encerradas";
import type { AmostraConcorrente } from "@/core/concorrentes";
import type { PrecoFornecedor } from "@/core/fornecedores";
import { resumirObjeto } from "@/core/objeto";
import { precoSugeridoDoItem } from "@/core/preco-sugerido";
import { temPermissao } from "@/core/permissoes";
import { perfilAtual } from "@/lib/empresa-atual";
import { exigirSessao } from "@/lib/sessao";
import { PipelineView } from "@/components/pipeline/pipeline-view";
import {
  ehEtapa,
  ehFiltroRegiao,
  type EtapaId,
  type FiltroRegiaoPipeline,
  type ItemPipeline,
  type PessoaPipeline,
  type ResumoEncerrada,
} from "@/components/pipeline/tipos";

/** Instante do pedido; o cliente parte dele para evitar divergência na hidratação. */
function momento(): number {
  return Date.now();
}

async function lerPessoas(empresaId: string): Promise<PessoaPipeline[]> {
  try {
    return (await listarUsuariosAtivos(empresaId)).map((u) => ({ id: u.id, nome: u.nome }));
  } catch (e) {
    console.error("[pipeline] equipe indisponível:", e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Preço sugerido de cada item aberto, calculado aqui com uma leitura de cada fonte (perfil, amostras de
 * concorrentes em cache e preços de fornecedor): nada de consulta por card nem de busca ao vivo no PNCP.
 * Se uma fonte falhar, o item segue sem preço em vez de derrubar o Pipeline.
 */
async function comPrecoSugerido(empresaId: string, itens: ItemPipeline[]): Promise<ItemPipeline[]> {
  if (itens.length === 0) return itens;
  try {
    const [perfil, amostras, precos] = await Promise.all([
      perfilAtual(),
      lerAmostrasEmCache().catch((): AmostraConcorrente[] => []),
      listarPrecosRecentes(empresaId).catch((): PrecoFornecedor[] => []),
    ]);
    return itens.map((i) => ({
      ...i,
      preco: precoSugeridoDoItem(
        {
          id: i.item.id,
          objeto: i.item.objeto,
          uf: i.item.uf,
          valorEstimado: i.item.valorEstimado,
          frente: i.item.score.frenteCasada,
          cnaes: i.item.score.cnaesCasados,
        },
        perfil.porte,
        i.cotacoes,
        amostras,
        precos,
        resumirObjeto(i.item.objeto),
      ),
    }));
  } catch (e) {
    console.error("[pipeline] preço sugerido indisponível:", e instanceof Error ? e.message : e);
    return itens;
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

  const regiaoBruta = Array.isArray(params.regiao) ? params.regiao[0] : params.regiao;
  const regiaoInicial: FiltroRegiaoPipeline = ehFiltroRegiao(regiaoBruta) ? regiaoBruta : "todas";

  let itens: ItemPipeline[] | null;
  try {
    itens = await listarPipeline(sessao.empresaId);
  } catch (e) {
    console.error("[pipeline] leitura falhou:", e instanceof Error ? e.message : e);
    itens = null;
  }
  const agora = momento();
  const [pessoas, meta] = await Promise.all([lerPessoas(sessao.empresaId), carregarPainelMeta(sessao.empresaId, new Date(agora))]);

  const separados = itens === null ? null : separarEncerrados(itens, (i) => ({ etapa: i.etapa, dataEncerramento: i.item.dataEncerramento }), agora);
  const encerradas: ResumoEncerrada[] = (separados?.encerrados ?? []).map((i) => ({
    regiao: i.item.regiao,
    responsavelId: i.responsavelId,
    criadoPorId: i.criadoPorId,
  }));

  const abertos = separados === null ? null : await comPrecoSugerido(sessao.empresaId, separados.abertos);

  return (
    <PipelineView
      itens={abertos}
      encerradas={encerradas}
      etapaInicial={etapaInicial}
      regiaoInicial={regiaoInicial}
      agoraInicial={agora}
      usuarioId={sessao.usuarioId}
      pessoas={pessoas}
      podeEditar={temPermissao(sessao, "mover_pipeline")}
      podeRevisar={temPermissao(sessao, "revisao_juridica")}
      meta={meta}
    />
  );
}
