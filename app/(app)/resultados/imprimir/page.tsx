import { connection } from "next/server";
import { BarraImprimir } from "@/components/propostas/barra-imprimir";
import { ROTULO_REGIAO } from "@/components/pipeline/tipos";
import { ROTULO_MOTIVO } from "@/core/fechamento";
import { nomeExibicao } from "@/core/perfil";
import { temPermissao } from "@/core/permissoes";
import {
  ROTULO_ETAPA_RESULTADO,
  ROTULO_FRENTE,
  consultaResultados,
  formatarDia,
  rotuloPeriodo,
  tituloRelatorio,
  type FiltrosResultados,
  type QuebraResultado,
  type Resultados,
} from "@/core/resultados";
import { perfilAtual } from "@/lib/empresa-atual";
import { formatarMoeda, formatarPercentual, plural } from "@/lib/formato";
import { montarRelatorio, type Relatorio } from "@/lib/resultados-relatorio";
import { exigirSessao } from "@/lib/sessao";

export const metadata = { title: "Relatório de resultados" };

const ROTULO_ETAPA_FILTRO = { todas: "Todas", ...ROTULO_ETAPA_RESULTADO } as const;

function descreverFiltros(f: FiltrosResultados, pessoas: Relatorio["pessoas"]): string {
  const partes = [`Situação: ${ROTULO_ETAPA_FILTRO[f.etapa]}`];
  if (f.regiao !== "todas") partes.push(`Região: ${ROTULO_REGIAO[f.regiao]}`);
  if (f.frente !== "todas") partes.push(`Frente: ${ROTULO_FRENTE[f.frente]}`);
  if (f.responsavel === "sem") partes.push("Responsável: sem responsável");
  else if (f.responsavel !== "todos") partes.push(`Responsável: ${pessoas.find((p) => p.id === f.responsavel)?.nome ?? "pessoa da equipe"}`);
  return partes.join(" · ");
}

function Indicador({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="break-inside-avoid rounded border border-neutral-300 p-2.5">
      <dt className="text-[11px] text-neutral-600">{rotulo}</dt>
      <dd className="text-base font-semibold tabular-nums">{valor}</dd>
    </div>
  );
}

function Quebra({ titulo, itens }: { titulo: string; itens: ReadonlyArray<QuebraResultado> }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="mb-1 text-sm font-semibold">{titulo}</h2>
      {itens.length === 0 ? (
        <p className="text-[11px] text-neutral-600">Nenhuma licitação decidida no período.</p>
      ) : (
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-neutral-400 text-left text-neutral-600">
              <th scope="col" className="py-1 pr-2 font-medium">{titulo.replace("Por ", "")}</th>
              <th scope="col" className="px-2 py-1 text-right font-medium">Ganhas</th>
              <th scope="col" className="px-2 py-1 text-right font-medium">Perdidas</th>
              <th scope="col" className="px-2 py-1 text-right font-medium">Valor ganho</th>
              <th scope="col" className="py-1 pl-2 text-right font-medium">Lucro</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((q) => (
              <tr key={q.chave} className="border-b border-neutral-200">
                <td className="py-1 pr-2">{q.rotulo}</td>
                <td className="px-2 py-1 text-right tabular-nums">{q.ganhas}</td>
                <td className="px-2 py-1 text-right tabular-nums">{q.perdidas}</td>
                <td className="px-2 py-1 text-right tabular-nums">{formatarMoeda(q.valorGanho)}</td>
                <td className="py-1 pl-2 text-right tabular-nums">{q.lucro === 0 ? "—" : formatarMoeda(q.lucro)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Resumo({ r }: { r: Resultados }) {
  const temCusto = r.ganhas > r.ganhasSemCusto;
  return (
    <>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Indicador rotulo="Valor ganho" valor={formatarMoeda(r.valorGanho)} />
        <Indicador rotulo="Custo total" valor={temCusto ? formatarMoeda(r.custoTotal) : "—"} />
        <Indicador rotulo="Lucro total" valor={temCusto ? formatarMoeda(r.lucroTotal) : "—"} />
        <Indicador
          rotulo="Margem média (ponderada)"
          valor={r.margemMedia === null ? "—" : formatarPercentual(r.margemMedia)}
        />
        <Indicador rotulo="Ganhas" valor={String(r.ganhas)} />
        <Indicador rotulo="Perdidas" valor={String(r.perdidas)} />
        <Indicador rotulo="Taxa de vitória" valor={r.taxaVitoria === null ? "—" : `${Math.round(r.taxaVitoria * 100)}%`} />
        <Indicador rotulo="Ticket médio" valor={r.ticketMedio === null ? "—" : formatarMoeda(r.ticketMedio)} />
      </dl>
      {r.margemMediaSimples !== null ? (
        <p className="text-[11px] text-neutral-600">Margem média simples: {formatarPercentual(r.margemMediaSimples)}.</p>
      ) : null}
      {r.ganhasSemCusto > 0 ? (
        <p className="text-[11px] text-neutral-600">
          {r.ganhasSemCusto} {plural(r.ganhasSemCusto, "ganha sem custo informado", "ganhas sem custo informado")}: entram no valor, mas ficam
          fora do lucro e da margem.
        </p>
      ) : null}
    </>
  );
}

export default async function ImprimirResultadosPage({
  searchParams,
}: {
  searchParams: Promise<{ [chave: string]: string | string[] | undefined }>;
}) {
  await connection();
  const sessao = await exigirSessao();
  if (!temPermissao(sessao, "aprovar_propostas")) {
    return (
      <div className="flex max-w-md flex-col gap-1">
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Relatório de resultados</h1>
        <p className="text-sm text-muted-foreground">Só o dono e quem aprova propostas veem os resultados.</p>
      </div>
    );
  }

  const agora = new Date();
  const params = await searchParams;
  let relatorio: Relatorio | null = null;
  try {
    relatorio = await montarRelatorio(sessao.empresaId, params, agora);
  } catch (e) {
    console.error("[resultados] impressão falhou:", e instanceof Error ? e.message : e);
  }
  if (!relatorio) {
    return (
      <p role="alert" className="text-sm text-negative">
        Não foi possível carregar o relatório agora. Tente de novo em instantes.
      </p>
    );
  }

  const perfil = await perfilAtual();
  const { periodo, filtros, resultados: r, linhas, pessoas } = relatorio;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <BarraImprimir
        voltarPara={`/resultados${consultaResultados(periodo, filtros)}`}
        rotuloVoltar="Voltar aos resultados"
      />
      <article className="doc-folha mx-auto flex w-full max-w-[1100px] min-w-0 flex-col gap-4 bg-white p-4 text-[12px] text-black sm:p-8">
        <header className="flex flex-col gap-1 border-b border-neutral-400 pb-3">
          <p className="text-[11px] font-medium tracking-[0.08em] text-neutral-600 uppercase">{nomeExibicao(perfil)}</p>
          <h1 className="text-xl font-semibold leading-tight">{tituloRelatorio(periodo, agora)}</h1>
          <p className="text-[11px] text-neutral-600">
            Período: {rotuloPeriodo(periodo, agora)} · {descreverFiltros(filtros, pessoas)} · Emitido em {formatarDia(agora.toISOString())}
          </p>
        </header>

        <Resumo r={r} />

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <Quebra titulo="Por região" itens={r.porRegiao} />
          <Quebra titulo="Por frente" itens={r.porFrente} />
        </div>

        <section className="break-inside-avoid">
          <h2 className="mb-1 text-sm font-semibold">Motivos de perda</h2>
          {r.motivosPerda.length === 0 ? (
            <p className="text-[11px] text-neutral-600">Nenhuma licitação perdida no período.</p>
          ) : (
            <p className="text-[11px]">
              {r.motivosPerda.map((m) => `${m.rotulo}: ${m.quantidade}`).join(" · ")}
            </p>
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-1">
          <h2 className="text-sm font-semibold">
            Licitações ({linhas.length})
          </h2>
          <div className="min-w-0 overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[44rem] border-collapse text-[10px] leading-tight">
              <thead>
                <tr className="border-b border-neutral-400 text-left text-neutral-600">
                  <th scope="col" className="py-1 pr-2 font-medium">Data</th>
                  <th scope="col" className="px-2 py-1 font-medium">Situação</th>
                  <th scope="col" className="px-2 py-1 font-medium">Licitação</th>
                  <th scope="col" className="px-2 py-1 font-medium">Região e frente</th>
                  <th scope="col" className="px-2 py-1 font-medium">Responsável</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Valor</th>
                  <th scope="col" className="px-2 py-1 text-right font-medium">Custo</th>
                  <th scope="col" className="py-1 pl-2 text-right font-medium">Lucro</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id} className="break-inside-avoid border-b border-neutral-200 align-top">
                    <td className="py-1 pr-2 whitespace-nowrap tabular-nums">{formatarDia(l.data)}</td>
                    <td className="px-2 py-1">
                      {ROTULO_ETAPA_RESULTADO[l.etapa]}
                      {l.motivoPerda ? <span className="block text-neutral-600">{ROTULO_MOTIVO[l.motivoPerda]}</span> : null}
                    </td>
                    <td className="px-2 py-1">
                      {l.objeto}
                      <span className="block text-neutral-600">{l.orgao}</span>
                    </td>
                    <td className="px-2 py-1">
                      {ROTULO_REGIAO[l.regiao]}
                      <span className="block text-neutral-600">{ROTULO_FRENTE[l.frente ?? "sem-frente"]}</span>
                    </td>
                    <td className="px-2 py-1">{l.responsavelNome ?? "—"}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{l.valor === null ? "—" : formatarMoeda(l.valor)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{l.custo === null ? "—" : formatarMoeda(l.custo)}</td>
                    <td className="py-1 pl-2 text-right tabular-nums">
                      {l.lucro === null ? (l.etapa === "ganha" ? "Sem custo" : "—") : formatarMoeda(l.lucro)}
                      {l.margem === null ? null : <span className="block text-neutral-600">{formatarPercentual(l.margem)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {linhas.length === 0 ? <p className="text-[11px] text-neutral-600">Nenhuma licitação com esses filtros neste período.</p> : null}
        </section>
      </article>
    </div>
  );
}
