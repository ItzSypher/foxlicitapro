import { Pilula, type TomPilula } from "@/components/radar/pilula";
import type { StatusProposta } from "@/core/types-detalhe";

const ROTULO: Record<StatusProposta, string> = {
  rascunho: "Rascunho",
  pronta: "Pronta",
  enviada: "Enviada",
};

const TOM: Record<StatusProposta, TomPilula> = {
  rascunho: "neutro",
  pronta: "aviso",
  enviada: "positivo",
};

export function PilulaStatus({ status }: { status: StatusProposta }) {
  return <Pilula tom={TOM[status]}>{ROTULO[status]}</Pilula>;
}

const dataCurta = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "12/11, 14:32" */
export function dataHoraCurta(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dataCurta.format(d).replace(" ", ", ");
}
