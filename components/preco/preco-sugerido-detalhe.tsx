import { ROTULO_CONFIANCA, type PrecoSugerido } from "@/core/preco-sugerido";
import { formatarMoeda } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { SeloVeredito } from "./selo-veredito";

function pct(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function Marco({ rotulo, valor, cor }: { rotulo: string; valor: number | null; cor: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", cor)} />
        {rotulo}
      </span>
      <span className="text-[15px] leading-tight font-semibold tabular-nums text-ink wrap-break-word">
        {valor === null ? "—" : formatarMoeda(valor)}
      </span>
    </div>
  );
}

/** Posição em porcentagem dentro da barra, sem sair dela. */
function posicao(valor: number, maximo: number): number {
  return Math.min(100, Math.max(0, (valor / maximo) * 100));
}

/** Barra simples em CSS: do zero ao piso é custo e imposto, do piso ao alvo é a margem, e o teto marca até onde o mercado paga. */
function Barra({ piso, alvo, teto }: { piso: number; alvo: number; teto: number | null }) {
  const maximo = Math.max(piso, alvo, teto ?? 0) * 1.05;
  const pPiso = posicao(piso, maximo);
  const pAlvo = posicao(alvo, maximo);
  const pTeto = teto === null ? null : posicao(teto, maximo);
  return (
    <div
      role="img"
      aria-label={`Barra de preços: piso ${formatarMoeda(piso)}, alvo ${formatarMoeda(alvo)}${teto === null ? "" : `, teto ${formatarMoeda(teto)}`}`}
      className="relative h-6 w-full"
    >
      <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 overflow-hidden rounded-full bg-raised">
        <div className="absolute inset-y-0 left-0 bg-border" style={{ width: `${pPiso}%` }} />
        <div className="absolute inset-y-0 bg-brand/40" style={{ left: `${pPiso}%`, width: `${Math.max(0, pAlvo - pPiso)}%` }} />
      </div>
      <span className="absolute top-0 h-6 w-0.5 -translate-x-1/2 bg-muted-foreground" style={{ left: `${pPiso}%` }} />
      <span className="absolute top-0 h-6 w-0.5 -translate-x-1/2 bg-brand" style={{ left: `${pAlvo}%` }} />
      {pTeto !== null ? (
        <span className="absolute top-0 h-6 w-0.5 -translate-x-1/2 bg-positive" style={{ left: `${pTeto}%` }} />
      ) : null}
    </div>
  );
}

const FRASE: Record<PrecoSugerido["veredito"], string> = {
  vale: "O preço alvo cabe no que o mercado deve pagar.",
  apertado: "O mínimo cabe, mas o alvo passa do que o mercado deve pagar: a margem fica abaixo da meta.",
  "nao-vale": "O preço mínimo passa do que o mercado deve pagar: não sobra margem.",
  "sem-custo": "Sem o custo do fornecedor não há como calcular o preço.",
};

/**
 * Preço sugerido por regras: piso (custo e imposto), alvo (com a margem do CNAE) e teto (estimado com o
 * desconto médio dos concorrentes). Serve à página da licitação e à folha do card do Pipeline.
 */
export function PrecoSugeridoDetalhe({ preco }: { preco: PrecoSugerido }) {
  const { piso, alvo, lucroNoAlvo } = preco;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <SeloVeredito veredito={preco.veredito} />
        <span className="text-xs text-muted-foreground">{ROTULO_CONFIANCA[preco.confianca]}</span>
      </div>
      <p className="text-[13px] leading-snug text-ink">{FRASE[preco.veredito]}</p>

      {piso !== null && alvo !== null ? <Barra piso={piso} alvo={alvo} teto={preco.teto} /> : null}

      <div className="grid grid-cols-3 gap-x-2 gap-y-3">
        <Marco rotulo="Piso" valor={preco.piso} cor="bg-muted-foreground" />
        <Marco rotulo="Alvo" valor={preco.alvo} cor="bg-brand" />
        <Marco rotulo="Teto" valor={preco.teto} cor="bg-positive" />
      </div>

      {lucroNoAlvo !== null ? (
        <dl className="grid grid-cols-2 gap-3">
          <div className="flex min-w-0 flex-col gap-0.5 rounded-card border border-border bg-ground p-3">
            <dt className="text-xs text-muted-foreground">Lucro no alvo</dt>
            <dd className="text-lg leading-tight font-semibold tabular-nums text-ink wrap-break-word">{formatarMoeda(lucroNoAlvo)}</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5 rounded-card border border-border bg-ground p-3">
            <dt className="text-xs text-muted-foreground">Margem no sugerido</dt>
            <dd className="text-lg leading-tight font-semibold tabular-nums text-ink">
              {preco.margemSugeridaPct === null ? "—" : pct(preco.margemSugeridaPct)}
              {preco.margemAlvoPct !== null ? (
                <span className="block text-xs font-normal text-muted-foreground">meta {pct(preco.margemAlvoPct)}</span>
              ) : null}
            </dd>
          </div>
        </dl>
      ) : null}

      {preco.fontes.length > 0 ? (
        <section aria-label="O que entrou no cálculo" className="flex flex-col gap-1.5">
          <h3 className="text-xs font-semibold text-muted-foreground">O que entrou no cálculo</h3>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-[13px] leading-snug text-ink marker:text-muted-foreground">
            {preco.fontes.map((f) => (
              <li key={f} className="wrap-break-word">
                {f}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {preco.faltando.length > 0 ? (
        <section aria-label="O que falta para melhorar" className="flex flex-col gap-1.5">
          <h3 className="text-xs font-semibold text-muted-foreground">O que falta para melhorar</h3>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-[13px] leading-snug text-ink marker:text-muted-foreground">
            {preco.faltando.map((f) => (
              <li key={f} className="wrap-break-word">
                {f}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
