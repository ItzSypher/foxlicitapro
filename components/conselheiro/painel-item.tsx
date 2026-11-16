"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Sparkles } from "lucide-react";
import { analisarComConselheiroAction } from "@/app/(app)/conselheiro/actions";
import { PrecoSugeridoDetalhe } from "@/components/preco/preco-sugerido-detalhe";
import { ROTULO_ETAPA, type EtapaId } from "@/components/pipeline/tipos";
import type { PrecoSugerido } from "@/core/preco-sugerido";
import type { AnaliseSalva } from "@/lib/conselheiro/esquema";
import { formatarEncerramento, formatarMoeda } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { ResultadoConselheiro } from "./resultado";

/** O que a tela mostra no cabeçalho do item escolhido. */
export interface CabecalhoItem {
  id: string;
  titulo: string;
  orgao: string;
  local: string;
  regiao: string;
  modalidade: string;
  valorEstimado: number | null;
  encerramento: string;
  etapa: EtapaId;
  linkLicitacao: string;
}

export const MENSAGEM_INDISPONIVEL = "Conselheiro indisponível: falta configurar a chave do assistente.";

const dataHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

function quando(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? "data desconhecida" : dataHora.format(data);
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="text-[13px] leading-snug text-ink wrap-break-word">{valor}</dd>
    </div>
  );
}

export function PainelItemConselheiro({
  item,
  preco,
  analiseInicial,
  disponivel,
  podeAnalisar,
}: {
  item: CabecalhoItem;
  preco: PrecoSugerido | null;
  analiseInicial: AnaliseSalva | null;
  disponivel: boolean;
  podeAnalisar: boolean;
}) {
  const [analise, setAnalise] = useState<AnaliseSalva | null>(analiseInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [analisando, iniciar] = useTransition();

  function analisar() {
    setErro(null);
    iniciar(async () => {
      const r = await analisarComConselheiroAction(item.id);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setAnalise(r.analise);
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <header className="flex min-w-0 flex-col gap-3">
        <h2 className="text-lg leading-snug font-semibold text-ink wrap-break-word">{item.titulo}</h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Dado rotulo="Órgão" valor={item.orgao} />
          <Dado rotulo="Local" valor={`${item.local} · ${item.regiao}`} />
          <Dado rotulo="Modalidade" valor={item.modalidade} />
          <Dado rotulo="Etapa no Pipeline" valor={ROTULO_ETAPA[item.etapa]} />
          <Dado rotulo="Valor estimado" valor={item.valorEstimado === null ? "Não informado" : formatarMoeda(item.valorEstimado)} />
          <Dado rotulo="Encerramento" valor={formatarEncerramento(item.encerramento)} />
        </dl>
        <div className="flex flex-wrap gap-2">
          <Link
            href={item.linkLicitacao}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-control border border-control px-4 text-sm font-medium text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand md:h-9"
          >
            Abrir licitação
            <ExternalLink aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </header>

      <section aria-label="Preço sugerido" className="flex min-w-0 flex-col gap-3 rounded-card border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold text-ink">Preço sugerido</h3>
        {preco !== null ? (
          <PrecoSugeridoDetalhe preco={preco} />
        ) : (
          <p className="text-[13px] text-muted-foreground">Não foi possível calcular o preço sugerido agora.</p>
        )}
      </section>

      <section aria-label="Parecer do conselheiro" className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-sm font-semibold text-ink">Conselheiro</h3>
          {analise !== null ? (
            <p className="text-[13px] text-muted-foreground">
              Análise de {quando(analise.criadoEm)}
              {analise.criadoPorNome ? `, pedida por ${analise.criadoPorNome}` : ""}.
            </p>
          ) : (
            <p className="text-[13px] text-muted-foreground">Este item ainda não foi analisado.</p>
          )}
        </div>

        {!disponivel ? (
          <p role="status" className="rounded-card border border-border bg-raised p-3 text-[13px] text-ink">
            {MENSAGEM_INDISPONIVEL}
          </p>
        ) : podeAnalisar ? (
          <button
            type="button"
            onClick={analisar}
            disabled={analisando}
            className={cn(
              "inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-control bg-brand-fill px-5 text-sm font-semibold text-black outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ground disabled:cursor-wait disabled:opacity-60 md:w-auto md:self-start",
            )}
          >
            <Sparkles aria-hidden="true" className="size-4" />
            {analisando ? "Analisando…" : analise !== null ? "Analisar de novo" : "Analisar com o conselheiro"}
          </button>
        ) : (
          <p className="text-[13px] text-muted-foreground">Só quem mexe no Pipeline ou faz a revisão jurídica pede uma análise.</p>
        )}

        <div aria-live="polite" className="min-w-0">
          {analisando ? <p className="text-[13px] text-muted-foreground">O conselheiro está lendo o item. Pode levar até um minuto.</p> : null}
          {erro ? (
            <p role="alert" className="rounded-control border border-border bg-pill-neg-bg px-3 py-2 text-sm text-pill-neg-fg">
              {erro}
            </p>
          ) : null}
        </div>

        {analise !== null ? <ResultadoConselheiro saida={analise.resultado} /> : null}
      </section>
    </div>
  );
}
