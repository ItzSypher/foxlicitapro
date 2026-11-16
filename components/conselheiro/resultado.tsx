import { TriangleAlert } from "lucide-react";
import { ROTULO_VEREDITO_CONSELHEIRO, type SaidaConselheiro, type VereditoConselheiro } from "@/lib/conselheiro/esquema";
import { cn } from "@/lib/utils";

const COR_VEREDITO: Record<VereditoConselheiro, string> = {
  vale: "text-positive",
  talvez: "text-warning",
  "nao-vale": "text-negative",
};

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section aria-label={titulo} className="flex min-w-0 flex-col gap-2 border-t border-rule pt-5">
      <h3 className="text-base font-semibold text-ink">{titulo}</h3>
      {children}
    </section>
  );
}

function Lista({ itens }: { itens: readonly string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-ink marker:text-muted-foreground">
      {itens.map((t, i) => (
        <li key={`${i}-${t}`} className="wrap-break-word">
          {t}
        </li>
      ))}
    </ul>
  );
}

function Passos({ passos }: { passos: readonly string[] }) {
  return (
    <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-relaxed text-ink marker:text-muted-foreground marker:tabular-nums">
      {passos.map((p, i) => (
        <li key={`${i}-${p}`} className="wrap-break-word">
          {p}
        </li>
      ))}
    </ol>
  );
}

/** O parecer do conselheiro como um documento: veredito no topo, depois seções com título e texto. */
export function ResultadoConselheiro({ saida }: { saida: SaidaConselheiro }) {
  const { modalidade } = saida;
  return (
    <article className="flex min-w-0 flex-col gap-5 rounded-card bg-surface p-5 md:p-6">
      <header className="flex min-w-0 flex-col gap-2">
        <p className="text-xs text-muted-foreground">Veredito</p>
        <p className={cn("text-3xl leading-tight font-semibold", COR_VEREDITO[saida.veredito])}>
          {ROTULO_VEREDITO_CONSELHEIRO[saida.veredito]}
        </p>
        <p className="text-base leading-relaxed text-ink wrap-break-word">{saida.resumo}</p>
      </header>

      {modalidade.ehPregao ? (
        <div
          role="note"
          className={cn(
            "flex items-start gap-2 rounded-control p-3 text-[13px] leading-snug",
            modalidade.foraDoFoco ? "bg-pill-neg-bg text-pill-neg-fg" : "bg-pill-pos-bg text-pill-pos-fg",
          )}
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p className="min-w-0 wrap-break-word">
            <span className="font-semibold">
              {modalidade.foraDoFoco ? "Pregão: fora do foco atual. " : "Pregão com exceção: vale a pena. "}
            </span>
            {modalidade.observacao}
          </p>
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">{modalidade.observacao}</p>
      )}

      <Secao titulo="Por quê">
        <Lista itens={saida.porQue} />
      </Secao>

      <Secao titulo="Como conseguir">
        <div className="flex flex-col gap-5">
          {saida.comoConseguir.map((c, i) => (
            <article key={`${i}-${c.canal}`} className="flex min-w-0 flex-col gap-2">
              <h4 className="text-sm font-semibold text-ink wrap-break-word">{c.canal}</h4>
              <Passos passos={c.passos} />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-ink">Prazo típico: </span>
                {c.prazoTipico}
              </p>
              {c.cuidados.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-ink">Cuidados</p>
                  <Lista itens={c.cuidados} />
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </Secao>

      <Secao titulo="Sobre o preço">
        <p className="text-sm leading-relaxed text-ink wrap-break-word">{saida.precoComentario}</p>
      </Secao>

      {saida.riscos.length > 0 ? (
        <Secao titulo="Riscos">
          <Lista itens={saida.riscos} />
        </Secao>
      ) : null}

      <Secao titulo="Próximos passos">
        <Passos passos={saida.proximosPassos} />
      </Secao>
    </article>
  );
}
