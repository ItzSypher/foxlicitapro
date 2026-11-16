import { cookies } from "next/headers";
import { connection } from "next/server";
import Link from "next/link";
import type { LimitesCaixa } from "@/core/caixa";
import { temPermissao } from "@/core/permissoes";
import { ForaRjComPipeline } from "@/components/pipeline/fora-rj-com-pipeline";
import { BuscaForaRjSheet } from "@/components/radar/busca-fora-rj";
import { EstadoVazio } from "@/components/radar/estados";
import { idsNoPipeline } from "@/db/pipeline";
import { lerPreferencias } from "@/db/preferencias";
import { perfilAtual } from "@/lib/empresa-atual";
import { lerBuscaForaRj, UF_BRASIL_TODO } from "@/lib/fora-rj-busca";
import { listarMunicipios } from "@/lib/ibge";
import { COOKIE_VISAO, lerVisao } from "@/lib/radar-filtros";
import { buscarForaRj } from "@/lib/radar-fora-rj";
import { exigirSessao } from "@/lib/sessao";

type ParametrosDaUrl = Record<string, string | string[] | undefined>;

function lerParametros(bruto: ParametrosDaUrl): { get(nome: string): string | null } {
  return {
    get(nome) {
      const valor = bruto[nome];
      if (Array.isArray(valor)) return valor[0] ?? null;
      return valor ?? null;
    },
  };
}

function Cabecalho({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/radar"
        className="inline-flex h-11 w-fit items-center rounded-control pr-2 text-sm text-muted-foreground outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand md:h-9"
      >
        Voltar ao Radar do RJ
      </Link>
      <h1 className="text-[22px] leading-tight font-semibold text-ink">Fora do RJ</h1>
      {children}
    </div>
  );
}

export default async function ForaRjPage({ searchParams }: { searchParams: Promise<ParametrosDaUrl> }) {
  await connection();
  const params = lerParametros(await searchParams);
  const leitura = lerBuscaForaRj(params);

  if (leitura.tipo !== "ok") {
    return (
      <div className="flex flex-col gap-5">
        <Cabecalho>
          {leitura.tipo === "invalida" ? (
            <p role="alert" className="text-sm text-negative">
              {leitura.erro}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Busca sob demanda no PNCP, só para esta consulta. Não altera o Radar diário do RJ.
            </p>
          )}
        </Cabecalho>
        <EstadoVazio frase="Escolha um estado (ou o Brasil todo com uma palavra-chave) para começar." />
        <div>
          <BuscaForaRjSheet variante="contorno" rotulo="Escolher onde buscar" />
        </div>
      </div>
    );
  }

  const busca = leitura.busca;
  const jar = await cookies();
  const visao = lerVisao(params.get("ver") ?? jar.get(COOKIE_VISAO)?.value);
  const sessao = await exigirSessao();
  const [preferencias, perfil] = await Promise.all([lerPreferencias(sessao.empresaId), perfilAtual()]);
  const limites: LimitesCaixa = { capitalMaximo: preferencias.capitalMaximo, diasMaximosParado: preferencias.diasMaximosParado };

  const [resultado, ids, municipios] = await Promise.all([
    buscarForaRj(busca, { limites, perfil }),
    idsNoPipeline(sessao.empresaId).catch((): Set<string> => new Set()),
    busca.codigoMunicipioIbge && busca.uf !== UF_BRASIL_TODO ? listarMunicipios(busca.uf) : Promise.resolve(null),
  ]);
  const nomeMunicipio = municipios?.find((m) => m.codigo === busca.codigoMunicipioIbge)?.nome ?? null;

  return (
    <ForaRjComPipeline
      resultado={resultado}
      visao={visao}
      nomeMunicipio={nomeMunicipio}
      idsSalvos={[...ids]}
      podeSalvar={temPermissao(sessao, "mover_pipeline")}
    />
  );
}
