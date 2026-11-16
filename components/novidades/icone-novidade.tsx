import {
  Archive,
  ChartColumn,
  CircleCheck,
  Columns3,
  FileText,
  LayoutDashboard,
  Lightbulb,
  Search,
  Sparkles,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Matiz, NomeIcone } from "@/lib/novidades";
import { cn } from "@/lib/utils";

const ICONES: Record<NomeIcone | "boas-vindas" | "fim", LucideIcon> = {
  painel: LayoutDashboard,
  pipeline: Columns3,
  encerradas: Archive,
  preco: Tag,
  conselheiro: Lightbulb,
  resultados: ChartColumn,
  proposta: FileText,
  busca: Search,
  equipe: Users,
  "boas-vindas": Sparkles,
  fim: CircleCheck,
};

const CORES: Record<Matiz, string> = {
  marca: "bg-brand/15 text-brand",
  positivo: "bg-pill-pos-bg text-pill-pos-fg",
  alerta: "bg-pill-warn-bg text-pill-warn-fg",
  neutro: "bg-pill-neutral-bg text-pill-neutral-fg",
};

/** Ícone dentro de um círculo colorido. O tamanho do círculo vem do `className`. */
export function IconeNovidade({
  icone,
  matiz,
  className,
  iconeClassName,
}: {
  icone: NomeIcone | "boas-vindas" | "fim";
  matiz: Matiz;
  className?: string;
  iconeClassName?: string;
}) {
  const Icone = ICONES[icone];
  return (
    <span aria-hidden="true" className={cn("flex shrink-0 items-center justify-center rounded-full", CORES[matiz], className)}>
      <Icone className={cn("size-5", iconeClassName)} />
    </span>
  );
}
