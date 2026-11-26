"use client";

import { useCallback, useEffect, useMemo, useOptimistic, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { definirResponsavelAction, moverEtapa, removerDoPipeline } from "@/app/(app)/pipeline/actions";
import { frasePrazoEncerrado } from "@/core/encerradas";
import type { PainelMeta } from "@/core/meta";
import { useAgora } from "@/lib/relogio";
import { MetaSemana } from "@/components/meta/meta-semana";
import { Segmentado, TRILHO_SEGMENTADO, classeItemSegmentado } from "@/components/ui/segmentado";
import { useFaixaRolavel } from "@/components/ui/usar-faixa-rolavel";
import { cn } from "@/lib/utils";
import { AdicionarPeloLink } from "./adicionar-pelo-link";
import { BlocoErro } from "./bloco-erro";
import { Coluna } from "./coluna";
import { FaixaPrazo } from "./faixa-prazo";
import { FolhaFechamento, type FechamentoPendente } from "./folha-fechamento";
import { linhaDeNumeros } from "./formato";
import { ListaPorPrazo } from "./lista-por-prazo";
import { useColunas } from "./midia";
import {
  ETAPAS,
  TODAS_AS_UFS,
  contarPorUf,
  ehMeu,
  filtrarPorUf,
  montarResumo,
  ufsDoFiltro,
  type EtapaId,
  type FiltroUfPipeline,
  type ItemPipeline,
  type PessoaPipeline,
  type ResumoEncerrada,
} from "./tipos";

/** Troca parâmetros da URL sem navegar, preservando os demais; valor null remove o parâmetro. */
/** "quadro" (colunas por etapa) ou "prazo" (lista única agrupada por dia). */
export type VistaPipeline = "quadro" | "prazo";

const OPCOES_VISTA: ReadonlyArray<{ valor: VistaPipeline; rotulo: string }> = [
  { valor: "quadro", rotulo: "Quadro" },
  { valor: "prazo", rotulo: "Por prazo" },
];

const CHAVE_PREFERENCIA = "foxlicita:pipeline-preferencia";
const EVENTO_PREFERENCIA = "foxlicita:pipeline-preferencia-mudou";

interface PreferenciaPipeline {
  vista: VistaPipeline;
  soMeus: boolean;
}

function lerPreferenciaBruta(): string {
  try {
    return window.localStorage.getItem(CHAVE_PREFERENCIA) ?? "";
  } catch {
    return "";
  }
}

function assinarPreferencia(aviso: () => void): () => void {
  window.addEventListener("storage", aviso);
  window.addEventListener(EVENTO_PREFERENCIA, aviso);
  return () => {
    window.removeEventListener("storage", aviso);
    window.removeEventListener(EVENTO_PREFERENCIA, aviso);
  };
}

function interpretarPreferencia(bruto: string): PreferenciaPipeline | null {
  if (bruto === "") return null;
  try {
    const dados: unknown = JSON.parse(bruto);
    if (typeof dados !== "object" || dados === null) return null;
    const vista: unknown = Reflect.get(dados, "vista");
    const soMeus: unknown = Reflect.get(dados, "soMeus");
    if ((vista !== "quadro" && vista !== "prazo") || typeof soMeus !== "boolean") return null;
    return { vista, soMeus };
  } catch {
    return null;
  }
}

/** Vista e "Só os meus" lembrados neste aparelho; null sem escolha guardada ou com o armazenamento bloqueado. */
function usePreferenciaGuardada(ativa: boolean): PreferenciaPipeline | null {
  const bruto = useSyncExternalStore(assinarPreferencia, lerPreferenciaBruta, () => "");
  return ativa ? interpretarPreferencia(bruto) : null;
}

function guardarPreferencia(p: PreferenciaPipeline) {
  try {
    window.localStorage.setItem(CHAVE_PREFERENCIA, JSON.stringify(p));
  } catch {
    // Armazenamento bloqueado: a escolha só não fica lembrada.
  }
  window.dispatchEvent(new Event(EVENTO_PREFERENCIA));
}

function atualizarUrl(mudancas: Record<string, string | null>) {
  const params = new URLSearchParams(window.location.search);
  for (const [chave, valor] of Object.entries(mudancas)) {
    if (valor === null) params.delete(chave);
    else params.set(chave, valor);
  }
  const texto = params.toString();
  window.history.replaceState(null, "", window.location.pathname + (texto === "" ? "" : "?" + texto));
}

type Acao =
  | { tipo: "mover"; id: string; etapa: EtapaId }
  | { tipo: "remover"; id: string }
  | { tipo: "responsavel"; id: string; responsavelId: string | null; nome: string | null };

function reduzir(estado: ItemPipeline[], acao: Acao): ItemPipeline[] {
  if (acao.tipo === "remover") return estado.filter((i) => i.id !== acao.id);
  if (acao.tipo === "responsavel") {
    return estado.map((i) =>
      i.id === acao.id ? { ...i, responsavelId: acao.responsavelId, responsavelNome: acao.nome } : i,
    );
  }
  const maior = estado
    .filter((i) => i.etapa === acao.etapa && i.id !== acao.id)
    .reduce((m, i) => Math.max(m, i.ordem), 0);
  return estado.map((i) => (i.id === acao.id ? { ...i, etapa: acao.etapa, ordem: maior + 1 } : i));
}

interface Props {
  /** null quando a leitura do banco falhou. Já sem as licitações encerradas. */
  itens: ItemPipeline[] | null;
  /** Licitações que passaram do prazo e saíram do quadro; só entram na linha de aviso */
  encerradas: ResumoEncerrada[];
  etapaInicial: EtapaId;
  ufInicial: FiltroUfPipeline;
  /** Vista guardada na URL (?vista=prazo); por padrão, o quadro */
  vistaInicial: VistaPipeline;
  /** UFs das áreas da empresa, para os chips do filtro */
  ufsDasAreas: string[];
  agoraInicial: number;
  usuarioId: string;
  /** Pessoas ativas que podem assumir um item */
  pessoas: PessoaPipeline[];
  /** Tem "editar_propostas": a faixa de prazos oferece "Fazer proposta" */
  podeCriarProposta: boolean;
  /** Quem só consulta não vê os controles de mover, remover, responsável e notas */
  podeEditar: boolean;
  /** Pode marcar o checklist da revisão jurídica */
  podeRevisar: boolean;
  /** Dono vê o Pipeline como sempre; quem opera abre em "Por prazo" com "Só os meus" */
  ehDono: boolean;
  /** Meta da semana; null quando não foi possível ler */
  meta: PainelMeta | null;
}

export function PipelineView({ itens: itensServidor, encerradas, etapaInicial, ufInicial, vistaInicial, ufsDasAreas, agoraInicial, usuarioId, pessoas, podeCriarProposta, podeEditar, podeRevisar, ehDono, meta }: Props) {
  if (itensServidor === null) {
    return (
      <div data-largura-total className="flex flex-col gap-4 lg:gap-6">
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Pipeline</h1>
        <BlocoErro />
      </div>
    );
  }
  return (
    <Quadro
      itensServidor={itensServidor}
      encerradas={encerradas}
      etapaInicial={etapaInicial}
      ufInicial={ufInicial}
      vistaInicial={vistaInicial}
      ufsDasAreas={ufsDasAreas}
      agoraInicial={agoraInicial}
      usuarioId={usuarioId}
      pessoas={pessoas}
      podeCriarProposta={podeCriarProposta}
      podeEditar={podeEditar}
      podeRevisar={podeRevisar}
      ehDono={ehDono}
      meta={meta}
    />
  );
}

function Quadro({
  itensServidor,
  encerradas,
  etapaInicial,
  ufInicial,
  vistaInicial,
  ufsDasAreas,
  agoraInicial,
  usuarioId,
  pessoas,
  podeCriarProposta,
  podeEditar,
  podeRevisar,
  ehDono,
  meta,
}: {
  itensServidor: ItemPipeline[];
  encerradas: ResumoEncerrada[];
  etapaInicial: EtapaId;
  ufInicial: FiltroUfPipeline;
  vistaInicial: VistaPipeline;
  ufsDasAreas: string[];
  agoraInicial: number;
  usuarioId: string;
  pessoas: PessoaPipeline[];
  podeCriarProposta: boolean;
  podeEditar: boolean;
  podeRevisar: boolean;
  ehDono: boolean;
  /** Meta da semana; null quando não foi possível ler */
  meta: PainelMeta | null;
}) {
  const [todos, aplicar] = useOptimistic(itensServidor, reduzir);
  const [uf, setUf] = useState<FiltroUfPipeline>(ufInicial);
  // Quem opera (gestor) abre em "Por prazo" com "Só os meus" ligado, até escolher outra coisa neste aparelho.
  const guardada = usePreferenciaGuardada(!ehDono);
  const [vistaEscolhida, setVistaEscolhida] = useState<VistaPipeline | null>(null);
  const [soMeusEscolhido, setSoMeusEscolhido] = useState<boolean | null>(null);
  const vista: VistaPipeline = vistaEscolhida ?? (ehDono || vistaInicial === "prazo" ? vistaInicial : (guardada?.vista ?? "prazo"));
  const soMeus: boolean = soMeusEscolhido ?? (ehDono ? false : (guardada?.soMeus ?? true));
  const agora = useAgora(null, agoraInicial);
  const [abertas, setAbertas] = useState<ReadonlySet<EtapaId>>(() => new Set());
  const [bordas, setBordas] = useState({ esquerda: false, direita: false });
  const doUsuario = useMemo(() => (soMeus ? todos.filter((i) => ehMeu(i, usuarioId)) : todos), [todos, soMeus, usuarioId]);
  const contagemUf = useMemo(() => contarPorUf(doUsuario), [doUsuario]);
  const opcoesUf = useMemo(
    () => [
      { valor: TODAS_AS_UFS, rotulo: "Todas" },
      ...ufsDoFiltro(ufsDasAreas, todos).map((u) => ({ valor: u, rotulo: u })),
    ],
    [ufsDasAreas, todos],
  );
  const itens = useMemo(() => filtrarPorUf(doUsuario, uf), [doUsuario, uf]);
  const totalEncerradas = useMemo(
    () =>
      encerradas.filter(
        (e) => (!soMeus || ehMeu(e, usuarioId)) && (uf === TODAS_AS_UFS || e.uf.trim().toUpperCase() === uf),
      ).length,
    [encerradas, soMeus, uf, usuarioId],
  );
  const [, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [fechamento, setFechamento] = useState<FechamentoPendente | null>(null);
  const [aba, setAba] = useState<EtapaId>(etapaInicial);
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<EtapaId | null>(null);
  const colunas = useColunas();
  const trilho = useRef<HTMLDivElement | null>(null);
  const tablist = useRef<HTMLDivElement | null>(null);
  const faixaDasAbas = useFaixaRolavel<HTMLDivElement>();
  const ligarTablist = useCallback(
    (no: HTMLDivElement | null) => {
      tablist.current = no;
      return faixaDasAbas(no);
    },
    [faixaDasAbas],
  );
  const abaInicial = useRef(etapaInicial);
  /** Etapa para a qual um toque numa aba está rolando: a rolagem não deve trocar a aba no caminho. */
  const destino = useRef<EtapaId | null>(null);
  const pausa = useRef<number | undefined>(undefined);
  const limpeza = useRef<number | undefined>(undefined);

  const resumo = useMemo(
    () => montarResumo(itens.map((i) => ({ etapa: i.etapa, quantidade: 1, valor: i.item.valorEstimado }))),
    [itens],
  );

  const porEtapa = useMemo(() => {
    const mapa = new Map<EtapaId, ItemPipeline[]>(ETAPAS.map((e) => [e.id, []]));
    for (const i of itens) mapa.get(i.etapa)?.push(i);
    for (const lista of mapa.values()) lista.sort((a, b) => a.ordem - b.ordem);
    return mapa;
  }, [itens]);

  function mover(id: string, etapa: EtapaId) {
    const atual = todos.find((i) => i.id === id);
    if (!atual || atual.etapa === etapa) return;
    setErro(null);
    iniciar(async () => {
      aplicar({ tipo: "mover", id, etapa });
      const r = await moverEtapa(id, etapa);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      // Ganha ou Perdida: abre a folha para registrar o valor homologado, o custo real ou o motivo.
      if (etapa === "ganha" || etapa === "perdida") {
        setFechamento({
          itemId: id,
          etapa,
          titulo: atual.item.objeto,
          valorSugerido: atual.valorProposto ?? atual.item.valorEstimado,
          custoSugerido: atual.preco?.custoTotal ?? null,
        });
      }
    });
  }

  function trocarResponsavel(id: string, responsavelId: string | null) {
    const nome = pessoas.find((p) => p.id === responsavelId)?.nome ?? null;
    setErro(null);
    iniciar(async () => {
      aplicar({ tipo: "responsavel", id, responsavelId, nome });
      const r = await definirResponsavelAction(id, responsavelId);
      if (!r.ok) setErro(r.erro);
    });
  }

  function remover(id: string) {
    setErro(null);
    iniciar(async () => {
      aplicar({ tipo: "remover", id });
      const r = await removerDoPipeline(id);
      if (!r.ok) setErro(r.erro);
    });
  }

  function escolherAba(id: EtapaId) {
    setAba(id);
    atualizarUrl({ etapa: id });
  }

  function escolherVista(nova: VistaPipeline) {
    setVistaEscolhida(nova);
    atualizarUrl({ vista: nova === "prazo" ? "prazo" : null });
    if (!ehDono) guardarPreferencia({ vista: nova, soMeus });
  }

  function escolherSoMeus(novo: boolean) {
    setSoMeusEscolhido(novo);
    if (!ehDono) guardarPreferencia({ vista, soMeus: novo });
  }

  function escolherUf(id: FiltroUfPipeline) {
    setUf(id);
    atualizarUrl({ uf: id === TODAS_AS_UFS ? null : id });
  }

  function alternarColuna(id: EtapaId, aberta: boolean) {
    setAbertas((atual) => {
      const novo = new Set(atual);
      if (aberta) novo.add(id);
      else novo.delete(id);
      return novo;
    });
  }

  /** Mostra as setas só quando há coluna escondida de cada lado. */
  const medirBordas = useCallback(() => {
    const quadro = trilho.current;
    if (!quadro) return;
    const esquerda = quadro.scrollLeft > 1;
    const direita = quadro.scrollLeft + quadro.clientWidth < quadro.scrollWidth - 1;
    setBordas((atual) => (atual.esquerda === esquerda && atual.direita === direita ? atual : { esquerda, direita }));
  }, []);

  function rolarLado(sentido: 1 | -1) {
    const quadro = trilho.current;
    if (!quadro) return;
    quadro.scrollBy({ left: sentido * Math.max(300, quadro.clientWidth * 0.8), behavior: "smooth" });
  }

  /** Posição de rolagem do trilho em que a coluna da etapa fica inteira na vista. */
  function posicaoDa(id: EtapaId): number {
    const quadro = trilho.current;
    const indice = ETAPAS.findIndex((e) => e.id === id);
    const coluna = quadro?.children.item(indice);
    const primeira = quadro?.children.item(0);
    if (!(coluna instanceof HTMLElement) || !(primeira instanceof HTMLElement)) return 0;
    return coluna.offsetLeft - primeira.offsetLeft;
  }

  function tocarAba(id: EtapaId) {
    escolherAba(id);
    destino.current = id;
    window.clearTimeout(limpeza.current);
    limpeza.current = window.setTimeout(() => {
      destino.current = null;
    }, 700);
    trilho.current?.scrollTo({ left: posicaoDa(id), behavior: "smooth" });
  }

  /** Deslizar entre etapas no celular: quando a rolagem assenta, a aba acompanha a coluna à vista. */
  function aoRolar() {
    medirBordas();
    if (colunas) return;
    window.clearTimeout(pausa.current);
    pausa.current = window.setTimeout(() => {
      const quadro = trilho.current;
      if (!quadro) return;
      const passo = posicaoDa(ETAPAS[1].id);
      const indice = passo > 0 ? Math.round(quadro.scrollLeft / passo) : 0;
      const etapa = ETAPAS[Math.min(Math.max(indice, 0), ETAPAS.length - 1)];
      if (destino.current !== null) {
        if (destino.current === etapa.id) destino.current = null;
        return;
      }
      escolherAba(etapa.id);
    }, 100);
  }

  const ligarTrilho = useCallback((no: HTMLDivElement | null) => {
    trilho.current = no;
    if (!no) return;
    const indice = ETAPAS.findIndex((e) => e.id === abaInicial.current);
    const coluna = no.children.item(indice);
    const primeira = no.children.item(0);
    if (coluna instanceof HTMLElement && primeira instanceof HTMLElement) {
      no.scrollTo({ left: coluna.offsetLeft - primeira.offsetLeft, behavior: "instant" });
    }
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(pausa.current);
      window.clearTimeout(limpeza.current);
    },
    [],
  );

  const vazio = todos.length === 0;

  // Computador: a roda vertical do mouse rola o quadro na horizontal, exceto sobre uma lista que ainda rola.
  useEffect(() => {
    const quadro = trilho.current;
    if (!quadro || !colunas) return;
    function aoGirar(e: WheelEvent) {
      if (!quadro || e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const maximo = quadro.scrollWidth - quadro.clientWidth;
      const sentido = e.deltaY > 0 ? 1 : -1;
      if ((sentido > 0 && quadro.scrollLeft >= maximo - 1) || (sentido < 0 && quadro.scrollLeft <= 0)) return;
      let no = e.target instanceof Element ? e.target : null;
      while (no && no !== quadro) {
        if (no instanceof HTMLElement) {
          const eixo = getComputedStyle(no).overflowY;
          if ((eixo === "auto" || eixo === "scroll") && no.scrollHeight > no.clientHeight + 1) {
            const podeDescer = no.scrollTop + no.clientHeight < no.scrollHeight - 1;
            const podeSubir = no.scrollTop > 0;
            if ((sentido > 0 && podeDescer) || (sentido < 0 && podeSubir)) return;
          }
        }
        no = no.parentElement;
      }
      e.preventDefault();
      const fator = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? quadro.clientWidth : 1;
      quadro.scrollLeft += e.deltaY * fator;
    }
    quadro.addEventListener("wheel", aoGirar, { passive: false });
    const observador = new ResizeObserver(medirBordas);
    observador.observe(quadro);
    for (const coluna of Array.from(quadro.children)) observador.observe(coluna);
    return () => {
      quadro.removeEventListener("wheel", aoGirar);
      observador.disconnect();
    };
  }, [colunas, vazio, medirBordas]);

  // Mantém a aba ativa à vista na fileira de segmentos.
  useEffect(() => {
    const fileira = tablist.current;
    const botao = fileira?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!fileira || !botao) return;
    fileira.scrollTo({ left: botao.offsetLeft - (fileira.clientWidth - botao.offsetWidth) / 2, behavior: "smooth" });
  }, [aba]);

  function limparArraste() {
    setArrastandoId(null);
    setAlvo(null);
  }

  function soltar(id: string | null, etapa: EtapaId) {
    limparArraste();
    if (id !== null) mover(id, etapa);
  }

  return (
    <div
      data-largura-total
      className={cn(
        "flex min-w-0 flex-col gap-3",
        // A tela inteira é do Pipeline: o cabeçalho é enxuto e o quadro pega todo o resto da altura.
        vazio ? "" : "md:h-[calc(100dvh-9.5rem)] md:min-h-[28rem] lg:h-[calc(100dvh-5.5rem)]",
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[22px] font-semibold leading-tight text-ink">Pipeline</h1>
          <Link
            href="/conselheiro"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-control bg-brand-fill px-3 text-sm font-semibold text-black outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ground lg:hidden"
          >
            <Sparkles aria-hidden="true" className="size-4" />
            Conselheiro
          </Link>
        </div>
        <p className="text-[13px] tabular-nums text-muted-foreground">
          {linhaDeNumeros(resumo)}
          {totalEncerradas > 0 ? (
            <>
              {" · "}
              {frasePrazoEncerrado(totalEncerradas)}{" "}
              <Link
                href={uf === TODAS_AS_UFS ? "/encerradas" : `/encerradas?uf=${uf}`}
                className="font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
              >
                Ver encerradas
              </Link>
            </>
          ) : null}
        </p>
      </div>

      {vazio && podeEditar ? (
        <div className="flex flex-wrap gap-2">
          <AdicionarPeloLink />
        </div>
      ) : null}

      {meta && !vazio ? <MetaSemana painel={meta} compacta className="shrink-0" /> : null}

      {vazio ? null : <FaixaPrazo itens={itens} agora={agora} podeCriarProposta={podeCriarProposta} />}

      {vazio ? null : (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Segmentado
            rotulo="Estado"
            valor={uf}
            aoMudar={escolherUf}
            opcoes={opcoesUf.map((o) => ({ valor: o.valor, rotulo: o.rotulo, contagem: contagemUf[o.valor] ?? 0 }))}
            rolavel
            className="min-w-0 max-md:basis-full"
          />
          <div className="min-w-0 flex-1 max-md:hidden" aria-hidden="true" />
          <Segmentado rotulo="Vista" valor={vista} aoMudar={escolherVista} opcoes={OPCOES_VISTA} className="shrink-0" />
          <div className={cn(TRILHO_SEGMENTADO, "shrink-0")}>
            <button
              type="button"
              aria-pressed={soMeus}
              onClick={() => escolherSoMeus(!soMeus)}
              className={classeItemSegmentado(soMeus)}
            >
              Só os meus
            </button>
          </div>
          {podeEditar ? <AdicionarPeloLink /> : null}
        </div>
      )}

      {erro ? (
        <p
          role="alert"
          className="rounded-control border border-border bg-pill-neg-bg px-3 py-2 text-sm text-pill-neg-fg"
        >
          {erro}
        </p>
      ) : null}

      {todos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-control px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Seu pipeline está vazio. Salve oportunidades do Radar para acompanhá-las aqui.
          </p>
          <Link
            href="/radar"
            className="inline-flex h-11 items-center rounded-control bg-brand px-4 text-sm font-medium text-black outline-none focus-visible:ring-2 focus-visible:ring-ink md:h-9"
          >
            Ir para o Radar
          </Link>
        </div>
      ) : (
        <>
          {vista === "prazo" ? (
            <div className="min-w-0 md:min-h-0 md:flex-1 md:overflow-y-auto">
              <ListaPorPrazo itens={itens} agora={agora} />
            </div>
          ) : null}
          <div
            ref={ligarTablist}
            role="tablist"
            aria-label="Etapas"
            hidden={vista === "prazo"}
            className="sem-barra relative -mx-4 flex gap-1 overflow-x-auto px-4 md:hidden"
          >
            {ETAPAS.map((e) => {
              const ativa = aba === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  role="tab"
                  aria-selected={ativa}
                  aria-controls={`coluna-${e.id}`}
                  onClick={() => tocarAba(e.id)}
                  className={cn(
                    "flex h-11 shrink-0 items-center gap-2 rounded-control px-3 text-sm whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-brand",
                    ativa ? "bg-active font-medium text-ink" : "text-muted-foreground",
                  )}
                >
                  {e.rotulo}
                  <span className="text-xs tabular-nums">{resumo.porEtapa[e.id].quantidade}</span>
                </button>
              );
            })}
          </div>

          <div data-tour="pipeline-colunas" hidden={vista === "prazo"} className="relative min-w-0 md:min-h-0 md:flex-1">
          {colunas && bordas.esquerda ? (
            <button
              type="button"
              aria-label="Rolar o quadro para a esquerda"
              onClick={() => rolarLado(-1)}
              className="absolute top-2 left-1 z-10 inline-flex size-8 items-center justify-center rounded-full border border-control bg-surface text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand"
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
          ) : null}
          {colunas && bordas.direita ? (
            <button
              type="button"
              aria-label="Rolar o quadro para a direita"
              onClick={() => rolarLado(1)}
              className="absolute top-2 right-1 z-10 inline-flex size-8 items-center justify-center rounded-full border border-control bg-surface text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand"
            >
              <ChevronRight aria-hidden="true" className="size-5" />
            </button>
          ) : null}
          <div
            ref={ligarTrilho}
            onScroll={aoRolar}
            data-esquerda={bordas.esquerda}
            data-direita={bordas.direita}
            className="trilho-rolagem relative flex min-w-0 snap-x snap-mandatory items-start gap-3 overflow-x-auto md:h-full md:snap-none md:items-stretch md:pb-2"
          >
            {ETAPAS.map((e) => (
              <Coluna
                key={e.id}
                etapa={e.id}
                rotulo={e.rotulo}
                itens={porEtapa.get(e.id) ?? []}
                resumo={resumo.porEtapa[e.id]}
                ativaNoTelefone={aba === e.id}
                colunas={colunas}
                aberta={abertas.has(e.id)}
                aoAlternar={alternarColuna}
                agoraInicial={agoraInicial}
                agora={agora}
                pessoas={pessoas}
                aoResponsavel={trocarResponsavel}
                podeEditar={podeEditar}
                podeRevisar={podeRevisar}
                arrastandoId={arrastandoId}
                alvo={alvo === e.id}
                aoEntrarNoAlvo={setAlvo}
                aoSairDoAlvo={() => setAlvo(null)}
                aoSoltar={soltar}
                aoIniciarArraste={setArrastandoId}
                aoTerminarArraste={limparArraste}
                aoMover={mover}
                aoRemover={remover}
              />
            ))}
          </div>
          </div>
        </>
      )}
      <FolhaFechamento pendente={fechamento} aoFechar={() => setFechamento(null)} />
    </div>
  );
}
