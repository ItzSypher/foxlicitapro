import Link from "next/link";
import { connection } from "next/server";
import { Download, Printer } from "lucide-react";
import { FiltrosLista } from "@/components/resultados/filtros-lista";
import { GraficoMeses } from "@/components/resultados/grafico-meses";
import { Indicadores } from "@/components/resultados/indicadores";
import { ListaResultados } from "@/components/resultados/lista-resultados";
import { BarrasMotivos, BarrasQuebra } from "@/components/resultados/quebras";
import { SeletorPeriodo } from "@/components/resultados/seletor-periodo";
import { BOTAO_SECUNDARIO } from "@/components/propostas/campos";
import { temPermissao } from "@/core/permissoes";
import { consultaResultados } from "@/core/resultados";
import { montarRelatorio, type Relatorio } from "@/lib/resultados-relatorio";
import { formatarMoeda } from "@/lib/formato";
import { exigirSessao } from "@/lib/sessao";

export const metadata = { title: "Resultados · FoxLicita Pro" };

function Secao({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <h2 id={id} className="text-base font-semibold text-ink">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export default async function ResultadosPage({
  searchParams,
}: {
  searchParams: Promise<{ [chave: string]: string | string[] | undefined }>;
}) {
  await connection();
  const sessao = await exigirSessao();
  const agora = new Date();

  if (!temPermissao(sessao, "aprovar_propostas")) {
    return (
      <div className="flex max-w-md flex-col gap-1">
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Resultados</h1>
        <p className="text-sm text-muted-foreground">Só o dono e quem aprova propostas veem os resultados.</p>
      </div>
    );
  }

  const params = await searchParams;
  let relatorio: Relatorio | null = null;
  try {
    relatorio = await montarRelatorio(sessao.empresaId, params, agora);
  } catch (e) {
    console.error("[resultados] leitura falhou:", e instanceof Error ? e.message : e);
  }

  const cabecalho = (
    <header className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Resultados</h1>
        <p className="text-sm text-muted-foreground">O que o pipeline já entregou, com custo, lucro e motivos de perda.</p>
      </div>
      {relatorio ? (
        <div className="flex flex-wrap gap-2">
          <a href={`/resultados/csv${consultaResultados(relatorio.periodo, relatorio.filtros)}`} download className={BOTAO_SECUNDARIO}>
            <Download aria-hidden="true" className="size-4" />
            Baixar CSV
          </a>
          <Link
            href={`/resultados/imprimir${consultaResultados(relatorio.periodo, relatorio.filtros)}`}
            prefetch={false}
            className={BOTAO_SECUNDARIO}
          >
            <Printer aria-hidden="true" className="size-4" />
            Baixar PDF
          </Link>
        </div>
      ) : null}
    </header>
  );

  if (!relatorio) {
    return (
      <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4 lg:gap-6">
        {cabecalho}
        <p role="alert" className="text-sm text-negative">
          Não foi possível carregar os resultados agora. Tente de novo em instantes.
        </p>
      </div>
    );
  }

  const { periodo, filtros, resultados: r, linhas, pessoas } = relatorio;
  const comMeses = r.porMes.length > 1;

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4 lg:gap-6">
      {cabecalho}

      <SeletorPeriodo periodo={periodo} filtros={filtros} agora={agora} />

      <section aria-label="Filtros" className="flex min-w-0 flex-col gap-2">
        <FiltrosLista periodo={periodo} filtros={filtros} pessoas={pessoas} />
        <p className="text-xs text-muted-foreground">Região, frente e responsável valem para tudo na página. Situação e ordem valem só para a lista.</p>
      </section>

      <Indicadores r={r} />

      {comMeses ? (
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <Secao id="titulo-grafico" titulo="Valor ganho por mês">
            <GraficoMeses meses={r.porMes} />
            <p className="sr-only">Total no período: {formatarMoeda(r.valorGanho)}</p>
          </Secao>
          <Secao id="titulo-grafico-lucro" titulo="Lucro por mês">
            <GraficoMeses meses={r.porMes} serie="lucro" />
            <p className="sr-only">Lucro no período: {formatarMoeda(r.lucroTotal)}</p>
          </Secao>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <BarrasQuebra titulo="Por região" itens={r.porRegiao} />
        <BarrasQuebra titulo="Por frente" itens={r.porFrente} />
        <BarrasMotivos motivos={r.motivosPerda} />
      </div>

      <section aria-labelledby="titulo-lista" className="flex min-w-0 flex-col gap-3">
        <h2 id="titulo-lista" className="text-base font-semibold text-ink">
          Licitações
        </h2>
        <ListaResultados linhas={linhas} podeEditar={temPermissao(sessao, "mover_pipeline") || temPermissao(sessao, "aprovar_propostas")} />
      </section>
    </div>
  );
}
