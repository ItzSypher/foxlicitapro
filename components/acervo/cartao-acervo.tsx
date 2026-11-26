import { Check, Download, FileText, TriangleAlert } from "lucide-react";
import {
  ROTULO_CURTO_TIPO_ACERVO,
  formatarDataIso,
  rotuloArea,
  situacaoValidade,
  textoPeriodo,
  type DocumentoAcervo,
  type EstadoValidade,
} from "@/core/acervo";
import { formatarMoeda } from "@/lib/formato";
import { AcoesDocumentoAcervo } from "./acoes-acervo";

const CLASSE_SELO: Record<Exclude<EstadoValidade, "sem_validade">, string> = {
  vencida: "bg-pill-neg-bg text-pill-neg-fg",
  vencendo: "bg-pill-warn-bg text-pill-warn-fg",
  valida: "bg-pill-pos-bg text-pill-pos-fg",
};

const MAX_AREAS = 3;

const PILULA = "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium";

/** Cartão de um documento do acervo: selos de tipo e validade, título, quem emitiu com o valor, até 3 áreas e ações. */
export function CartaoAcervo({ documento: d, agora, podeEditar }: { documento: DocumentoAcervo; agora: number; podeEditar: boolean }) {
  const validade = situacaoValidade(d.validade, agora);
  const periodo = textoPeriodo(d.periodoInicio, d.periodoFim);
  const quem = [d.emissor, periodo].filter((t) => t !== "").join(" · ");
  const areas = d.areas.slice(0, MAX_AREAS);
  const restantes = d.areas.length - areas.length;
  const IconeValidade = validade.estado === "valida" ? Check : TriangleAlert;

  return (
    <li className="flex min-w-0 flex-col gap-2.5 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${PILULA} bg-pill-neutral-bg text-pill-neutral-fg`}>{ROTULO_CURTO_TIPO_ACERVO[d.tipo]}</span>
        {validade.estado === "sem_validade" ? null : (
          <span className={`${PILULA} gap-1 ${CLASSE_SELO[validade.estado]}`}>
            <IconeValidade aria-hidden="true" className="size-3.5" />
            {validade.estado === "valida" ? `Até ${formatarDataIso(d.validade)}` : validade.rotulo}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="text-base font-semibold leading-snug break-words text-ink">{d.titulo}</h2>
        {quem !== "" || d.valor !== null ? (
          <p className="flex min-w-0 items-baseline gap-2 text-[13px] leading-snug text-muted-foreground">
            {d.valor !== null ? <span className="shrink-0 font-medium tabular-nums text-ink">{formatarMoeda(d.valor)}</span> : null}
            {quem !== "" ? <span className="truncate">{quem}</span> : null}
          </p>
        ) : null}
      </div>

      {areas.length > 0 ? (
        <ul aria-label="Áreas" className="flex flex-wrap gap-1.5">
          {areas.map((a) => (
            <li key={a} className="rounded-full bg-raised px-2.5 py-0.5 text-xs text-muted-foreground ring-1 ring-inset ring-border">
              {rotuloArea(a)}
            </li>
          ))}
          {restantes > 0 ? <li className="px-1 py-0.5 text-xs text-faint">+{restantes}</li> : null}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border pt-2">
        {d.arquivoNome !== null ? (
          <a
            href={`/acervo/${d.id}/arquivo`}
            target="_blank"
            rel="noopener"
            className="inline-flex h-10 min-w-0 items-center gap-2 rounded-control text-sm text-ink underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Download aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 truncate">Abrir arquivo</span>
          </a>
        ) : (
          <span className="inline-flex h-10 items-center gap-2 text-sm text-faint">
            <FileText aria-hidden="true" className="size-4" />
            Sem arquivo
          </span>
        )}
        {podeEditar ? <AcoesDocumentoAcervo documento={d} /> : null}
      </div>
    </li>
  );
}
