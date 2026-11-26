import { Pilula } from "@/components/radar/pilula";
import type { ResultadoProposta } from "@/core/proposta-custo";
import { formatarMoedaCurta } from "@/lib/formato";
import { cn } from "@/lib/utils";

function Numero({ rotulo, valor, className }: { rotulo: string; valor: string; className?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className={cn("truncate text-base font-semibold tabular-nums text-ink", className)}>{valor}</dd>
    </div>
  );
}

function textoPercentual(v: number): string {
  return `${String(v).replace(".", ",")}%`;
}

/**
 * Conta da proposta no editor: receita, custo e margem para todos; comissão e resultado final só quando o
 * dono olha (`resultado.comissao` vem preenchido). Interna: não aparece no documento, no PDF nem no link.
 */
export function BarraResultado({ resultado }: { resultado: ResultadoProposta }) {
  const r = resultado;
  const doDono = r.resultado !== null && r.comissao !== null && r.comissaoPercentual !== null;
  const prejuizo = r.situacao === "prejuizo";
  const sinal = (v: number) => (v < 0 ? "text-negative" : "text-ink");

  return (
    <section aria-label="Resultado da proposta" className="nao-imprimir flex flex-col gap-3 rounded-card border border-border bg-surface p-3 sm:p-4">
      <dl className="grid grid-cols-3 gap-x-3 gap-y-3">
        <Numero rotulo="Receita" valor={formatarMoedaCurta(r.receita)} />
        <Numero rotulo="Custo" valor={r.custo > 0 ? formatarMoedaCurta(r.custo) : "—"} />
        <Numero
          rotulo={`${doDono ? "Margem bruta" : "Margem"}${r.custo > 0 ? ` ${textoPercentual(r.margemBrutaPercentual)}` : ""}`}
          valor={r.custo > 0 ? formatarMoedaCurta(r.margemBruta) : "—"}
          className={sinal(r.margemBruta)}
        />
        {doDono && r.comissao !== null && r.comissaoPercentual !== null && r.resultado !== null ? (
          <>
            <Numero rotulo={`Comissão ${textoPercentual(r.comissaoPercentual)}`} valor={formatarMoedaCurta(r.comissao)} />
            <Numero rotulo="Resultado final" valor={r.custo > 0 ? formatarMoedaCurta(r.resultado) : "—"} className={sinal(r.resultado)} />
          </>
        ) : null}
      </dl>

      {prejuizo || r.itensSemCusto > 0 ? (
        <div className="flex flex-wrap items-center gap-2" role="status">
          {prejuizo ? <Pilula tom="negativo">Prejuízo de {formatarMoedaCurta(r.prejuizo)}</Pilula> : null}
          {r.itensSemCusto > 0 ? (
            <Pilula tom="aviso">
              Falta custo em {r.itensSemCusto} {r.itensSemCusto === 1 ? "item" : "itens"}
            </Pilula>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
