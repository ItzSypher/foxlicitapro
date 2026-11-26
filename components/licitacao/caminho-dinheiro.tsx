import { BadgeCheck, Banknote, CalendarCheck, ChevronDown, ClipboardList, FileText, HandCoins, Lightbulb, PackageCheck, type LucideIcon } from "lucide-react";
import { Pilula, type TomPilula } from "@/components/radar/pilula";
import {
  caminhoDoDinheiro,
  NOME_NIVEL_CAIXA,
  type IdEtapa,
  type NivelCaixa,
  type OportunidadeCaixa,
} from "@/core/caminho-dinheiro";
import type { FichaEdital } from "@/core/ficha";
import { Colapsavel } from "./colapsavel";

interface Props {
  /** Ficha do edital já gerada; null mostra a estimativa pelo tipo do objeto e pelo valor */
  ficha: FichaEdital | null;
  /** Objeto, valor estimado e, quando houver, o score (a frente produto ou serviço) */
  oportunidade: OportunidadeCaixa;
}

const ICONE: Record<IdEtapa, LucideIcon> = {
  empenho: FileText,
  ordem: ClipboardList,
  antecipado: HandCoins,
  entrega: PackageCheck,
  medicao: CalendarCheck,
  atesto: BadgeCheck,
  pagamento: Banknote,
};

const TOM_NIVEL: Record<NivelCaixa, TomPilula> = { baixo: "positivo", medio: "neutro", alto: "aviso" };

/** Cartão "Caminho do dinheiro": do empenho ao dinheiro na conta, cada etapa numa linha com o prazo. Dicas recolhidas. */
export function CaminhoDinheiro({ ficha, oportunidade }: Props) {
  const c = caminhoDoDinheiro(ficha, oportunidade);
  const nivel = c.caixaNecessario.nivel;

  return (
    <Colapsavel
      id="caixa"
      titulo="Caminho do dinheiro"
      aberta
      selos={
        <>
          <Pilula tom={TOM_NIVEL[nivel]}>Caixa {NOME_NIVEL_CAIXA[nivel]}</Pilula>
          {c.comFicha ? <Pilula tom="positivo">Prazos do edital</Pilula> : <Pilula tom="aviso">estimado</Pilula>}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <ol className="flex flex-col divide-y divide-border">
          {c.etapas.map((etapa) => {
            const Icone = ICONE[etapa.id];
            return (
              <li key={etapa.id} className="flex min-h-11 items-center gap-3 py-1.5">
                <Icone aria-hidden="true" className="size-4 shrink-0 text-brand" />
                <span className="min-w-0 flex-1 text-sm wrap-break-word text-ink">{etapa.rotulo}</span>
                <span className="text-sm tabular-nums whitespace-nowrap text-muted-foreground">{etapa.prazo}</span>
              </li>
            );
          })}
        </ol>

        <details className="group/dicas">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-control text-sm font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand [&::-webkit-details-marker]:hidden">
            <Lightbulb aria-hidden="true" className="size-4 text-brand" />
            Para receber mais rápido
            <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open/dicas:rotate-180" />
          </summary>
          <div className="flex flex-col gap-2 pb-1">
            <p className="text-[13px] wrap-break-word text-muted-foreground">{c.caixaNecessario.explicacao}</p>
            <ul className="flex flex-col gap-1.5">
              {c.dicas.map((dica) => (
                <li key={dica} className="text-[13px] wrap-break-word text-muted-foreground">
                  {dica}
                </li>
              ))}
            </ul>
          </div>
        </details>
      </div>
    </Colapsavel>
  );
}
