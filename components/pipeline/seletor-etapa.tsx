"use client";

import { Seletor } from "@/components/ui/seletor";
import { ETAPAS, ehEtapa, type EtapaId } from "./tipos";

/** Seletor para mudar de etapa: a etapa atual aparece no gatilho e as outras, como "Mover para: ...". */
export function SeletorEtapa({
  valor,
  aoMudar,
  className,
}: {
  valor: EtapaId;
  aoMudar: (etapa: EtapaId) => void;
  className?: string;
}) {
  return (
    <Seletor
      rotulo="Mover para"
      posicaoRotulo="oculto"
      valor={valor}
      opcoes={ETAPAS.map((e) => ({ valor: e.id, rotulo: e.id === valor ? e.rotulo : `Mover para: ${e.rotulo}` }))}
      aoMudar={(nova) => {
        if (ehEtapa(nova) && nova !== valor) aoMudar(nova);
      }}
      className={className}
    />
  );
}
