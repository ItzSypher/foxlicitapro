"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { MetaSemana } from "@/components/meta/meta-semana";
import { Entrada, NumeroAnimado } from "@/components/ui/movimento";
import type { PainelMeta } from "@/core/meta";
import { formatarValorCompacto, type PainelDia } from "@/lib/radar-painel";
import { cn } from "@/lib/utils";
import { COLUNAS_PIPELINE, COLUNAS_REGIAO, GRADE_PAINEL } from "./painel-esqueleto";

const CHAVE_OCULTO = "foxlicita:radar-resumo-oculto";
const EVENTO_OCULTO = "foxlicita:radar-resumo";
const DURACAO_CONTAGEM_MS = 600;

function lerOcultoBruto(): string {
  try {
    return window.localStorage.getItem(CHAVE_OCULTO) ?? "";
  } catch {
    return "";
  }
}

function assinarOculto(aviso: () => void): () => void {
  window.addEventListener("storage", aviso);
  window.addEventListener(EVENTO_OCULTO, aviso);
  return () => {
    window.removeEventListener("storage", aviso);
    window.removeEventListener(EVENTO_OCULTO, aviso);
  };
}

/** Resumo recolhido ou não, lembrado no aparelho. Sem armazenamento, fica sempre à vista. */
function useResumoOculto(): { oculto: boolean; alternar: () => void } {
  const bruto = useSyncExternalStore(assinarOculto, lerOcultoBruto, () => "");
  const oculto = bruto === "1";
  function alternar() {
    try {
      window.localStorage.setItem(CHAVE_OCULTO, oculto ? "0" : "1");
    } catch {
      // Armazenamento bloqueado: a escolha só não fica lembrada.
    }
    window.dispatchEvent(new Event(EVENTO_OCULTO));
  }
  return { oculto, alternar };
}

function Numero({ valor, formatar }: { valor: number; formatar?: (n: number) => string }) {
  return <NumeroAnimado valor={valor} formatar={formatar} duracaoMs={DURACAO_CONTAGEM_MS} />;
}

const CELULA = "flex min-w-0 flex-col gap-0.5 bg-surface p-2.5 text-left outline-none md:gap-1 md:p-4";
const CELULA_CLICAVEL =
  "transition-colors hover:bg-raised focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand active:bg-raised";

/**
 * Indicador: número tabular, legenda curta e contexto (contexto só a partir do md).
 * No celular o número vem primeiro e a legenda embaixo. Só "Fecham 48h" leva o laranja.
 */
function Indicador({
  rotulo,
  numero,
  contexto,
  destaque = false,
  discreto = false,
}: {
  rotulo: string;
  numero: React.ReactNode;
  contexto: string;
  destaque?: boolean;
  discreto?: boolean;
}) {
  return (
    <>
      <span className="truncate text-xs text-muted-foreground max-md:order-2 md:text-sm">{rotulo}</span>
      <span
        className={cn(
          "truncate text-2xl leading-tight font-semibold tabular-nums max-md:order-1 md:text-3xl",
          destaque ? "text-brand" : discreto ? "text-muted-foreground" : "text-ink",
        )}
      >
        {numero}
      </span>
      <span className="truncate text-xs text-muted-foreground max-md:hidden">{contexto}</span>
    </>
  );
}

function CelulaBotao({
  aoClicar,
  rotuloAria,
  className,
  children,
}: {
  aoClicar: () => void;
  rotuloAria: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={aoClicar} aria-label={rotuloAria} className={cn(CELULA, CELULA_CLICAVEL, className)}>
      {children}
    </button>
  );
}

const MAX_BARRAS_UF = 4;

interface PropsRegiao {
  contagens: Record<string, number>;
  ativas: ReadonlyArray<string>;
  aoEscolher: (uf: string) => void;
}

function ListaRegiao({ contagens, ativas, aoEscolher }: PropsRegiao) {
  const barras = Object.entries(contagens)
    .map(([id, quantidade]) => ({ id, rotulo: id, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade || a.id.localeCompare(b.id))
    .slice(0, MAX_BARRAS_UF);
  const maior = Math.max(1, ...barras.map((b) => b.quantidade));
  return (
    <ul className="-mx-2 flex flex-col">
      {barras.map((barra) => {
        const quantidade = barra.quantidade;
        const selecionada = ativas.includes(barra.id);
        const largura = quantidade === 0 ? 0 : Math.max(4, Math.round((quantidade / maior) * 100));
        return (
          <li key={barra.id}>
            <button
              type="button"
              onClick={() => aoEscolher(barra.id)}
              aria-pressed={selecionada}
              aria-label={`${barra.rotulo}: ${quantidade} ${quantidade === 1 ? "oportunidade" : "oportunidades"}`}
              className="group grid min-h-11 w-full grid-cols-[5.5rem_minmax(0,1fr)_2.25rem] items-center gap-2 rounded-control px-2 text-xs outline-none transition-colors hover:bg-raised focus-visible:ring-2 focus-visible:ring-brand md:min-h-8"
            >
              <span className={cn("truncate text-left", selecionada ? "font-semibold text-ink" : "text-muted-foreground")}>
                {barra.rotulo}
              </span>
              <span aria-hidden="true" className="h-1 min-w-0 overflow-hidden rounded-full bg-raised">
                <span
                  className={cn(
                    "block h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none",
                    selecionada ? "bg-ink" : "bg-ink/35 group-hover:bg-ink/60",
                  )}
                  style={{ width: `${largura}%` }}
                />
              </span>
              <span className={cn("text-right tabular-nums", selecionada ? "font-semibold text-ink" : "text-ink")}>
                {quantidade.toLocaleString("pt-BR")}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Desktop: célula da faixa. No celular ela some e "Por estado" vira um bloco recolhido abaixo da faixa. */
function CelulaRegiao(props: PropsRegiao) {
  return (
    <div role="group" aria-label="Oportunidades por estado" className={cn(CELULA, "gap-2 max-md:hidden", COLUNAS_REGIAO)}>
      <span className="truncate text-sm text-muted-foreground">Por estado</span>
      <ListaRegiao {...props} />
    </div>
  );
}

/** Celular: "Por estado" recolhido, abre num toque. */
function RegiaoRecolhida(props: PropsRegiao) {
  const filtradas = props.ativas.length;
  return (
    <details className="group rounded-card border border-border bg-surface md:hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          Por estado
          {filtradas > 0 ? (
            <span className="rounded-full bg-pill-neutral-bg px-2 py-0.5 text-xs font-medium text-pill-neutral-fg">
              {filtradas} {filtradas === 1 ? "filtrado" : "filtrados"}
            </span>
          ) : null}
        </span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="px-3 pb-2">
        <ListaRegiao {...props} />
      </div>
    </details>
  );
}

interface Props {
  painel: PainelDia;
  /** Meta da semana; null quando não foi possível ler */
  meta?: PainelMeta | null;
  contagensUf: Record<string, number>;
  ufsAtivas: ReadonlyArray<string>;
  /** Uma navegação está em andamento: o painel fica esmaecido */
  ocupado?: boolean;
  aoVerNovas: () => void;
  aoVerEncerrando: () => void;
  aoVerSinalAlto: () => void;
  aoVerValor: () => void;
  aoEscolherUf: (uf: string) => void;
}

/**
 * Resumo do dia que abre o Radar: meta numa linha, faixa de indicadores clicáveis (4 no celular, 6 no desktop)
 * que aplicam o filtro ou a ordem correspondente na lista, e "Por estado" recolhido no celular.
 */
export function PainelDiaView({
  painel,
  meta = null,
  contagensUf,
  ufsAtivas,
  ocupado = false,
  aoVerNovas,
  aoVerEncerrando,
  aoVerSinalAlto,
  aoVerValor,
  aoEscolherUf,
}: Props) {
  const { oculto, alternar } = useResumoOculto();
  const novasDisponiveis = painel.temPublicacao;
  const semNovidade = novasDisponiveis && painel.novas24h === 0;

  return (
    <section aria-label="Resumo do dia" data-tour="radar-painel" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Resumo do dia</h2>
        <button
          type="button"
          onClick={alternar}
          aria-expanded={!oculto}
          className="inline-flex h-11 items-center gap-1.5 rounded-control px-2 text-xs font-medium text-muted-foreground outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand md:h-9"
        >
          {oculto ? "Mostrar resumo" : "Ocultar resumo"}
          {oculto ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronUp className="size-4" aria-hidden="true" />}
        </button>
      </div>

      {oculto || !meta ? null : <MetaSemana painel={meta} compacta />}

      {oculto ? null : painel.abertas === 0 ? (
        <p className="rounded-card border border-dashed border-control px-4 py-4 text-center text-sm text-muted-foreground">
          Nenhuma oportunidade aberta agora.
        </p>
      ) : (
        <div className={cn("flex flex-col gap-3 transition-opacity duration-200", ocupado && "opacity-60")}>
          <Entrada className={GRADE_PAINEL}>
            <CelulaBotao
              aoClicar={aoVerNovas}
              rotuloAria={
                novasDisponiveis
                  ? `Novas nas últimas 24 horas: ${painel.novas24h}. Ver as mais recentes`
                  : "Novas: data de publicação indisponível. Ver as mais recentes"
              }
            >
              <Indicador
                rotulo="Novas 24h"
                numero={novasDisponiveis ? <Numero valor={painel.novas24h} /> : "—"}
                discreto={!novasDisponiveis}
                contexto={
                  !novasDisponiveis
                    ? "Sem data de publicação"
                    : semNovidade
                      ? "Nada novo hoje"
                      : `${painel.novasHoje} hoje · ${painel.novasOntem} ontem`
                }
              />
            </CelulaBotao>

            <CelulaBotao aoClicar={aoVerEncerrando} rotuloAria={`Fecham em até 48 horas: ${painel.encerram48h}. Ver por prazo`}>
              <Indicador
                rotulo="Fecham 48h"
                numero={<Numero valor={painel.encerram48h} />}
                destaque={painel.encerram48h > 0}
                contexto={`${painel.encerramSemana} na semana`}
              />
            </CelulaBotao>

            <CelulaBotao aoClicar={aoVerSinalAlto} rotuloAria={`Para você, com sinal alto: ${painel.sinalAlto}. Ver por nota`}>
              <Indicador rotulo="Para você" numero={<Numero valor={painel.sinalAlto} />} contexto="com sinal alto" />
            </CelulaBotao>

            <CelulaBotao
              aoClicar={aoVerValor}
              rotuloAria={`Valor em jogo: ${formatarValorCompacto(painel.valorTotal)}. Ver por maior valor`}
              className="max-md:hidden"
            >
              <Indicador
                rotulo="Valor em jogo"
                numero={<Numero valor={painel.valorTotal} formatar={formatarValorCompacto} />}
                contexto={`em ${painel.abertas.toLocaleString("pt-BR")} ${painel.abertas === 1 ? "aberta" : "abertas"}`}
              />
            </CelulaBotao>

            <CelulaRegiao contagens={contagensUf} ativas={ufsAtivas} aoEscolher={aoEscolherUf} />

            <Link href="/pipeline" className={cn(CELULA, CELULA_CLICAVEL, COLUNAS_PIPELINE)}>
              <Indicador
                rotulo="Pipeline"
                numero={painel.pipeline ? <Numero valor={painel.pipeline.ativas} /> : "—"}
                discreto={!painel.pipeline}
                contexto={
                  painel.pipeline
                    ? painel.pipeline.emDisputa > 0
                      ? `${painel.pipeline.emDisputa} em disputa`
                      : "nenhum em disputa"
                    : "Abrir o pipeline"
                }
              />
            </Link>
          </Entrada>
          <RegiaoRecolhida contagens={contagensUf} ativas={ufsAtivas} aoEscolher={aoEscolherUf} />
        </div>
      )}
    </section>
  );
}
