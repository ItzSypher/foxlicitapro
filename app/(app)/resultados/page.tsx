import Link from "next/link";
import { connection } from "next/server";
import { GraficoMeses } from "@/components/resultados/grafico-meses";
import { temPermissao } from "@/core/permissoes";
import { PERIODOS, ROTULO_PERIODO, calcularResultados, ehPeriodo, type PeriodoResultados, type Resultados } from "@/core/resultados";
import { lerDadosResultados } from "@/db/resultados";
import { formatarMoeda, formatarMoedaCurta, plural } from "@/lib/formato";
import { exigirSessao } from "@/lib/sessao";
import { cn } from "@/lib/utils";

export const metadata = { title: "Resultados · FoxLicita Pro" };

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-card border border-border bg-surface p-4">
      <dt className="text-[13px] text-muted-foreground">{rotulo}</dt>
      <dd className="text-3xl leading-tight font-semibold tabular-nums text-ink">{valor}</dd>
      {detalhe ? <p className="text-xs text-muted-foreground">{detalhe}</p> : null}
    </div>
  );
}

function percentual(taxa: number | null): string {
  return taxa === null ? "—" : `${Math.round(taxa * 100)}%`;
}

function Painel({ r }: { r: Resultados }) {
  const decididas = r.ganhas + r.perdidas;
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero rotulo="Licitações analisadas" valor={String(r.analisadas)} />
        <Numero rotulo="Propostas enviadas" valor={String(r.propostasEnviadas)} />
        <Numero rotulo="Ganhas" valor={String(r.ganhas)} />
        <Numero rotulo="Perdidas" valor={String(r.perdidas)} />
        <Numero
          rotulo="Taxa de vitória"
          valor={percentual(r.taxaVitoria)}
          detalhe={decididas === 0 ? "Sem disputa decidida no período" : `${decididas} ${plural(decididas, "disputa decidida", "disputas decididas")}`}
        />
        <Numero rotulo="Valor ganho" valor={formatarMoedaCurta(r.valorGanho)} detalhe="Proposta, ou valor estimado do órgão" />
        <Numero rotulo="Receita mensal contratada" valor={formatarMoedaCurta(r.receitaMensal)} detalhe="Ganhas com medição mensal" />
        <Numero
          rotulo="Capital de giro comprometido"
          valor={formatarMoedaCurta(r.capitalComprometido)}
          detalhe={
            r.ganhasEmAndamento === 0
              ? "Nenhuma ganha em andamento hoje"
              : `Estimado em ${r.ganhasEmAndamento} ${plural(r.ganhasEmAndamento, "ganha em andamento", "ganhas em andamento")} hoje`
          }
        />
      </dl>

      {r.porMes.length > 1 ? (
        <section aria-labelledby="titulo-grafico" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
          <h2 id="titulo-grafico" className="text-base font-semibold text-ink">
            Valor ganho por mês
          </h2>
          <GraficoMeses meses={r.porMes} />
          <p className="sr-only">Total no período: {formatarMoeda(r.valorGanho)}</p>
        </section>
      ) : null}
    </>
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
  const bruto = Array.isArray(params.periodo) ? params.periodo[0] : params.periodo;
  const periodo: PeriodoResultados = ehPeriodo(Number(bruto)) ? (Number(bruto) as PeriodoResultados) : 3;

  let resultados: Resultados | null = null;
  try {
    const dados = await lerDadosResultados(sessao.empresaId);
    resultados = calcularResultados({ agora, periodo, ...dados });
  } catch (e) {
    console.error("[resultados] leitura falhou:", e instanceof Error ? e.message : e);
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Resultados</h1>
        <p className="text-sm text-muted-foreground">O que o pipeline já entregou.</p>
      </header>

      <nav aria-label="Período" className="flex w-full max-w-sm gap-1 rounded-control border border-border bg-raised p-1">
        {PERIODOS.map((p) => (
          <Link
            key={p}
            href={`/resultados?periodo=${p}`}
            aria-current={p === periodo ? "page" : undefined}
            className={cn(
              "flex h-11 flex-1 items-center justify-center rounded-control px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand",
              p === periodo ? "bg-active font-medium text-ink" : "text-muted-foreground hover:text-ink",
            )}
          >
            {ROTULO_PERIODO[p]}
          </Link>
        ))}
      </nav>

      {resultados ? (
        <Painel r={resultados} />
      ) : (
        <p role="alert" className="text-sm text-negative">
          Não foi possível carregar os resultados agora. Tente de novo em instantes.
        </p>
      )}
    </div>
  );
}
