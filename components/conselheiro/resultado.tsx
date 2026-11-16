import { TriangleAlert } from "lucide-react";
import type { SaidaConselheiro } from "@/lib/conselheiro/esquema";
import { cn } from "@/lib/utils";
import { SeloConselheiro } from "./selo-conselheiro";

function Bloco({ titulo, children, className }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={titulo} className={cn("flex min-w-0 flex-col gap-2 rounded-card border border-border bg-surface p-4", className)}>
      <h3 className="text-sm font-semibold text-ink">{titulo}</h3>
      {children}
    </section>
  );
}

function Lista({ itens }: { itens: readonly string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-4 text-[13px] leading-snug text-ink marker:text-muted-foreground">
      {itens.map((t, i) => (
        <li key={`${i}-${t}`} className="wrap-break-word">
          {t}
        </li>
      ))}
    </ul>
  );
}

/** O parecer do conselheiro em blocos: veredito, resumo, por quê, como conseguir, preço, riscos e próximos passos. */
export function ResultadoConselheiro({ saida }: { saida: SaidaConselheiro }) {
  const { modalidade } = saida;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {modalidade.ehPregao ? (
        <div
          role="note"
          className={cn(
            "flex items-start gap-2 rounded-card border p-3 text-[13px] leading-snug text-ink",
            modalidade.foraDoFoco ? "border-negative bg-pill-neg-bg" : "border-positive bg-pill-pos-bg",
          )}
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p className="min-w-0 wrap-break-word">
            <span className="font-semibold">{modalidade.foraDoFoco ? "Pregão: fora do foco atual. " : "Pregão com exceção: vale a pena. "}</span>
            {modalidade.observacao}
          </p>
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">{modalidade.observacao}</p>
      )}

      <Bloco titulo="Veredito">
        <div className="flex flex-wrap items-center gap-2">
          <SeloConselheiro veredito={saida.veredito} className="h-6 px-2 text-xs" />
        </div>
        <p className="text-sm leading-snug text-ink wrap-break-word">{saida.resumo}</p>
      </Bloco>

      <Bloco titulo="Por quê">
        <Lista itens={saida.porQue} />
      </Bloco>

      <Bloco titulo="Como conseguir">
        <div className="flex flex-col gap-3">
          {saida.comoConseguir.map((c, i) => (
            <article key={`${i}-${c.canal}`} className="flex min-w-0 flex-col gap-2 rounded-control bg-raised p-3">
              <h4 className="text-[13px] font-semibold text-ink wrap-break-word">{c.canal}</h4>
              <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-[13px] leading-snug text-ink marker:text-muted-foreground">
                {c.passos.map((p, k) => (
                  <li key={`${k}-${p}`} className="wrap-break-word">
                    {p}
                  </li>
                ))}
              </ol>
              <p className="text-[13px] text-muted-foreground">
                <span className="font-medium text-ink">Prazo típico: </span>
                {c.prazoTipico}
              </p>
              {c.cuidados.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold text-muted-foreground">Cuidados</p>
                  <Lista itens={c.cuidados} />
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </Bloco>

      <Bloco titulo="Sobre o preço">
        <p className="text-[13px] leading-snug text-ink wrap-break-word">{saida.precoComentario}</p>
      </Bloco>

      {saida.riscos.length > 0 ? (
        <Bloco titulo="Riscos">
          <Lista itens={saida.riscos} />
        </Bloco>
      ) : null}

      <Bloco titulo="Próximos passos">
        <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-[13px] leading-snug text-ink marker:text-muted-foreground">
          {saida.proximosPassos.map((p, i) => (
            <li key={`${i}-${p}`} className="wrap-break-word">
              {p}
            </li>
          ))}
        </ol>
      </Bloco>
    </div>
  );
}
