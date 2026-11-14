import { rotuloMes, type MesResultado } from "@/core/resultados";
import { formatarMoedaCurta } from "@/lib/formato";

const LARGURA = 600;
const ALTURA = 180;
const BASE = 150;
const TOPO = 12;
const LATERAL = 8;

/** Barras simples do valor ganho por mês, em SVG feito à mão: uma cor só, sem eixos nem legenda. */
export function GraficoMeses({ meses }: { meses: ReadonlyArray<MesResultado> }) {
  const maximo = Math.max(...meses.map((m) => m.valorGanho), 0);
  if (maximo <= 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma licitação ganha nestes meses.</p>;
  }
  const faixa = (LARGURA - LATERAL * 2) / meses.length;
  const largura = Math.min(faixa * 0.6, 48);
  const resumo = meses.map((m) => `${rotuloMes(m.mes)}: ${formatarMoedaCurta(m.valorGanho)}`).join("; ");
  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} role="img" aria-label={`Valor ganho por mês. ${resumo}`} className="h-auto w-full">
        <line x1={LATERAL} x2={LARGURA - LATERAL} y1={BASE} y2={BASE} className="stroke-border" strokeWidth={1} />
        {meses.map((m, i) => {
          const altura = ((BASE - TOPO) * m.valorGanho) / maximo;
          const x = LATERAL + faixa * i + (faixa - largura) / 2;
          return (
            <g key={m.mes}>
              {m.valorGanho > 0 ? <rect x={x} y={BASE - altura} width={largura} height={altura} rx={2} className="fill-brand-fill" /> : null}
              <text x={x + largura / 2} y={BASE + 18} textAnchor="middle" className="fill-muted-foreground" fontSize={12}>
                {rotuloMes(m.mes)}
              </text>
              {m.valorGanho > 0 ? (
                <text x={x + largura / 2} y={BASE - altura - 4} textAnchor="middle" className="fill-ink" fontSize={11}>
                  {formatarMoedaCurta(m.valorGanho)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
