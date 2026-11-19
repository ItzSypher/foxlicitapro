import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { linkInternoDaOportunidade } from "@/core/link-oportunidade";
import { resumirObjeto } from "@/core/objeto";
import type { Semelhante } from "@/core/semelhantes";
import { formatarMoedaCurta } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Secao } from "./secao";

const data = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

function dataCurta(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "data não informada" : data.format(d);
}

const CLASSE_LINK =
  "inline-flex min-h-11 items-center gap-1.5 rounded-control text-[15px] leading-snug font-medium wrap-break-word text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand";

/** Compras abertas de objeto parecido, em outros órgãos, para reaproveitar a proposta. */
export function Semelhantes({ itens }: { itens: ReadonlyArray<Semelhante> }) {
  return (
    <Secao id="semelhantes" titulo="Semelhantes" detalhe="Objeto parecido, em outros órgãos">
      {itens.length === 0 ? (
        <p className="rounded-card border border-dashed border-control px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhuma compra parecida aberta no Radar agora.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
          {itens.map(({ oportunidade: o }) => {
            const link = linkInternoDaOportunidade(o);
            const titulo = resumirObjeto(o.objeto) || "Contratação sem objeto informado";
            return (
              <li key={o.id} className="flex min-w-0 flex-col gap-1 px-4 py-3">
                {link === null ? (
                  <span className="text-[15px] leading-snug font-medium wrap-break-word text-ink">{titulo}</span>
                ) : link.externo ? (
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className={cn(CLASSE_LINK, "line-clamp-2")}>
                    {titulo}
                    <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
                    <span className="sr-only">(abre em nova aba)</span>
                  </a>
                ) : (
                  <Link href={link.href} prefetch={false} className={cn(CLASSE_LINK, "line-clamp-2")}>
                    {titulo}
                  </Link>
                )}
                <p className="text-[13px] text-muted-foreground">
                  <span className="wrap-break-word">{o.orgao}</span> · {o.municipio}/{o.uf}
                </p>
                <p className="text-[13px] tabular-nums text-muted-foreground">
                  {o.valorEstimado === null ? "Valor sigiloso" : formatarMoedaCurta(o.valorEstimado)} · encerra em {dataCurta(o.dataEncerramento)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Secao>
  );
}
