import { Pilula } from "@/components/radar/pilula";
import type { Score } from "@/core/types";
import { nomeFaixa } from "@/lib/radar-filtros";
import { Secao } from "./secao";

export function NotaCriterios({ score }: { score: Score | null }) {
  return (
    <Secao id="nota" titulo="Por que essa nota">
      {score === null ? (
        <p className="rounded-card border border-dashed border-control px-4 py-8 text-center text-sm text-muted-foreground">
          Sem nota: a contratação não é dispensa nem pregão eletrônico, ou não informa o prazo.
        </p>
      ) : (
        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface px-4">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Pontuação por critério</caption>
            <tbody>
              {score.criterios.map((criterio) => (
                <tr key={criterio.id} className="border-t border-border align-top first:border-t-0">
                  <th scope="row" className="py-3 pr-3 text-left font-normal">
                    <span className="block font-medium text-ink">{criterio.rotulo}</span>
                    <span className="block text-[13px] text-muted-foreground">{criterio.motivo}</span>
                    {criterio.aConfirmar ? (
                      <Pilula tom="aviso" className="mt-1.5">
                        confirmar no edital
                      </Pilula>
                    ) : null}
                  </th>
                  <td className="py-3 text-right font-mono whitespace-nowrap tabular-nums text-ink">
                    {criterio.pontos}/{criterio.maximo}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-control">
                <th scope="row" className="py-3 pr-3 text-left font-semibold text-ink">
                  Total · {nomeFaixa(score.faixa)}
                </th>
                <td className="py-3 text-right font-mono font-medium whitespace-nowrap tabular-nums text-ink">
                  {score.total}/100
                </td>
              </tr>
            </tfoot>
          </table>
          {score.cnaesCasados.length > 0 ? (
            <ul aria-label="CNAEs que casaram" className="flex flex-wrap gap-2 border-t border-border py-3">
              {score.cnaesCasados.map((cnae) => (
                <li key={cnae}>
                  <Pilula tom="neutro" className="font-mono tabular-nums">
                    {cnae}
                  </Pilula>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </Secao>
  );
}
