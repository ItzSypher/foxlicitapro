import { AlarmClock, Bell, FileCheck, Kanban, Scale, SearchX, Sparkles, UserCheck, Wallet, type LucideIcon } from "lucide-react";

/** Ícone e cor de cada tipo de aviso na central de novidades. Tipo desconhecido usa o sino. */
const ICONES: Record<string, { Icone: LucideIcon; cor: string }> = {
  novas_ramo: { Icone: Sparkles, cor: "text-positive" },
  oportunidade: { Icone: Sparkles, cor: "text-positive" },
  desertas_novas: { Icone: SearchX, cor: "text-brand" },
  proposta_resultado: { Icone: FileCheck, cor: "text-positive" },
  proposta_revisao: { Icone: FileCheck, cor: "text-brand" },
  proposta_revisada: { Icone: FileCheck, cor: "text-brand" },
  proposta_parada: { Icone: FileCheck, cor: "text-warning" },
  disputa_48h: { Icone: AlarmClock, cor: "text-warning" },
  ficha_caixa: { Icone: Wallet, cor: "text-warning" },
  item_atribuido: { Icone: UserCheck, cor: "text-brand" },
  pipeline: { Icone: Kanban, cor: "text-brand" },
  juridico_pendente: { Icone: Scale, cor: "text-warning" },
};

export function IconeAviso({ tipo }: { tipo: string }) {
  const { Icone, cor } = ICONES[tipo] ?? { Icone: Bell, cor: "text-muted-foreground" };
  return <Icone aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${cor}`} />;
}
