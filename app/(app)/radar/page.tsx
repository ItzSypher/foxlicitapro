import { cookies } from "next/headers";
import { connection } from "next/server";
import type { LimitesCaixa } from "@/core/caixa";
import type { RespostaRadar } from "@/core/types";
import { RadarComPipeline } from "@/components/pipeline/radar-com-pipeline";
import { temPermissao } from "@/core/permissoes";
import { idsNoPipeline } from "@/db/pipeline";
import { listarPalavrasChave } from "@/db/palavras-chave";
import { lerSessao } from "@/lib/sessao";
import { lerPreferencias } from "@/db/preferencias";
import { obterRadar, paginaDaResposta } from "@/lib/radar-dados";
import { COOKIE_FRENTE, lerFrente } from "@/lib/frente";
import { COOKIE_VISAO, lerAba, lerBusca, lerFiltros, lerPagina, lerPalavras, lerVisao } from "@/lib/radar-filtros";
import { lerPorPagina } from "@/lib/radar-pagina";

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
  const sessao = await lerSessao();
  const preferencias = await lerPreferencias();
  const limites: LimitesCaixa = { capitalMaximo: preferencias.capitalMaximo, diasMaximosParado: preferencias.diasMaximosParado };
  const [resposta, ids, palavras] = await Promise.all([
    obterRadar(frente, limites).catch((): RespostaRadar | null => null),
    idsNoPipeline().catch((): Set<string> => new Set()),
    sessao ? listarPalavrasChave(sessao.usuarioId).catch((): string[] => []) : Promise.resolve<string[]>([]),
  ]);

  const pagina = resposta
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
      })
    : null;

  return (
    <RadarComPipeline
      frente={frente}
      pagina={pagina}
      visao={visao}
      buscaInicial={lerBusca(params)}
      idsSalvos={[...ids]}
      palavrasSalvas={palavras}
      podeSalvar={sessao !== null && temPermissao(sessao, "mover_pipeline")}
    />
  );
}
