"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AlarmClock, ChevronDown, ChevronUp, Coins, MapPin, Sparkles, SquareKanban, Target } from "lucide-react";
import type { FiltroRegiao } from "@/lib/radar-filtros";
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

type Tom = "novas" | "encerrando" | "sinal" | "valor" | "regiao" | "pipeline";

/** Círculo do ícone: fundo da cor a 15% e ícone na cor do texto, legível nos dois temas. */
const CIRCULO: Record<Tom, string> = {
  novas: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  encerrando: "bg-brand-fill/15 text-brand",
  sinal: "bg-go/15 text-positive",
  valor: "bg-atencao/15 text-warning",
  regiao: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  pipeline: "bg-control text-ink",
};

const CARTAO_BASE =
  "card-entrada flex min-h-[116px] min-w-0 flex-col gap-2 rounded-card border border-border bg-surface p-3.5 text-left outline-none md:p-4";
const CARTAO_CLICAVEL =
  "transition-colors hover:bg-raised focus-visible:ring-2 focus-visible:ring-brand active:bg-raised";

function Cabecalho({ tom, icone, rotulo, pulsar = false }: { tom: Tom; icone: React.ReactNode; rotulo: string; pulsar?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", CIRCULO[tom], pulsar && "painel-pulso")}
      >
        {icone}
      </span>
      <span className="min-w-0 text-xs leading-tight font-medium text-muted-foreground">{rotulo}</span>
    </span>
  );
}

function Corpo({ numero, sub }: { numero: React.ReactNode; sub: string }) {
  return (
    <span className="mt-auto flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-2xl leading-none font-semibold tabular-nums text-ink">{numero}</span>
      <span className="truncate text-xs text-muted-foreground">{sub}</span>
    </span>
  );
}

function CartaoBotao({
  indice,
  aoClicar,
  rotuloAria,
  children,
}: {
  indice: number;
  aoClicar: () => void;
  rotuloAria: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-label={rotuloAria}
      style={{ "--i": indice } as React.CSSProperties}
      className={cn(CARTAO_BASE, CARTAO_CLICAVEL)}
    >
      {children}
    </button>
  );
}

const BARRAS_REGIAO: ReadonlyArray<{ id: FiltroRegiao; rotulo: string }> = [
  { id: "nova-iguacu", rotulo: "Nova Iguaçu" },
  { id: "baixada", rotulo: "Baixada" },
  { id: "capital", rotulo: "Capital" },
  { id: "interior", rotulo: "Interior RJ" },
];

function CartaoRegiao({
  indice,
  contagens,
  ativa,
  aoEscolher,
}: {
  indice: number;
  contagens: Record<FiltroRegiao, number>;
  ativa: FiltroRegiao;
  aoEscolher: (regiao: FiltroRegiao) => void;
}) {
  const maior = Math.max(1, ...BARRAS_REGIAO.map((b) => contagens[b.id]));
  return (
    <div
      role="group"
      aria-label="Oportunidades por região"
      style={{ "--i": indice } as React.CSSProperties}
      className={cn(CARTAO_BASE, "gap-1.5", COLUNAS_REGIAO)}
    >
      <Cabecalho tom="regiao" icone={<MapPin className="size-4" />} rotulo="Por região" />
      <ul className="mt-auto flex flex-col">
        {BARRAS_REGIAO.map((barra) => {
          const quantidade = contagens[barra.id];
          const selecionada = ativa === barra.id;
          const largura = quantidade === 0 ? 0 : Math.max(6, Math.round((quantidade / maior) * 100));
          return (
            <li key={barra.id}>
              <button
                type="button"
                onClick={() => aoEscolher(barra.id)}
                aria-pressed={selecionada}
                aria-label={`${barra.rotulo}: ${quantidade} ${quantidade === 1 ? "oportunidade" : "oportunidades"}`}
                className="group grid h-8 w-full grid-cols-[5.25rem_minmax(0,1fr)_2.25rem] items-center gap-2 rounded-control px-1 text-xs outline-none transition-colors hover:bg-raised focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className={cn("truncate text-left", selecionada ? "font-semibold text-ink" : "text-muted-foreground")}>
                  {barra.rotulo}
                </span>
                <span aria-hidden="true" className="h-1.5 min-w-0 overflow-hidden rounded-full bg-control">
                  <span
                    className={cn(
                      "block h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none",
                      selecionada ? "bg-brand-fill" : "bg-brand-fill/45 group-hover:bg-brand-fill/70",
                    )}
                    style={{ width: `${largura}%` }}
                  />
                </span>
                <span className="text-right font-medium tabular-nums text-ink">{quantidade.toLocaleString("pt-BR")}</span>
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
  contagensRegiao: Record<FiltroRegiao, number>;
  regiaoAtiva: FiltroRegiao;
  /** Uma navegação está em andamento: o painel fica esmaecido */
  ocupado?: boolean;
  aoVerNovas: () => void;
  aoVerEncerrando: () => void;
  aoVerSinalAlto: () => void;
  aoVerValor: () => void;
  aoEscolherRegiao: (regiao: FiltroRegiao) => void;
}

/** Resumo do dia que abre o Radar: cartões clicáveis que aplicam o filtro ou a ordem correspondente na lista. */
export function PainelDiaView({
  painel,
  contagensRegiao,
  regiaoAtiva,
  ocupado = false,
  aoVerNovas,
  aoVerEncerrando,
  aoVerSinalAlto,
  aoVerValor,
  aoEscolherRegiao,
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

      {oculto ? null : painel.abertas === 0 ? (
        <p className="rounded-card border border-dashed border-control px-4 py-6 text-center text-sm text-muted-foreground">
          Nada novo hoje. Quando entrar alguma oportunidade, o resumo aparece aqui.
        </p>
      ) : (
        <div className={cn(GRADE_PAINEL, "transition-opacity duration-200", ocupado && "opacity-60")}>
          <CartaoBotao
            indice={0}
            aoClicar={aoVerNovas}
            rotuloAria={
              novasDisponiveis
                ? `Novas nas últimas 24 horas: ${painel.novas24h}. Ver as mais recentes`
                : "Novas: data de publicação indisponível. Ver as mais recentes"
            }
          >
            <Cabecalho tom="novas" icone={<Sparkles className="size-4" />} rotulo="Novas em 24 h" />
            <Corpo
              numero={novasDisponiveis ? <Numero valor={painel.novas24h} /> : "—"}
              sub={
                !novasDisponiveis
                  ? "Sem data de publicação"
                  : semNovidade
                    ? "Nada novo hoje"
                    : `${painel.novasHoje} hoje · ${painel.novasOntem} ontem`
              }
            />
          </CartaoBotao>

          <CartaoBotao
            indice={1}
            aoClicar={aoVerEncerrando}
            rotuloAria={`Fecham em até 48 horas: ${painel.encerram48h}. Ver por prazo`}
          >
            <Cabecalho
              tom="encerrando"
              icone={<AlarmClock className="size-4" />}
              rotulo="Fecham em 48 h"
              pulsar={painel.encerram48h > 0}
            />
            <Corpo numero={<Numero valor={painel.encerram48h} />} sub={`${painel.encerramSemana} na semana`} />
          </CartaoBotao>

          <CartaoBotao
            indice={2}
            aoClicar={aoVerSinalAlto}
            rotuloAria={`Para você, com sinal alto: ${painel.sinalAlto}. Ver por nota`}
          >
            <Cabecalho tom="sinal" icone={<Target className="size-4" />} rotulo="Para você" />
            <Corpo numero={<Numero valor={painel.sinalAlto} />} sub="com sinal alto" />
          </CartaoBotao>

          <CartaoBotao
            indice={3}
            aoClicar={aoVerValor}
            rotuloAria={`Valor em jogo: ${formatarValorCompacto(painel.valorTotal)}. Ver por maior valor`}
          >
            <Cabecalho tom="valor" icone={<Coins className="size-4" />} rotulo="Valor em jogo" />
            <Corpo
              numero={<Numero valor={painel.valorTotal} formatar={formatarValorCompacto} />}
              sub={`em ${painel.abertas.toLocaleString("pt-BR")} ${painel.abertas === 1 ? "aberta" : "abertas"}`}
            />
          </CartaoBotao>

          <CartaoRegiao indice={4} contagens={contagensRegiao} ativa={regiaoAtiva} aoEscolher={aoEscolherRegiao} />

          <Link
            href="/pipeline"
            style={{ "--i": 5 } as React.CSSProperties}
            className={cn(CARTAO_BASE, CARTAO_CLICAVEL, COLUNAS_PIPELINE)}
          >
            <Cabecalho tom="pipeline" icone={<SquareKanban className="size-4" />} rotulo="Pipeline" />
            <Corpo
              numero={painel.pipeline ? <Numero valor={painel.pipeline.ativas} /> : "—"}
              sub={
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
