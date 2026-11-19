"use client";

import { useTransition } from "react";
import { trocarEmpresaAction } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";

export interface OpcaoEmpresa {
  id: string;
  nome: string;
}

interface Props {
  empresas: OpcaoEmpresa[];
  ativaId: string;
  /** "lado" no menu lateral; "topo" no cabeçalho do celular */
  variante: "lado" | "topo";
  className?: string;
}

/** Troca a empresa ativa de quem gerencia mais de uma. */
export function SeletorEmpresa({ empresas, ativaId, variante, className }: Props) {
  const [pendente, iniciar] = useTransition();
  return (
    <select
      aria-label="Empresa"
      value={ativaId}
      disabled={pendente}
      onChange={(e) => {
        const id = e.target.value;
        if (id === ativaId) return;
        iniciar(async () => {
          await trocarEmpresaAction(id);
        });
      }}
      className={cn(
        "w-full min-w-0 cursor-pointer truncate rounded-control border border-control bg-surface text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60",
        variante === "lado" ? "min-h-9 px-2 text-xs" : "h-7 px-1.5 text-[13px] leading-tight font-medium",
        className,
      )}
    >
      {empresas.map((e) => (
        <option key={e.id} value={e.id}>
          {e.nome}
        </option>
      ))}
    </select>
  );
}
