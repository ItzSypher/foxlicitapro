import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { Deserta, SituacaoDeserta } from "@/core/desertas";
import { linkInternoDaOportunidade } from "@/core/link-oportunidade";
import { resumirObjeto } from "@/core/objeto";
import { formatarMoedaCurta, plural } from "@/lib/formato";
import { cn } from "@/lib/utils";

const data = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

const MOTIVO: Record<SituacaoDeserta, string> = {
  deserta: "Deserta",
  fracassada: "Fracassada",
  mista: "Deserta e fracassada",
};

const DICA_MOTIVO: Record<SituacaoDeserta, string> = {
  deserta: "Ninguém apresentou proposta",
  fracassada: "As propostas foram recusadas",
  mista: "Itens sem proposta e com propostas recusadas",
};

function dataCurta(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "Data não informada" : data.format(d);
}

function ItemDeserta({ d, indice }: { d: Deserta; indice: number }) {
  const link = linkInternoDaOportunidade({
    orgaoCnpj: d.orgaoCnpj,
    anoCompra: d.anoCompra,
    sequencialCompra: d.sequencialCompra,
    linkOrigem: null,
    linkPncp: d.linkPncp,
  });
  const itens = `${d.itensSemVencedor} de ${d.totalItens} ${plural(d.totalItens, "item", "itens")} sem vencedor`;
  const classeLink =
    "inline-flex min-h-11 items-center gap-1.5 rounded-control text-sm font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand";
  return (
    <li
      style={{ "--i": indice } as React.CSSProperties}
      className="card-entrada flex w-full flex-col gap-3 rounded-card bg-surface p-4 text-left"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-1">
          <span
            title={DICA_MOTIVO[d.situacao]}
            className={cn(
              "inline-flex w-fit max-w-full items-center rounded-full border border-border bg-raised px-2 py-0.5 text-[11px] leading-4 font-medium",
              d.situacao === "fracassada" ? "text-pill-warn-fg" : "text-muted-foreground",
            )}
          >
            {MOTIVO[d.situacao]}
          </span>
          <span className="text-xs text-muted-foreground">{dataCurta(d.desertaEm)}</span>
        </span>
        {d.valorEstimado === null ? (
          <span className="text-xl leading-tight font-medium text-muted-foreground">Sigiloso</span>
        ) : (
          <span className="text-xl leading-tight font-medium whitespace-nowrap tabular-nums text-ink">
            {formatarMoedaCurta(d.valorEstimado)}
          </span>
        )}
      </span>

      <p className="line-clamp-3 text-[15px] leading-snug font-medium wrap-break-word text-ink">{resumirObjeto(d.objeto)}</p>

      <p className="min-w-0 text-[13px] text-muted-foreground">
        <span className="wrap-break-word">{d.orgao}</span>
        <span className="block truncate">
          {d.municipio}/{d.uf} · {itens}
        </span>
      </p>

      {link ? (
        link.externo ? (
          <a href={link.href} target="_blank" rel="noopener noreferrer" className={cn(classeLink, "mt-auto w-fit")}>
            Abrir a licitação
            <ExternalLink aria-hidden="true" className="size-3.5" />
            <span className="sr-only">(abre em nova aba)</span>
          </a>
        ) : (
          <Link href={link.href} prefetch={false} className={cn(classeLink, "mt-auto w-fit")}>
            Ver a licitação
          </Link>
        )
      ) : null}
    </li>
  );
}

/** Dispensas sem vencedor das áreas da empresa: o órgão costuma abrir a mesma compra de novo. */
export function ListaDesertas({ itens, ocupado }: { itens: ReadonlyArray<Deserta>; ocupado: boolean }) {
  return (
    <ul
      aria-busy={ocupado}
      className={cn(
        "grid grid-cols-1 gap-3 transition-opacity duration-200 md:grid-cols-2 md:gap-4 xl:grid-cols-3",
        ocupado && "opacity-60",
      )}
    >
      {itens.map((d, indice) => (
        <ItemDeserta key={d.id} d={d} indice={indice} />
      ))}
    </ul>
  );
}
