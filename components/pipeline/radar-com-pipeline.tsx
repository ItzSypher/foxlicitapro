"use client";

import { useMemo } from "react";
import type { Frente, OportunidadeComScore } from "@/core/types";
import type { Visao } from "@/lib/radar-filtros";
import type { PaginaRadar } from "@/lib/radar-pagina";
import { RadarView } from "@/components/radar/radar-view";
import type { PainelMeta } from "@/core/meta";
import { BotaoSalvarPipeline } from "./botao-salvar";

interface Props {
  frente: Frente;
  /** Página atual já filtrada e ordenada pelo servidor; null quando a busca falhou */
  pagina: PaginaRadar | null;
  visao: Visao;
  /** Texto de ?q= na carga da página */
  buscaInicial: string;
  /** ids (numeroControlePNCP) que já estão no pipeline */
  idsSalvos: string[];
  /** id → motivo pelo qual o item não pode sair do pipeline (em disputa, ganho ou com proposta) */
  travados?: Record<string, string>;
  /** Sem a permissão de mexer no pipeline, o botão "Salvar" não aparece */
  podeSalvar?: boolean;
  /** Palavras-chave que a pessoa guardou */
  palavrasSalvas?: string[];
  /** Meta da semana; null quando não foi possível ler */
  meta?: PainelMeta | null;
  /** UFs das áreas da empresa */
  ufsAtendidas?: string[];
  /** Termos do foco da empresa */
  foco?: string[];
}

/** Radar com o botão "Salvar no pipeline" no detalhe de cada oportunidade. */
export function RadarComPipeline({ frente, pagina, visao, buscaInicial, idsSalvos, travados, podeSalvar = true, palavrasSalvas, meta, ufsAtendidas, foco }: Props) {
  const salvos = useMemo(() => new Set(idsSalvos), [idsSalvos]);
  return (
    <RadarView
      frente={frente}
      pagina={pagina}
      visao={visao}
      buscaInicial={buscaInicial}
      palavrasSalvas={palavrasSalvas}
      meta={meta}
      ufsAtendidas={ufsAtendidas}
      foco={foco}
      renderAcoes={(item: OportunidadeComScore) =>
        podeSalvar || salvos.has(item.id) ? (
          <BotaoSalvarPipeline
            key={item.id}
            item={item}
            salvo={salvos.has(item.id)}
            travado={podeSalvar ? (travados?.[item.id] ?? null) : "Sem permissão para mexer no pipeline."}
            className="flex-[1_1_calc(50%-0.25rem)]"
          />
        ) : null
      }
    />
  );
}
