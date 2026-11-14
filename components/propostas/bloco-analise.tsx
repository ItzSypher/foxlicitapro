import { Secao } from "@/components/propostas/campos";
import { formatarMoeda } from "@/lib/formato";
import type { AnaliseAssistente } from "@/core/types-equipe";

function Lista({ itens }: { itens: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-snug text-ink">
      {itens.map((t, i) => (
        <li key={`${i}-${t}`}>{t}</li>
      ))}
    </ul>
  );
}

function Titulo({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[13px] font-medium text-muted-foreground">{children}</h3>;
}

/** Análise feita pelo assistente ao montar a proposta: resumo, pegadinhas, documentos e sugestões por item. */
export function BlocoAnalise({ analise }: { analise: AnaliseAssistente }) {
  return (
    <Secao id="secao-analise" titulo="Análise do assistente">
      <p className="rounded-control border border-border bg-raised px-3 py-2 text-[13px] leading-snug text-ink">
        Confira preços e marcas antes de aprovar: são sugestões.
      </p>

      {analise.resumo.trim() !== "" ? <p className="text-sm leading-snug text-ink">{analise.resumo}</p> : null}

      {analise.pegadinhas.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Titulo>Pegadinhas do edital</Titulo>
          <Lista itens={analise.pegadinhas} />
        </div>
      ) : null}

      {analise.documentosExigidos.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Titulo>Documentos exigidos</Titulo>
          <Lista itens={analise.documentosExigidos} />
        </div>
      ) : null}

      {analise.sugestoesPorItem.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Titulo>Sugestões por item</Titulo>
          <ul className="flex flex-col gap-2">
            {analise.sugestoesPorItem.map((s) => (
              <li key={s.numero} className="rounded-control border border-border bg-raised px-3 py-2 text-sm leading-snug text-ink">
                <span className="font-medium">Item {s.numero}</span>
                {s.marcaModelo.trim() !== "" ? ` · ${s.marcaModelo}` : ""}
                {s.precoSugerido !== null ? (
                  <span className="tabular-nums"> · {formatarMoeda(s.precoSugerido)}</span>
                ) : null}
                {s.observacao.trim() !== "" ? <span className="block text-[13px] text-muted-foreground">{s.observacao}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Secao>
  );
}
