"use client";

import { useMemo } from "react";
import type { Frente, OportunidadeComScore, RespostaRadar } from "@/core/types";
import type { Visao } from "@/lib/radar-filtros";
import { RadarView } from "@/components/radar/radar-view";
import { BotaoSalvarPipeline } from "./botao-salvar";

interface Props {
  frente: Frente;
  resposta: RespostaRadar | null;
  visaoInicial: Visao;
  /** ids (numeroControlePNCP) que já estão no pipeline */
  idsSalvos: string[];
}

/** Radar com o botão "Salvar no pipeline" no detalhe de cada oportunidade. */
export function RadarComPipeline({ frente, resposta, visaoInicial, idsSalvos }: Props) {
  const salvos = useMemo(() => new Set(idsSalvos), [idsSalvos]);
  return (
    <RadarView
      frente={frente}
      resposta={resposta}
      visaoInicial={visaoInicial}
      renderAcoes={(item: OportunidadeComScore) => (
        <BotaoSalvarPipeline key={item.id} item={item} salvo={salvos.has(item.id)} />
      )}
    />
  );
}
