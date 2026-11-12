import type { CotacaoSalva } from "@/db/cotacoes";
import { formatarMoeda } from "@/lib/formato";
import { cn } from "@/lib/utils";

const data = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
});

function dia(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "--/--" : data.format(d);
}

interface Props {
  cotacoes: CotacaoSalva[];
  ativa: string | null;
  deOportunidade: boolean;
  onEscolher: (cotacao: CotacaoSalva) => void;
}

export function CotacoesSalvas({ cotacoes, ativa, deOportunidade, onEscolher }: Props) {
  return (
    <section aria-labelledby="titulo-cotacoes" className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h2 id="titulo-cotacoes" className="text-base font-semibold text-ink">
          Cotações salvas
        </h2>
        <p className="text-[13px] text-muted-foreground">
          {deOportunidade ? "Desta oportunidade. Toque numa para recarregar os valores." : "As 10 últimas. Toque numa para recarregar os valores."}
        </p>
      </div>

      {cotacoes.length === 0 ? (
        <p className="rounded-card border border-border px-4 py-5 text-sm text-muted-foreground">
          Nenhuma cotação salva ainda.
        </p>
      ) : (
        <div className="overflow-hidden rounded-card border border-border">
          <div className="hidden grid-cols-[48px_1fr_112px_112px] gap-x-3 border-b border-border px-3 py-2 text-xs text-muted-foreground sm:grid">
            <span>Data</span>
            <span>Descrição</span>
            <span className="text-right">Mínimo</span>
            <span className="text-right">Alvo</span>
          </div>
          <ul className="divide-y divide-border">
            {cotacoes.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onEscolher(c)}
                  aria-pressed={ativa === c.id}
                  className={cn(
                    "grid min-h-11 w-full grid-cols-[1fr_auto_auto] items-baseline gap-x-3 gap-y-1 px-3 py-2.5 text-left outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand sm:grid-cols-[48px_1fr_112px_112px]",
                    ativa === c.id && "bg-active",
                  )}
                >
                  <span className="col-start-3 row-start-1 text-right font-mono text-xs tabular-nums text-faint sm:col-start-1 sm:text-left">
                    {dia(c.criadoEm)}
                  </span>
                  <span className="col-span-2 col-start-1 row-start-1 truncate text-sm text-ink sm:col-span-1 sm:col-start-2">
                    {c.descricao}
                  </span>
                  <span className="col-start-1 row-start-2 text-xs text-faint sm:hidden">Mínimo · Alvo</span>
                  <span className="col-start-2 row-start-2 text-right font-mono text-[13px] tabular-nums text-ink sm:col-start-3 sm:row-start-1">
                    {formatarMoeda(c.precoMinimo)}
                  </span>
                  <span className="col-start-3 row-start-2 text-right font-mono text-[13px] tabular-nums text-ink sm:col-start-4 sm:row-start-1">
                    {formatarMoeda(c.precoAlvo)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
