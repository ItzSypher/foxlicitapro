import { cookies } from "next/headers";
import { connection } from "next/server";
import type { LimitesCaixa } from "@/core/caixa";
import type { RespostaRadar } from "@/core/types";
import { RadarComPipeline } from "@/components/pipeline/radar-com-pipeline";
import { ufsDeColeta } from "@/core/areas";
import type { Deserta } from "@/core/desertas";
import { propostaProntaLigada } from "@/core/propostas-prontas";
import { listarDesertas } from "@/db/desertas";
import { propostasProntasDasCompras } from "@/db/propostas-prontas";
import { temPermissao } from "@/core/permissoes";
import { carregarPainelMeta } from "@/db/meta";
import { idsNoPipeline, itensTravadosNoPipeline, resumoPipeline, type ResumoPipeline } from "@/db/pipeline";
import { listarPalavrasChave } from "@/db/palavras-chave";
import { exigirSessao } from "@/lib/sessao";
import { perfilAtual } from "@/lib/empresa-atual";
import { lerPreferencias } from "@/db/preferencias";
import { obterRadar, paginaDaResposta } from "@/lib/radar-dados";
import { COOKIE_FRENTE, lerFrente } from "@/lib/frente";
import { COOKIE_VISAO, lerAba, lerBusca, lerFiltros, lerPagina, lerPalavras, lerVisao } from "@/lib/radar-filtros";
import type { PipelinePainel } from "@/lib/radar-painel";
import { lerPorPagina, type PaginaRadar } from "@/lib/radar-pagina";

type ParametrosDaUrl = Record<string, string | string[] | undefined>;

/** Mesma interface de URLSearchParams.get, sobre os searchParams do Next (o primeiro valor vale). */
function lerParametros(bruto: ParametrosDaUrl): { get(nome: string): string | null } {
  return {
    get(nome) {
      const valor = bruto[nome];
      if (Array.isArray(valor)) return valor[0] ?? null;
      return valor ?? null;
    },
  };
}

export default async function RadarPage({ searchParams }: { searchParams: Promise<ParametrosDaUrl> }) {
  await connection();
  const jar = await cookies();
  const frente = lerFrente(jar.get(COOKIE_FRENTE)?.value);
  const params = lerParametros(await searchParams);
  // ?ver= vence o cookie da visualização.
  const visao = lerVisao(params.get("ver") ?? jar.get(COOKIE_VISAO)?.value);

  // Radar e pipeline em paralelo; se o banco falhar, o Radar segue sem marcar os salvos.
  const sessao = await exigirSessao();
  const [preferencias, perfil] = await Promise.all([lerPreferencias(sessao.empresaId), perfilAtual()]);
  const limites: LimitesCaixa = { capitalMaximo: preferencias.capitalMaximo, diasMaximosParado: preferencias.diasMaximosParado };
  const [resposta, ids, travados, palavras, resumoPipe, meta, desertas] = await Promise.all([
    obterRadar(frente, limites, perfil).catch((): RespostaRadar | null => null),
    idsNoPipeline(sessao.empresaId).catch((): Set<string> => new Set()),
    itensTravadosNoPipeline(sessao.empresaId).catch((): Map<string, string> => new Map()),
    listarPalavrasChave(sessao.empresaId, sessao.usuarioId).catch((): string[] => []),
    // Uma consulta de contagem; se falhar, o cartão do pipeline só perde os números.
    resumoPipeline(sessao.empresaId).catch((): ResumoPipeline | null => null),
    // Já devolve null se falhar: o resumo só perde o painel da meta.
    carregarPainelMeta(sessao.empresaId, new Date()),
    // Dispensas sem vencedor das UFs da empresa; se falhar (ou estiver desligada), a aba só fica vazia.
    propostaProntaLigada(process.env.DESERTAS_ATIVA)
      ? listarDesertas(ufsDeColeta(perfil.areas)).catch((): Deserta[] => [])
      : Promise.resolve<Deserta[]>([]),
  ]);
  const pipeline: PipelinePainel | null = resumoPipe
    ? { ativas: resumoPipe.ativas, emDisputa: resumoPipe.emDisputa.quantidade }
    : null;

  const base = resposta
    ? paginaDaResposta(resposta, {
        frente,
        filtros: lerFiltros(params),
        aba: lerAba(params),
        busca: lerBusca(params),
        palavras: lerPalavras(params),
        palavrasSalvas: palavras,
        pagina: lerPagina(params),
        porPagina: lerPorPagina(params),
        preferencias,
        perfil,
        desertas,
      })
    : null;
  // Selo "Proposta pronta": uma consulta só, para as oportunidades da página (quando o assistente está ligado).
  const prontas: Record<string, string> = base && propostaProntaLigada(process.env.PROPOSTA_PRONTA_ATIVA)
    ? await propostasProntasDasCompras(sessao.empresaId, base.itens.map((o) => o.id)).catch((): Record<string, string> => ({}))
    : {};
  const pagina: PaginaRadar | null = base ? { ...base, prontas, painel: { ...base.painel, pipeline } } : null;

  return (
    <RadarComPipeline
      frente={frente}
      pagina={pagina}
      visao={visao}
      buscaInicial={lerBusca(params)}
      idsSalvos={[...ids]}
      travados={Object.fromEntries(travados)}
      palavrasSalvas={palavras}
      meta={meta}
      ufsAtendidas={ufsDeColeta(perfil.areas)}
      foco={perfil.foco}
      podeSalvar={sessao !== null && temPermissao(sessao, "mover_pipeline")}
    />
  );
}
