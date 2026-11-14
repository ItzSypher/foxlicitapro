import { formatarMoeda } from "@/lib/formato";

interface Marca {
  id: "minimo" | "alvo" | "teto";
  rotulo: string;
  valor: number;
}

interface Props {
  minimo: number;
  alvo: number;
  teto: number | null;
}

/** Distância mínima, em % da régua, para dois rótulos ficarem lado a lado sem encostar. */
const FOLGA_ROTULO = 24;
const ALTURA_FAIXA = 34;

function alinhamento(posicao: number): { esquerda: string; transform: string; textAlign: "left" | "center" | "right" } {
  if (posicao < 14) return { esquerda: `${posicao}%`, transform: "translateX(0)", textAlign: "left" };
  if (posicao > 86) return { esquerda: `${posicao}%`, transform: "translateX(-100%)", textAlign: "right" };
  return { esquerda: `${posicao}%`, transform: "translateX(-50%)", textAlign: "center" };
}

/**
 * Régua de 0 até o maior valor em jogo. Zona abaixo do mínimo em nogo, zona entre
 * mínimo e teto em go (sem teto, até o preço alvo). Em régua estreita os rótulos viram lista;
 * a partir de 448px ficam abaixo da régua, em faixas, para não colidirem.
 */
export function BarraLances({ minimo, alvo, teto }: Props) {
  const fim = teto ?? alvo;
  const limite = Math.max(minimo, alvo, teto ?? 0) || 1;
  const pos = (v: number): number => Math.min(100, Math.max(0, (v / limite) * 100));
  const cabe = minimo <= fim;

  const marcas: Marca[] = [
    { id: "minimo", rotulo: "Mínimo", valor: minimo },
    { id: "alvo", rotulo: "Alvo", valor: alvo },
    ...(teto !== null ? [{ id: "teto" as const, rotulo: "Teto", valor: teto }] : []),
  ];

  // Cada rótulo vai para a primeira faixa cujo último rótulo está longe o bastante.
  const ordenadas = [...marcas].sort((a, b) => a.valor - b.valor);
  const ultimaPosicaoNaFaixa: number[] = [];
  const faixaDe = new Map<Marca["id"], number>();
  for (const m of ordenadas) {
    const p = pos(m.valor);
    let faixa = ultimaPosicaoNaFaixa.findIndex((ultima) => p - ultima >= FOLGA_ROTULO);
    if (faixa === -1) faixa = ultimaPosicaoNaFaixa.length;
    ultimaPosicaoNaFaixa[faixa] = p;
    faixaDe.set(m.id, faixa);
  }
  const faixas = ultimaPosicaoNaFaixa.length;

  const resumo = marcas.map((m) => `${m.rotulo} ${formatarMoeda(m.valor)}`).join(", ");

  return (
    <div className="@container flex flex-col gap-3">
      <div role="img" aria-label={`Barra de lances: ${resumo}`} className="relative h-3 rounded-control bg-raised">
        <div
          className="absolute inset-y-0 left-0 rounded-l-control bg-nogo/20"
          style={{ width: `${cabe ? pos(minimo) : 100}%` }}
        />
        {cabe && (
          <div
            className="absolute inset-y-0 bg-go/20"
            style={{ left: `${pos(minimo)}%`, width: `${Math.max(0, pos(fim) - pos(minimo))}%` }}
          />
        )}
        {marcas.map((m) => (
          <span
            key={m.id}
            aria-hidden
            className="absolute -top-1 h-5 w-0.5 -translate-x-1/2 rounded-full bg-ink"
            style={{ left: `${pos(m.valor)}%` }}
          />
        ))}
      </div>

      {/* Telefone: rótulos empilhados abaixo da régua */}
      <ul className="flex flex-col gap-1 @md:hidden">
        {marcas.map((m) => (
          <li key={m.id} className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="text-muted-foreground">{m.rotulo}</span>
            <span className="tabular-nums text-ink">{formatarMoeda(m.valor)}</span>
          </li>
        ))}
      </ul>

      {/* Régua larga: rótulos nas posições, em faixas que não colidem */}
      <div aria-hidden className="relative hidden @md:block" style={{ height: faixas * ALTURA_FAIXA + 4 }}>
        {marcas.map((m) => {
          const faixa = faixaDe.get(m.id) ?? 0;
          const a = alinhamento(pos(m.valor));
          return (
            <div
              key={m.id}
              className="absolute top-0 flex flex-col text-[13px] leading-tight"
              style={{ left: a.esquerda, transform: a.transform, textAlign: a.textAlign, paddingTop: faixa * ALTURA_FAIXA }}
            >
              <span className="text-muted-foreground">{m.rotulo}</span>
              <span className="tabular-nums text-ink">{formatarMoeda(m.valor)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
