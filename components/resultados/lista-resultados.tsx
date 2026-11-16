"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { ROTULO_REGIAO } from "@/components/pipeline/tipos";
import { FormularioFechamento } from "@/components/resultados/formulario-fechamento";
import { ROTULO_MOTIVO } from "@/core/fechamento";
import { ROTULO_ETAPA_RESULTADO, ROTULO_FRENTE, formatarDia, type EtapaResultado, type LinhaResultado } from "@/core/resultados";
import { formatarMoedaCurta, formatarPercentual, plural } from "@/lib/formato";
import { cn } from "@/lib/utils";

const PILULA: Record<EtapaResultado, string> = {
  ganha: "bg-pill-pos-bg text-pill-pos-fg",
  perdida: "bg-pill-neg-bg text-pill-neg-fg",
  disputa: "bg-pill-neutral-bg text-pill-neutral-fg",
};

function Pilula({ etapa }: { etapa: EtapaResultado }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap", PILULA[etapa])}>
      {ROTULO_ETAPA_RESULTADO[etapa]}
    </span>
  );
}

function origemDoValor(l: LinhaResultado): string {
  if (l.etapa === "ganha" && l.valorHomologado !== null) return "Homologado";
  if (l.valorProposto !== null) return "Proposta";
  return "Estimado";
}

function Lucro({ l }: { l: LinhaResultado }) {
  if (l.etapa !== "ganha") return <span className="text-muted-foreground">—</span>;
  if (l.lucro === null) return <span className="text-muted-foreground">Sem custo</span>;
  return (
    <span className={cn("tabular-nums", l.lucro < 0 ? "text-negative" : "text-positive")}>
      {formatarMoedaCurta(l.lucro)}
      {l.margem === null ? null : <span className="block text-xs">{formatarPercentual(l.margem)}</span>}
    </span>
  );
}

function podeFechar(l: LinhaResultado): l is LinhaResultado & { etapa: "ganha" | "perdida" } {
  return l.etapa === "ganha" || l.etapa === "perdida";
}

function Edicao({ l, aoConcluir }: { l: LinhaResultado & { etapa: "ganha" | "perdida" }; aoConcluir: () => void }) {
  return (
    <FormularioFechamento
      itemId={l.id}
      etapa={l.etapa}
      valorInicial={l.valor}
      custoInicial={l.custo}
      motivoInicial={l.motivoPerda}
      rotuloSaida="Cancelar"
      aoConcluir={() => aoConcluir()}
    />
  );
}

function BotaoEditar({ aberto, aoAlternar, titulo }: { aberto: boolean; aoAlternar: () => void; titulo: string }) {
  return (
    <button
      type="button"
      onClick={aoAlternar}
      aria-expanded={aberto}
      aria-label={`Editar fechamento: ${titulo}`}
      className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-control border border-control bg-raised px-3 text-sm text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand lg:h-9"
    >
      <Pencil aria-hidden="true" className="size-4" />
      Editar
    </button>
  );
}

function Titulo({ l }: { l: LinhaResultado }) {
  return (
    <>
      <span className="line-clamp-2 text-sm text-ink" title={l.objeto}>
        {l.objeto === "" ? "Objeto não informado" : l.objeto}
      </span>
      <span className="line-clamp-1 text-xs text-muted-foreground">{l.orgao}</span>
    </>
  );
}

/**
 * Lista de licitações do período: tabela no computador, cartões no celular.
 * Quem pode editar corrige valor homologado, custo e motivo ali mesmo, abaixo da linha.
 */
export function ListaResultados({ linhas, podeEditar }: { linhas: ReadonlyArray<LinhaResultado>; podeEditar: boolean }) {
  const [editando, setEditando] = useState<string | null>(null);
  const alternar = (id: string) => setEditando((atual) => (atual === id ? null : id));

  if (linhas.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-control px-4 py-8 text-center text-sm text-muted-foreground">
        Nenhuma licitação com esses filtros neste período.
      </p>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-[13px] text-muted-foreground">
        {linhas.length} {plural(linhas.length, "licitação", "licitações")}. As em disputa aparecem sempre, porque ainda não têm desfecho.
      </p>

      <ul className="flex min-w-0 flex-col gap-3 md:hidden">
        {linhas.map((l) => (
          <li key={l.id} className="flex min-w-0 flex-col gap-3 rounded-card border border-border bg-surface p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <Titulo l={l} />
              </div>
              <Pilula etapa={l.etapa} />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatarDia(l.data)} · {ROTULO_REGIAO[l.regiao]} · {ROTULO_FRENTE[l.frente ?? "sem-frente"]}
              {l.responsavelNome ? ` · ${l.responsavelNome}` : ""}
              {l.motivoPerda ? ` · ${ROTULO_MOTIVO[l.motivoPerda]}` : ""}
            </p>
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <div className="flex min-w-0 flex-col">
                <dt className="text-xs text-muted-foreground">Valor</dt>
                <dd className="tabular-nums text-ink">{l.valor === null ? "—" : formatarMoedaCurta(l.valor)}</dd>
                <dd className="text-xs text-muted-foreground">{origemDoValor(l)}</dd>
              </div>
              <div className="flex min-w-0 flex-col">
                <dt className="text-xs text-muted-foreground">Custo</dt>
                <dd className="tabular-nums text-ink">{l.custo === null ? "—" : formatarMoedaCurta(l.custo)}</dd>
              </div>
              <div className="flex min-w-0 flex-col">
                <dt className="text-xs text-muted-foreground">Lucro</dt>
                <dd>
                  <Lucro l={l} />
                </dd>
              </div>
            </dl>
            {podeEditar && podeFechar(l) ? (
              <>
                <BotaoEditar aberto={editando === l.id} aoAlternar={() => alternar(l.id)} titulo={l.objeto} />
                {editando === l.id ? (
                  <div className="border-t border-border pt-3">
                    <Edicao l={l} aoConcluir={() => setEditando(null)} />
                  </div>
                ) : null}
              </>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="hidden min-w-0 overflow-x-auto rounded-card border border-border bg-surface md:block">
        <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
          <caption className="sr-only">Licitações do período</caption>
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th scope="col" className="px-3 py-2.5 font-medium">Data</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Situação</th>
              <th scope="col" className="w-[28%] px-3 py-2.5 font-medium">Licitação</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Região e frente</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Responsável</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Valor</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Custo</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Lucro</th>
              {podeEditar ? <th scope="col" className="px-3 py-2.5"><span className="sr-only">Ações</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <LinhaTabela
                key={l.id}
                l={l}
                podeEditar={podeEditar}
                editando={editando === l.id}
                aoAlternar={() => alternar(l.id)}
                aoConcluir={() => setEditando(null)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LinhaTabela({
  l,
  podeEditar,
  editando,
  aoAlternar,
  aoConcluir,
}: {
  l: LinhaResultado;
  podeEditar: boolean;
  editando: boolean;
  aoAlternar: () => void;
  aoConcluir: () => void;
}) {
  const colunas = podeEditar ? 9 : 8;
  return (
    <>
      <tr className="border-b border-border align-top last:border-b-0">
        <td className="px-3 py-3 whitespace-nowrap tabular-nums text-ink">{formatarDia(l.data)}</td>
        <td className="px-3 py-3">
          <div className="flex flex-col items-start gap-1">
            <Pilula etapa={l.etapa} />
            {l.motivoPerda ? <span className="text-xs text-muted-foreground">{ROTULO_MOTIVO[l.motivoPerda]}</span> : null}
          </div>
        </td>
        <td className="px-3 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Titulo l={l} />
          </div>
        </td>
        <td className="px-3 py-3 text-ink">
          {ROTULO_REGIAO[l.regiao]}
          <span className="block text-xs text-muted-foreground">{ROTULO_FRENTE[l.frente ?? "sem-frente"]}</span>
        </td>
        <td className="px-3 py-3 text-ink">{l.responsavelNome ?? <span className="text-muted-foreground">—</span>}</td>
        <td className="px-3 py-3 text-right tabular-nums text-ink">
          {l.valor === null ? "—" : formatarMoedaCurta(l.valor)}
          <span className="block text-xs text-muted-foreground">{origemDoValor(l)}</span>
        </td>
        <td className="px-3 py-3 text-right tabular-nums text-ink">{l.custo === null ? "—" : formatarMoedaCurta(l.custo)}</td>
        <td className="px-3 py-3 text-right">
          <Lucro l={l} />
        </td>
        {podeEditar ? (
          <td className="px-3 py-2.5 text-right">
            {podeFechar(l) ? <BotaoEditar aberto={editando} aoAlternar={aoAlternar} titulo={l.objeto} /> : null}
          </td>
        ) : null}
      </tr>
      {editando && podeFechar(l) ? (
        <tr className="border-b border-border bg-raised last:border-b-0">
          <td colSpan={colunas} className="px-3 py-4">
            <div className="max-w-xl">
              <Edicao l={l} aoConcluir={aoConcluir} />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
