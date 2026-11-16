"use client";

import { useMemo } from "react";
import type { OportunidadeComScore } from "@/core/types";
import type { ResultadoForaRj } from "@/lib/fora-rj-busca";
import type { Visao } from "@/lib/radar-filtros";
import { ForaRjView } from "@/components/radar/fora-rj-view";
import { BotaoSalvarPipeline } from "./botao-salvar";

interface Props {
  resultado: ResultadoForaRj;
  visao: Visao;
  nomeMunicipio?: string | null;
  /** ids (numeroControlePNCP) que já estão no pipeline */
  idsSalvos: string[];
  /** Sem a permissão de mexer no pipeline, o botão "Salvar" não aparece */
  podeSalvar?: boolean;
}

/** Busca fora do RJ com o botão "Salvar no pipeline" no detalhe de cada licitação. */
export function ForaRjComPipeline({ resultado, visao, nomeMunicipio, idsSalvos, podeSalvar = true }: Props) {
  const salvos = useMemo(() => new Set(idsSalvos), [idsSalvos]);
  return (
    <ForaRjView
      resultado={resultado}
      visao={visao}
      nomeMunicipio={nomeMunicipio}
      renderAcoes={(item: OportunidadeComScore) =>
        podeSalvar || salvos.has(item.id) ? (
          <BotaoSalvarPipeline key={item.id} item={item} salvo={salvos.has(item.id)} />
        ) : null
      }
    />
  );
}
