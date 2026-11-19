"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { MetaSemana } from "@/components/meta/meta-semana";
import type { PainelMeta } from "@/core/meta";
import { formatarValorCompacto, type PainelDia } from "@/lib/radar-painel";
import { cn } from "@/lib/utils";
import { COLUNAS_PIPELINE, COLUNAS_REGIAO, GRADE_PAINEL } from "./painel-esqueleto";

const CHAVE_OCULTO = "foxlicita:radar-resumo-oculto";
const EVENTO_OCULTO = "foxlicita:radar-resumo";
const DURACAO_CONTAGEM_MS = 700;

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

const CONSULTA_MOVIMENTO = "(prefers-reduced-motion: reduce)";

function assinarMovimento(aviso: () => void): () => void {
  const consulta = window.matchMedia(CONSULTA_MOVIMENTO);
  consulta.addEventListener("change", aviso);
  return () => consulta.removeEventListener("change", aviso);
}

function usaMovimentoReduzido(): boolean {
  return window.matchMedia(CONSULTA_MOVIMENTO).matches;
}

/** Número que sobe até o valor ao entrar e acompanha as mudanças. Sem animação, vale o valor na hora. */
function useContagem(alvo: number): number {
  const reduzir = useSyncExternalStore(assinarMovimento, usaMovimentoReduzido, () => false);
  const [exibido, definirExibido] = useState(alvo);
  const ultimo = useRef(alvo);
  const primeira = useRef(true);

  useEffect(() => {
    if (reduzir) {
      ultimo.current = alvo;
      primeira.current = false;
      return;
    }
    const de = primeira.current ? 0 : ultimo.current;
    primeira.current = false;
    if (de === alvo) return;
    const inicio = performance.now();
    let quadro = 0;
    const passo = (agora: number) => {
      const t = Math.min((agora - inicio) / DURACAO_CONTAGEM_MS, 1);
      const suave = 1 - Math.pow(1 - t, 3);
      const valor = t >= 1 ? alvo : de + (alvo - de) * suave;
      ultimo.current = valor;
      definirExibido(valor);
      if (t < 1) quadro = window.requestAnimationFrame(passo);
    };
    quadro = window.requestAnimationFrame(passo);
    return () => window.cancelAnimationFrame(quadro);
  }, [alvo, reduzir]);

  return reduzir ? alvo : exibido;
}

function Numero({ valor, formatar }: { valor: number; formatar?: (n: number) => string }) {
  const n = Math.round(useContagem(valor));
  return <span className="tabular-nums">{formatar ? formatar(n) : n.toLocaleString("pt-BR")}</span>;
}

const CELULA = "flex min-w-0 flex-col gap-1 bg-surface p-4 text-left outline-none";
const CELULA_CLICAVEL =
  "transition-colors hover:bg-raised focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand active:bg-raised";

/** Indicador: legenda curta, número grande tabular e contexto. Só "Fecham em 48 h" leva o laranja. */
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
      <span className="truncate text-sm text-muted-foreground">{rotulo}</span>
      <span
        className={cn(
          "truncate text-3xl leading-tight font-semibold tabular-nums",
          destaque ? "text-brand" : discreto ? "text-muted-foreground" : "text-ink",
        )}
      >
        {numero}
      </span>
      <span className="truncate text-xs text-muted-foreground">{contexto}</span>
    </>
  );
}

function CelulaBotao({
  aoClicar,
  rotuloAria,
  children,
}: {
  aoClicar: () => void;
  rotuloAria: string;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={aoClicar} aria-label={rotuloAria} className={cn(CELULA, CELULA_CLICAVEL)}>
      {children}
    </button>
  );
}

const MAX_BARRAS_UF = 4;

function CelulaRegiao({
  contagens,
  ativas,
  aoEscolher,
}: {
  contagens: Record<string, number>;
  ativas: ReadonlyArray<string>;
  aoEscolher: (uf: string) => void;
}) {
  const barras = Object.entries(contagens)
    .map(([id, quantidade]) => ({ id, rotulo: id, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade || a.id.localeCompare(b.id))
    .slice(0, MAX_BARRAS_UF);
  const maior = Math.max(1, ...barras.map((b) => b.quantidade));
  return (
    <div role="group" aria-label="Oportunidades por estado" className={cn(CELULA, "gap-2", COLUNAS_REGIAO)}>
      <span className="truncate text-sm text-muted-foreground">Por estado</span>
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
                className="group grid min-h-8 w-full grid-cols-[5.5rem_minmax(0,1fr)_2.25rem] items-center gap-2 rounded-control px-2 text-xs outline-none transition-colors hover:bg-raised focus-visible:ring-2 focus-visible:ring-brand"
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
    </div>
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

/** Resumo do dia que abre o Radar: faixa de indicadores clicáveis que aplicam o filtro ou a ordem correspondente na lista. */
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
    <section aria-label="Resumo do dia" className="flex flex-col gap-3">
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

      {oculto || !meta ? null : <MetaSemana painel={meta} />}

      {oculto ? null : painel.abertas === 0 ? (
        <p className="rounded-card border border-dashed border-control px-4 py-6 text-center text-sm text-muted-foreground">
          Nada novo hoje. Quando entrar alguma oportunidade, o resumo aparece aqui.
        </p>
      ) : (
        <div className={cn(GRADE_PAINEL, "transition-opacity duration-200", ocupado && "opacity-60")}>
          <CelulaBotao
            aoClicar={aoVerNovas}
            rotuloAria={
              novasDisponiveis
                ? `Novas nas últimas 24 horas: ${painel.novas24h}. Ver as mais recentes`
                : "Novas: data de publicação indisponível. Ver as mais recentes"
            }
          >
            <Indicador
              rotulo="Novas em 24 h"
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
              rotulo="Fecham em 48 h"
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
        </div>
      )}
    </section>
  );
}
