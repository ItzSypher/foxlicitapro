import { FileCheck2 } from "lucide-react";
import { Pilula, type TomPilula } from "@/components/radar/pilula";
import { dataHoraCurta } from "@/components/propostas/status";
import { ROTULO_EVENTO, type EventoProposta, type TipoEvento } from "@/core/proposta-eventos";
import { ROTULO_RESULTADO, textoResultado, type SituacaoResultado } from "@/core/proposta-resultado";
import { formatarMoeda } from "@/lib/formato";
import { cn } from "@/lib/utils";

const COR_PONTO: Record<TipoEvento, string> = {
  criada: "bg-faint",
  revisao: "bg-pill-warn-fg",
  devolvida: "bg-pill-neg-fg",
  aprovada: "bg-pill-pos-fg",
  enviada: "bg-brand-fill",
  resultado: "bg-ink",
};

const TOM_RESULTADO: Record<SituacaoResultado, TomPilula> = {
  aguardando: "aviso",
  ganhou: "positivo",
  perdeu: "negativo",
};

export function PilulaResultado({ resultado }: { resultado: SituacaoResultado }) {
  return <Pilula tom={TOM_RESULTADO[resultado]}>{resultado === "aguardando" ? "Sem resultado" : ROTULO_RESULTADO[resultado]}</Pilula>;
}

/** Quem fez o quê e quando, do mais antigo ao mais recente, com o comprovante de cada envio. */
export function LinhaDoTempo({ propostaId, eventos }: { propostaId: string; eventos: ReadonlyArray<EventoProposta> }) {
  if (eventos.length === 0) return <p className="text-[13px] text-muted-foreground">Nada registrado ainda.</p>;
  return (
    <ol className="flex flex-col">
      {eventos.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < eventos.length - 1 && <span aria-hidden className="absolute top-3 left-[5px] h-full w-px bg-border" />}
          <span aria-hidden className={cn("relative mt-1.5 size-[11px] shrink-0 rounded-full", COR_PONTO[e.tipo])} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-sm font-medium text-ink">
              {e.tipo === "resultado" && e.resultado ? ROTULO_RESULTADO[e.resultado.situacao] : ROTULO_EVENTO[e.tipo]}
            </p>
            <p className="text-[13px] text-muted-foreground">
              {dataHoraCurta(e.em)}
              {e.tipo === "resultado" ? " · consulta automática no PNCP" : e.porNome ? ` · ${e.porNome}` : ""}
            </p>
            {e.resultado && <p className="text-[13px] text-ink">{textoResultado(e.resultado)}</p>}
            {e.protocolo && (
              <p className="text-[13px] text-ink">
                Protocolo <span className="font-medium tabular-nums">{e.protocolo}</span>
              </p>
            )}
            {e.nota && <p className="text-[13px] leading-snug whitespace-pre-line text-ink">{e.nota}</p>}
            {e.temComprovante && (
              <a
                href={`/propostas/${propostaId}/comprovante/${e.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 self-start text-[13px] font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
              >
                <FileCheck2 aria-hidden className="size-4" />
                Ver comprovante
              </a>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export interface ResumoResultado {
  status: "enviada" | "outro";
  resultado: SituacaoResultado | null;
  vencedor: string | null;
  valor: number | null;
  temCompraPncp: boolean;
}

/** Quadro do resultado: ganhou, perdeu (para quem e por quanto) ou aguardando. */
export function QuadroResultado({ dados }: { dados: ResumoResultado }) {
  if (dados.status !== "enviada") return null;
  const final = dados.resultado === "ganhou" || dados.resultado === "perdeu";
  return (
    <div className="flex flex-col gap-1.5 rounded-control border border-border bg-raised px-3 py-2.5">
      <div className="flex items-center gap-2">
        <PilulaResultado resultado={dados.resultado ?? "aguardando"} />
        {dados.valor !== null && <span className="text-sm tabular-nums text-ink">{formatarMoeda(dados.valor)}</span>}
      </div>
      {dados.resultado === "perdeu" && dados.vencedor && <p className="text-[13px] text-ink">Vencedor: {dados.vencedor}</p>}
      {!final && (
        <p className="text-[13px] text-muted-foreground">
          {dados.temCompraPncp
            ? "O resultado é consultado todo dia no PNCP e aparece aqui quando sair."
            : "Esta proposta não tem o número do PNCP: o resultado não é consultado sozinho."}
        </p>
      )}
    </div>
  );
}
