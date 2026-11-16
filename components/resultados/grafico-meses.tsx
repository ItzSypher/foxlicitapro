import { rotuloMes, type MesResultado } from "@/core/resultados";
import { formatarMoedaCurta } from "@/lib/formato";

const LARGURA = 600;
const ALTURA = 180;
const BASE = 150;
const TOPO = 12;
const LATERAL = 8;
/** Espaço extra embaixo para o valor das barras negativas. */
const FOLGA_NEGATIVA = 14;

export type SerieGrafico = "valorGanho" | "lucro";

const TEXTOS: Record<SerieGrafico, { titulo: string; vazio: string }> = {
  valorGanho: { titulo: "Valor ganho por mês", vazio: "Nenhuma licitação ganha nestes meses." },
  lucro: { titulo: "Lucro por mês", vazio: "Nenhum custo informado nas ganhas destes meses." },
};

/** Barras simples por mês, em SVG feito à mão: sem eixos nem legenda. O lucro pode ser negativo e então desce da linha. */
export function GraficoMeses({ meses, serie = "valorGanho" }: { meses: ReadonlyArray<MesResultado>; serie?: SerieGrafico }) {
  const valores = meses.map((m) => m[serie]);
  const maximo = Math.max(...valores, 0);
  const minimo = Math.min(...valores, 0);
  if (maximo <= 0 && minimo >= 0) {
    return <p className="text-sm text-muted-foreground">{TEXTOS[serie].vazio}</p>;
  }
  const area = BASE - TOPO - (minimo < 0 ? FOLGA_NEGATIVA : 0);
  const amplitude = maximo - minimo;
  const zero = TOPO + (maximo / amplitude) * area;
  const faixa = (LARGURA - LATERAL * 2) / meses.length;
  const largura = Math.min(faixa * 0.6, 48);
  const resumo = meses.map((m) => `${rotuloMes(m.mes)}: ${formatarMoedaCurta(m[serie])}`).join("; ");
  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} role="img" aria-label={`${TEXTOS[serie].titulo}. ${resumo}`} className="h-auto w-full">
        <line x1={LATERAL} x2={LARGURA - LATERAL} y1={zero} y2={zero} className="stroke-border" strokeWidth={1} />
        {meses.map((m, i) => {
          const valor = m[serie];
          const altura = (Math.abs(valor) / amplitude) * area;
          const x = LATERAL + faixa * i + (faixa - largura) / 2;
          const negativa = valor < 0;
          const cor = serie === "valorGanho" ? "fill-brand-fill" : negativa ? "fill-negative" : "fill-positive";
          return (
            <g key={m.mes}>
              {valor !== 0 ? (
                <rect x={x} y={negativa ? zero : zero - altura} width={largura} height={altura} rx={2} className={cor} />
              ) : null}
              <text x={x + largura / 2} y={BASE + 18} textAnchor="middle" className="fill-muted-foreground" fontSize={12}>
                {rotuloMes(m.mes)}
              </text>
              {valor !== 0 ? (
                <text
                  x={x + largura / 2}
                  y={negativa ? zero + altura + 12 : zero - altura - 4}
                  textAnchor="middle"
                  className="fill-ink"
                  fontSize={11}
                >
                  {formatarMoedaCurta(valor)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
