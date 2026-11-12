import { Pilula, type TomPilula } from "@/components/radar/pilula";
import { ROTULO_STATUS } from "@/core/revisao";
import type { StatusPropostaEquipe } from "@/core/types-equipe";

const TOM: Record<StatusPropostaEquipe, TomPilula> = {
  rascunho: "neutro",
  em_revisao: "aviso",
  aprovada: "positivo",
  devolvida: "negativo",
  pronta: "positivo",
  enviada: "positivo",
};

export function PilulaStatus({ status }: { status: StatusPropostaEquipe }) {
  return <Pilula tom={TOM[status]}>{ROTULO_STATUS[status]}</Pilula>;
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
