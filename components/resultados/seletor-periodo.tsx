import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  consultaResultados,
  deslocarPeriodo,
  rotuloPeriodo,
  type FiltrosResultados,
  type PeriodoResultados,
} from "@/core/resultados";
import { diaDeSaoPaulo } from "@/core/avisos";
import { cn } from "@/lib/utils";

const FOCO = "outline-none focus-visible:ring-2 focus-visible:ring-brand";

function Seta({ href, rotulo, lado }: { href: string | null; rotulo: string; lado: "esquerda" | "direita" }) {
  const Icone = lado === "esquerda" ? ChevronLeft : ChevronRight;
  const classe = "inline-flex size-11 shrink-0 items-center justify-center rounded-control border border-control bg-surface text-ink";
  if (href === null) {
    return (
      <span aria-disabled="true" className={cn(classe, "opacity-40")}>
        <Icone aria-hidden="true" className="size-5" />
        <span className="sr-only">{rotulo} (indisponível)</span>
      </span>
    );
  }
  return (
    <Link href={href} replace scroll={false} className={cn(classe, "hover:bg-active", FOCO)}>
      <Icone aria-hidden="true" className="size-5" />
      <span className="sr-only">{rotulo}</span>
    </Link>
  );
}

/** Mês, 3 meses, 12 meses ou ano; nos dois extremos, setas para andar de um em um. Tudo vira parâmetro da URL. */
export function SeletorPeriodo({ periodo, filtros, agora }: { periodo: PeriodoResultados; filtros: FiltrosResultados; agora: Date }) {
  const mesAtual = diaDeSaoPaulo(agora).slice(0, 7);
  const abas: ReadonlyArray<{ rotulo: string; alvo: PeriodoResultados; ativa: boolean }> = [
    { rotulo: "Mês", alvo: { tipo: "mes", mes: periodo.tipo === "mes" ? periodo.mes : mesAtual }, ativa: periodo.tipo === "mes" },
    { rotulo: "3 meses", alvo: { tipo: "ultimos", meses: 3 }, ativa: periodo.tipo === "ultimos" && periodo.meses === 3 },
    { rotulo: "12 meses", alvo: { tipo: "ultimos", meses: 12 }, ativa: periodo.tipo === "ultimos" && periodo.meses === 12 },
    { rotulo: "Ano", alvo: { tipo: "ano", ano: periodo.tipo === "ano" ? periodo.ano : Number(mesAtual.slice(0, 4)) }, ativa: periodo.tipo === "ano" },
  ];
  const anterior = deslocarPeriodo(periodo, -1, agora);
  const seguinte = deslocarPeriodo(periodo, 1, agora);
  const comSetas = periodo.tipo === "mes" || periodo.tipo === "ano";
  const href = (alvo: PeriodoResultados) => `/resultados${consultaResultados(alvo, filtros)}`;

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <nav aria-label="Período" className="flex w-full gap-1 rounded-control border border-border bg-raised p-1 sm:max-w-md">
        {abas.map((a) => (
          <Link
            key={a.rotulo}
            href={href(a.alvo)}
            replace
            scroll={false}
            aria-current={a.ativa ? "page" : undefined}
            className={cn(
              "flex h-11 min-w-0 flex-1 items-center justify-center rounded-control px-2 text-sm whitespace-nowrap",
              FOCO,
              a.ativa ? "bg-active font-medium text-ink" : "text-muted-foreground hover:text-ink",
            )}
          >
            {a.rotulo}
          </Link>
        ))}
      </nav>
      {comSetas ? (
        <div className="flex items-center gap-2">
          <Seta href={anterior === null ? null : href(anterior)} rotulo={periodo.tipo === "mes" ? "Mês anterior" : "Ano anterior"} lado="esquerda" />
          <p aria-live="polite" className="min-w-[9.5rem] text-center text-sm font-medium text-ink capitalize">
            {rotuloPeriodo(periodo, agora)}
          </p>
          <Seta href={seguinte === null ? null : href(seguinte)} rotulo={periodo.tipo === "mes" ? "Próximo mês" : "Próximo ano"} lado="direita" />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{rotuloPeriodo(periodo, agora)}</p>
      )}
    </div>
  );
}
