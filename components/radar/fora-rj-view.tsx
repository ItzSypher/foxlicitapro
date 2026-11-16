"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { OportunidadeComScore } from "@/core/types";
import {
  avisoCorteForaRj,
  avisoFalhaForaRj,
  fraseEscopoForaRj,
  frasePaginas,
  nomeLocalForaRj,
  type ResultadoForaRj,
} from "@/lib/fora-rj-busca";
import { frasePlural, type Visao } from "@/lib/radar-filtros";
import { BuscaForaRjSheet } from "./busca-fora-rj";
import { CardOportunidade } from "./card-oportunidade";
import { DetalheSheet } from "./detalhe-sheet";
import { AvisoFalhaParcial, EstadoVazio } from "./estados";
import { CabecalhoLista, LinhaOportunidade } from "./linha-oportunidade";

interface Props {
  resultado: ResultadoForaRj;
  visao: Visao;
  /** Nome do município escolhido, quando houver */
  nomeMunicipio?: string | null;
  /** Ponto de inserção no detalhe, antes de "Abrir no PNCP" (ex.: "Salvar no pipeline"). */
  renderAcoes?: (item: OportunidadeComScore) => React.ReactNode;
}

/** Resultado da busca fora do RJ: mesmos cards, lista, nota e detalhe do Radar, sem paginação e sem cache. */
export function ForaRjView({ resultado, visao, nomeMunicipio = null, renderAcoes }: Props) {
  const { busca, itens } = resultado;
  const [aberta, setAberta] = useState<OportunidadeComScore | null>(null);
  const [detalheAberto, setDetalheAberto] = useState(false);
  const agoraInicial = useMemo(() => {
    const t = Date.parse(resultado.atualizadoEm);
    return Number.isNaN(t) ? 0 : t;
  }, [resultado.atualizadoEm]);

  const abrirDetalhe = useCallback((item: OportunidadeComScore) => {
    setAberta(item);
    setDetalheAberto(true);
  }, []);
  const fecharDetalhe = useCallback(() => setDetalheAberto(false), []);

  const corte = avisoCorteForaRj(resultado);
  const falha = avisoFalhaForaRj(resultado);
  const nadaCarregou = resultado.falhas.length === 2 && resultado.lidas === 0;

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <header className="flex flex-col gap-3">
        <Link
          href="/radar"
          className="inline-flex h-11 w-fit items-center gap-1.5 rounded-control pr-2 text-sm text-muted-foreground outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand md:h-9"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar ao Radar do RJ
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h1 className="text-[22px] leading-tight font-semibold text-ink">Fora do RJ</h1>
            <p className="mt-1 text-sm wrap-break-word text-muted-foreground">
              {nomeLocalForaRj(busca, nomeMunicipio)}
              {busca.palavra !== "" ? ` · “${busca.palavra}”` : ""}
            </p>
          </div>
          <BuscaForaRjSheet inicial={busca} variante="contorno" rotulo="Alterar busca" />
        </div>
        <p className="text-[13px] text-muted-foreground">{fraseEscopoForaRj(busca)}</p>
      </header>

      {nadaCarregou ? (
        <AvisoFalhaParcial texto="O PNCP não respondeu a tempo. Tente de novo em instantes ou refine a busca." />
      ) : (
        <>
          {corte ? <AvisoFalhaParcial texto={corte} /> : null}
          {falha ? <AvisoFalhaParcial texto={falha} /> : null}

          <p className="text-sm text-muted-foreground">
            {itens.length === 0
              ? `Foram lidas ${frasePlural(resultado.lidas, "licitação", "licitações")} em ${frasePaginas(resultado.paginasConsultadas)} do PNCP (encerram em até ${resultado.diasJanela} dias).`
              : `${frasePlural(resultado.totalFiltrado, "licitação encontrada", "licitações encontradas")}${
                  resultado.totalFiltrado > itens.length ? `; as ${itens.length} de maior nota estão abaixo` : ""
                }. Foram lidas ${frasePlural(resultado.lidas, "licitação", "licitações")} em ${frasePaginas(resultado.paginasConsultadas)} do PNCP (encerram em até ${resultado.diasJanela} dias).`}
          </p>

          {itens.length === 0 ? (
            <EstadoVazio frase="Nenhuma licitação com esses critérios nas páginas consultadas." />
          ) : visao === "cards" ? (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
              {itens.map((item, indice) => (
                <li key={item.id} className="flex min-w-0">
                  <CardOportunidade item={item} indice={indice} agoraInicial={agoraInicial} onAbrir={abrirDetalhe} />
                </li>
              ))}
            </ul>
          ) : (
            <>
              <CabecalhoLista />
              <ul className="border-t border-rule md:border-t-0">
                {itens.map((item, indice) => (
                  <li key={item.id}>
                    <LinhaOportunidade item={item} indice={indice} agoraInicial={agoraInicial} onAbrir={abrirDetalhe} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <DetalheSheet
        item={aberta}
        aberto={detalheAberto}
        onFechar={fecharDetalhe}
        agoraInicial={agoraInicial}
        acoesExtras={aberta && renderAcoes ? renderAcoes(aberta) : null}
      />
    </div>
  );
}
