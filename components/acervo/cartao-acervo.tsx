import { Download, FileText } from "lucide-react";
import {
  ROTULO_CURTO_TIPO_ACERVO,
  formatarDataIso,
  rotuloArea,
  situacaoValidade,
  textoPeriodo,
  type DocumentoAcervo,
  type EstadoValidade,
} from "@/core/acervo";
import { formatarCnpj } from "@/core/brasilapi";
import { formatarMoeda } from "@/lib/formato";
import { AcoesDocumentoAcervo } from "./acoes-acervo";

const CLASSE_SELO: Record<Exclude<EstadoValidade, "sem_validade">, string> = {
  vencida: "bg-pill-neg-bg text-pill-neg-fg",
  vencendo: "bg-pill-warn-bg text-pill-warn-fg",
  valida: "bg-pill-pos-bg text-pill-pos-fg",
};

const PILULA = "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium";

/** Cartão de um documento do acervo: tipo, título, emissor, período, valor, áreas, selo de validade e ações. */
export function CartaoAcervo({ documento: d, agora, podeEditar }: { documento: DocumentoAcervo; agora: number; podeEditar: boolean }) {
  const validade = situacaoValidade(d.validade, agora);
  const periodo = textoPeriodo(d.periodoInicio, d.periodoFim);
  const detalhes = [
    d.emissor !== "" ? d.emissor + (d.emissorCnpj ? ` (${formatarCnpj(d.emissorCnpj)})` : "") : "",
    periodo,
    d.valor !== null ? formatarMoeda(d.valor) : "",
    d.emitidoEm ? `emitido em ${formatarDataIso(d.emitidoEm)}` : "",
  ].filter((t) => t !== "");

  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${PILULA} bg-pill-neutral-bg text-pill-neutral-fg`}>{ROTULO_CURTO_TIPO_ACERVO[d.tipo]}</span>
        {validade.estado === "sem_validade" ? null : (
          <span className={`${PILULA} ${CLASSE_SELO[validade.estado]}`}>
            {validade.estado === "valida" ? `Válida até ${formatarDataIso(d.validade)}` : validade.rotulo}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-base font-semibold leading-snug break-words text-ink">{d.titulo}</h2>
        {detalhes.length > 0 ? <p className="text-[13px] leading-snug break-words text-muted-foreground">{detalhes.join(" · ")}</p> : null}
        {d.descricao !== "" ? <p className="line-clamp-3 text-sm leading-snug break-words text-muted-foreground">{d.descricao}</p> : null}
      </div>

      {d.areas.length > 0 ? (
        <ul aria-label="Áreas" className="flex flex-wrap gap-1.5">
          {d.areas.map((a) => (
            <li key={a} className="rounded-full bg-raised px-2.5 py-0.5 text-xs text-muted-foreground ring-1 ring-inset ring-border">
              {rotuloArea(a)}
            </li>
          ))}
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
            <span className="min-w-0 truncate">Abrir {d.arquivoNome}</span>
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
