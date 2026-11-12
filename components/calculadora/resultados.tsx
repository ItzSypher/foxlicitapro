import { Check, Info, X } from "lucide-react";
import type { DetalhePreco } from "@/core/precificacao";
import { formatarMoeda } from "@/lib/formato";
import { cn } from "@/lib/utils";
import type { EstadoCalculo } from "./estado";
import { BarraLances } from "./barra-lances";
import { formatarPercentual } from "./texto";

const TRACO = "—";

function Linha({ detalhe }: { detalhe: DetalhePreco | null }) {
  return (
    <p className="text-[13px] text-muted-foreground">
      Lucro líquido{" "}
      <span className="font-mono tabular-nums text-ink">{detalhe ? formatarMoeda(detalhe.lucroLiquido) : TRACO}</span>
      {" · "}
      Margem{" "}
      <span className="font-mono tabular-nums text-ink">{detalhe ? formatarPercentual(detalhe.margemEfetiva) : TRACO}</span>
    </p>
  );
}

function Bloco({
  titulo,
  detalhe,
  tamanho,
  nota,
}: {
  titulo: string;
  detalhe: DetalhePreco | null;
  tamanho: "grande" | "medio";
  nota: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-[13px] font-medium text-muted-foreground">{titulo}</h2>
      <p
        className={cn(
          "font-mono font-semibold tabular-nums leading-none",
          tamanho === "grande" ? "text-[32px]" : "text-[22px]",
          detalhe ? "text-ink" : "text-faint",
        )}
      >
        {detalhe ? formatarMoeda(detalhe.preco) : TRACO}
      </p>
      <p className="text-[13px] text-muted-foreground">{nota}</p>
      <Linha detalhe={detalhe} />
    </div>
  );
}

function Selo({ estado }: { estado: EstadoCalculo }) {
  const base = "inline-flex min-h-8 items-center gap-2 rounded-control px-3 py-1.5 text-[13px] font-medium";
  if (estado.tipo !== "ok" || estado.calculo.folga === null || estado.calculo.folgaPercentual === null) {
    return (
      <p className={cn(base, "bg-pill-neutral-bg text-pill-neutral-fg")}>
        <Info className="size-4 shrink-0" aria-hidden />
        Informe o teto para comparar
      </p>
    );
  }
  const { folga, folgaPercentual, viavel } = estado.calculo;
  if (viavel) {
    return (
      <p className={cn(base, "bg-pill-pos-bg text-pill-pos-fg")}>
        <Check className="size-4 shrink-0" aria-hidden />
        <span>
          Cabe no teto · folga <span className="font-mono tabular-nums">{formatarMoeda(folga)}</span> (
          <span className="font-mono tabular-nums">{formatarPercentual(folgaPercentual)}</span>)
        </span>
      </p>
    );
  }
  return (
    <p className={cn(base, "bg-pill-neg-bg text-pill-neg-fg")}>
      <X className="size-4 shrink-0" aria-hidden />
      <span>
        Não cabe: mínimo passa do teto em <span className="font-mono tabular-nums">{formatarMoeda(-folga)}</span>
      </span>
    </p>
  );
}

export function Resultados({ estado }: { estado: EstadoCalculo }) {
  const calculo = estado.tipo === "ok" ? estado.calculo : null;
  const temTeto = calculo !== null && estado.tipo === "ok" && estado.entrada.tetoOrgao !== null;

  return (
    <section
      aria-label="Resultado"
      aria-live="polite"
      className="@container flex flex-col gap-5 rounded-card border border-border bg-surface p-4"
    >
      <Bloco
        titulo="Preço mínimo"
        detalhe={calculo?.precoMinimo ?? null}
        tamanho="grande"
        nota="Abaixo disso você paga para trabalhar."
      />
      <div className="grid gap-5 border-t border-border pt-5 @sm:grid-cols-2">
        <Bloco titulo="Preço alvo" detalhe={calculo?.precoAlvo ?? null} tamanho="medio" nota="O que vale buscar." />
        <Bloco
          titulo="Preço de cadastro"
          detalhe={calculo?.precoCadastro ?? null}
          tamanho="medio"
          nota={temTeto ? "Igual ao teto do órgão." : "Sem teto: igual ao preço alvo."}
        />
      </div>
      <Selo estado={estado} />
      {calculo ? (
        <BarraLances
          minimo={calculo.precoMinimo.preco}
          alvo={calculo.precoAlvo.preco}
          teto={estado.tipo === "ok" ? estado.entrada.tetoOrgao : null}
        />
      ) : (
        <div aria-hidden className="h-3 rounded-control bg-raised" />
      )}
    </section>
  );
}
