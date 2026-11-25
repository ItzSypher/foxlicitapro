import { BadgeCheck, Banknote, ClipboardList, FileText, HandCoins, Lightbulb, PackageCheck, CalendarCheck, type LucideIcon } from "lucide-react";
import { Pilula, type TomPilula } from "@/components/radar/pilula";
import {
  caminhoDoDinheiro,
  NOME_NIVEL_CAIXA,
  type IdEtapa,
  type NivelCaixa,
  type OportunidadeCaixa,
} from "@/core/caminho-dinheiro";
import type { FichaEdital } from "@/core/ficha";
import { formatarMoeda } from "@/lib/formato";

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

function textoDias(n: number): string {
  return `~${n} ${n === 1 ? "dia" : "dias"}`;
}

/** Cartão "Caminho do dinheiro": do empenho ao dinheiro na conta, quantos dias sem receber e quanto caixa pede. */
export function CaminhoDinheiro({ ficha, oportunidade }: Props) {
  const c = caminhoDoDinheiro(ficha, oportunidade);
  const caixa = c.caixaNecessario;

  return (
    <section aria-labelledby="caminho-dinheiro-titulo" className="flex flex-col gap-4 rounded-card bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="caminho-dinheiro-titulo" className="text-base font-semibold text-ink">
          Caminho do dinheiro
        </h2>
        <Pilula tom={TOM_NIVEL[caixa.nivel]}>Caixa {NOME_NIVEL_CAIXA[caixa.nivel]}</Pilula>
      </div>

      <ol className="flex flex-col">
        {c.etapas.map((etapa, i) => {
          const Icone = ICONE[etapa.id];
          const ultima = i === c.etapas.length - 1;
          return (
            <li key={etapa.id} className="flex gap-3">
              <span className="flex shrink-0 flex-col items-center">
                <span className="flex size-8 items-center justify-center rounded-full bg-raised text-brand">
                  <Icone aria-hidden="true" className="size-4" />
                </span>
                {ultima ? null : <span aria-hidden="true" className="w-px flex-1 bg-border" />}
              </span>
              <div className={ultima ? "min-w-0 pb-0" : "min-w-0 pb-4"}>
                <p className="text-sm font-medium wrap-break-word text-ink">
                  {etapa.rotulo} <span className="font-normal text-muted-foreground">· {etapa.prazo}</span>
                </p>
                <p className="text-[13px] wrap-break-word text-muted-foreground">{etapa.detalhe}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <dl className="grid grid-cols-1 gap-3 border-t border-border pt-4 min-[480px]:grid-cols-2">
        <div>
          <dt className="text-[13px] text-muted-foreground">Dias sem receber</dt>
          <dd className="text-lg font-medium tabular-nums text-ink">
            {c.diasSemReceber === null ? "Não informado" : c.diasSemReceber === 0 ? "Recebe antes" : textoDias(c.diasSemReceber)}
          </dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted-foreground">Caixa necessário</dt>
          <dd className="text-lg font-medium tabular-nums text-ink">
            {caixa.valor === null ? "Valor sigiloso" : `~${formatarMoeda(caixa.valor)}`}{" "}
            <span className="text-sm font-normal text-muted-foreground">({NOME_NIVEL_CAIXA[caixa.nivel]})</span>
          </dd>
        </div>
      </dl>

      <p className="text-sm wrap-break-word text-ink">{caixa.explicacao}</p>

      {c.comFicha ? null : (
        <p className="text-[13px] text-muted-foreground">
          Estimativa pelo tipo do objeto e pelo valor. Gere a ficha do edital para os prazos exatos.
        </p>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Lightbulb aria-hidden="true" className="size-4 text-brand" />
          Para receber mais rápido
        </h3>
        <ul className="flex flex-col gap-1.5">
          {c.dicas.map((dica) => (
            <li key={dica} className="text-[13px] wrap-break-word text-muted-foreground">
              {dica}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
