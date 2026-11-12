"use client";

import { useCallback, useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { atualizarRadarAgora, definirFrente } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { recomendar } from "@/core/recomendacao";
import type { Frente, ModalidadeId, OportunidadeComScore, RespostaRadar } from "@/core/types";
import { formatarHora } from "@/lib/formato";
import {
  COOKIE_VISAO,
  ABA_PADRAO,
  FILTROS_PADRAO,
  POR_PAGINA,
  contarPorRegiao,
  ehVisao,
  filtrar,
  filtrarEOrdenar,
  fraseRecomendadas,
  fraseResumo,
  fraseVazio,
  lerAba,
  lerFiltros,
  lerPagina,
  resumir,
  type Aba,
  type FiltroModalidade,
  type FiltroRegiao,
  type Ordem,
  type Visao,
} from "@/lib/radar-filtros";
import { useAgora } from "@/lib/relogio";
import { cn } from "@/lib/utils";
import { CardOportunidade } from "./card-oportunidade";
import { DetalheSheet } from "./detalhe-sheet";
import { AvisoFalhaParcial, EstadoErro, EstadoVazio } from "./estados";
import { BarraFiltros } from "./filtros";
import { CabecalhoLista, LinhaOportunidade } from "./linha-oportunidade";
import { Paginacao } from "./paginacao";
import { SeletorAba } from "./seletor-aba";
import { SeletorFrente } from "./seletor-frente";

function textoFalhas(falhas: ReadonlyArray<ModalidadeId>): string | null {
  const pregao = falhas.includes(6);
  const dispensa = falhas.includes(8);
  if (pregao && dispensa) return "O PNCP não entregou tudo agora; a lista pode estar incompleta.";
  if (pregao) return "Parte dos pregões não carregou agora; a lista pode estar incompleta.";
  if (dispensa) return "Parte das dispensas não carregou agora; a lista pode estar incompleta.";
  return null;
}

type ChaveParametro = "regiao" | "modalidade" | "ordem" | "ver" | "pagina" | "aba";

/** Troca parâmetros da URL sem navegar; o Next sincroniza useSearchParams com o histórico. */
function alterarUrl(mudancas: ReadonlyArray<readonly [ChaveParametro, string | null]>): void {
  const proximos = new URLSearchParams(window.location.search);
  for (const [chave, valor] of mudancas) {
    if (valor === null) proximos.delete(chave);
    else proximos.set(chave, valor);
  }
  const consulta = proximos.toString();
  window.history.replaceState(null, "", consulta ? `?${consulta}` : window.location.pathname);
}

interface Props {
  frente: Frente;
  /** null quando a busca falhou */
  resposta: RespostaRadar | null;
  /** Visualização salva em cookie; vale quando a URL não traz ?ver= */
  visaoInicial: Visao;
  /** Ponto de inserção no detalhe, antes de "Abrir no PNCP" (ex.: "Salvar no pipeline"). */
  renderAcoes?: (item: OportunidadeComScore) => React.ReactNode;
}

export function RadarView({ frente, resposta, visaoInicial, renderAcoes }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const filtros = useMemo(() => lerFiltros(params), [params]);
  const aba = lerAba(params);
  const paraVoce = aba === "para-voce";
  const verParametro = params.get("ver");
  const visao: Visao = ehVisao(verParametro) ? verParametro : visaoInicial;
  const paginaPedida = lerPagina(params);

  const [pendente, iniciar] = useTransition();
  const [frenteOtimista, definirFrenteOtimista] = useOptimistic(frente);

  const [aberta, setAberta] = useState<OportunidadeComScore | null>(null);
  const [detalheAberto, setDetalheAberto] = useState(false);
  const topoRef = useRef<HTMLDivElement>(null);
  const rolarAoTrocar = useRef(false);

  const lista = useMemo(() => resposta?.oportunidades ?? [], [resposta]);
  const agoraInicial = useMemo(() => {
    const t = resposta ? Date.parse(resposta.atualizadoEm) : Number.NaN;
    return Number.isNaN(t) ? 0 : t;
  }, [resposta]);
  const agora = useAgora(null, agoraInicial);

  const todas = useMemo(() => filtrarEOrdenar(lista, filtros), [lista, filtros]);
  const baseRecomendacao = useMemo(() => filtrar(lista, filtros), [lista, filtros]);
  // O relógio de referência é o da busca: as recomendações não mudam a cada segundo.
  const recomendadas = useMemo(
    () => recomendar(baseRecomendacao, frente, new Date(agoraInicial)),
    [baseRecomendacao, frente, agoraInicial],
  );
  const motivosPorId = useMemo(
    () => new Map(recomendadas.map((r) => [r.item.id, r.motivos] as const)),
    [recomendadas],
  );
  const visiveis = useMemo(
    () => (paraVoce ? recomendadas.map((r) => r.item) : todas),
    [paraVoce, recomendadas, todas],
  );
  const contagens = useMemo(() => contarPorRegiao(lista), [lista]);
  const resumo = useMemo(() => resumir(lista, agora), [lista, agora]);

  // "Para você" mostra tudo de uma vez (no máximo 12): sem paginação.
  const porPagina = paraVoce ? Math.max(1, visiveis.length) : POR_PAGINA[visao];
  const totalPaginas = Math.max(1, Math.ceil(visiveis.length / porPagina));
  const pagina = Math.min(paginaPedida, totalPaginas);
  const primeiro = (pagina - 1) * porPagina;
  const itensDaPagina = useMemo(
    () => visiveis.slice(primeiro, primeiro + porPagina),
    [visiveis, primeiro, porPagina],
  );

  useEffect(() => {
    if (!rolarAoTrocar.current) return;
    rolarAoTrocar.current = false;
    topoRef.current?.scrollIntoView({ block: "start" });
  }, [pagina]);

  const irParaPagina = useCallback((destino: number) => {
    rolarAoTrocar.current = true;
    alterarUrl([["pagina", destino <= 1 ? null : String(destino)]]);
  }, []);

  const mudarFiltro = useCallback(
    (chave: "regiao" | "modalidade" | "ordem", valor: string, padrao: string) => {
      alterarUrl([
        [chave, valor === padrao ? null : valor],
        ["pagina", null],
      ]);
    },
    [],
  );

  const mudarAba = useCallback((nova: Aba) => {
    alterarUrl([
      ["aba", nova === ABA_PADRAO ? null : nova],
      ["pagina", null],
    ]);
  }, []);

  const mudarVisao = useCallback((nova: Visao) => {
    document.cookie = `${COOKIE_VISAO}=${nova}; path=/; max-age=31536000; samesite=lax`;
    alterarUrl([
      ["ver", nova],
      ["pagina", null],
    ]);
  }, []);

  const limparPainel = useCallback(() => {
    alterarUrl([
      ["modalidade", null],
      ["ordem", null],
      ["pagina", null],
    ]);
  }, []);

  const limparFiltros = useCallback(() => {
    alterarUrl([
      ["regiao", null],
      ["modalidade", null],
      ["ordem", null],
      ["pagina", null],
    ]);
  }, []);

  const abrirDetalhe = useCallback((item: OportunidadeComScore) => {
    setAberta(item);
    setDetalheAberto(true);
  }, []);
  const fecharDetalhe = useCallback(() => setDetalheAberto(false), []);

  function escolherFrente(nova: Frente) {
    if (nova === frenteOtimista) return;
    alterarUrl([["pagina", null]]);
    iniciar(async () => {
      definirFrenteOtimista(nova);
      await definirFrente(nova);
    });
  }

  function atualizar() {
    iniciar(async () => {
      await atualizarRadarAgora();
      router.refresh();
    });
  }

  const filtrosPadrao =
    filtros.regiao === FILTROS_PADRAO.regiao && filtros.modalidade === FILTROS_PADRAO.modalidade;
  const aviso = resposta ? textoFalhas(resposta.falhas) : null;
  const chaveLista = `${aba}|${frenteOtimista}|${filtros.regiao}|${filtros.modalidade}|${filtros.ordem}|${visao}|${pagina}`;

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 md:flex-nowrap">
        <h1 className="order-1 text-[22px] leading-tight font-semibold text-ink">Radar</h1>
        {resposta ? (
          <p className="order-4 w-full text-[13px] text-muted-foreground md:order-2 md:w-auto md:min-w-0 md:flex-1 md:text-sm">
            {fraseResumo(resumo)}
          </p>
        ) : (
          <span className="order-2 md:flex-1" />
        )}
        <div className="order-3 w-full md:w-auto">
          <SeletorFrente frente={frenteOtimista} onEscolher={escolherFrente} />
        </div>
        {resposta ? (
          <div className="order-2 ml-auto flex items-center gap-2 md:order-4 md:ml-0">
            <span className="hidden text-xs text-muted-foreground lg:inline">
              Atualizado às{" "}
              <span className="font-mono tabular-nums">{formatarHora(resposta.atualizadoEm)}</span>
            </span>
            <Button
              type="button"
              variant="ghost"
              onClick={atualizar}
              disabled={pendente}
              aria-label={`Atualizar oportunidades (última atualização às ${formatarHora(resposta.atualizadoEm)})`}
              className="size-11 md:size-9"
            >
              <RefreshCw
                className={cn("size-4", pendente && "motion-safe:animate-spin")}
                aria-hidden="true"
              />
            </Button>
          </div>
        ) : null}
      </header>

      {resposta ? (
        <>
          <SeletorAba
            aba={aba}
            contagens={{ "para-voce": recomendadas.length, todas: todas.length }}
            onEscolher={mudarAba}
          />

          <BarraFiltros
            filtros={filtros}
            contagens={contagens}
            visao={visao}
            totalResultados={visiveis.length}
            semOrdem={paraVoce}
            onRegiao={(valor: FiltroRegiao) => mudarFiltro("regiao", valor, FILTROS_PADRAO.regiao)}
            onModalidade={(valor: FiltroModalidade) =>
              mudarFiltro("modalidade", valor, FILTROS_PADRAO.modalidade)
            }
            onOrdem={(valor: Ordem) => mudarFiltro("ordem", valor, FILTROS_PADRAO.ordem)}
            onVisao={mudarVisao}
            onLimparPainel={limparPainel}
          />

          {aviso ? <AvisoFalhaParcial texto={aviso} /> : null}

          {visiveis.length === 0 && paraVoce ? (
            <EstadoVazio
              frase="Nenhuma oportunidade combina com o seu perfil agora."
              rotuloAcao="Ver todas"
              onLimpar={() => mudarAba("todas")}
            />
          ) : visiveis.length === 0 ? (
            <EstadoVazio frase={fraseVazio(filtros)} onLimpar={filtrosPadrao ? undefined : limparFiltros} />
          ) : (
            <div ref={topoRef} className="scroll-mt-[68px] lg:scroll-mt-6">
              {paraVoce ? (
                <p className="mb-3 text-sm text-muted-foreground">
                  {fraseRecomendadas(recomendadas.length, baseRecomendacao.length)}
                </p>
              ) : null}
              {visao === "cards" ? (
                <ul
                  key={chaveLista}
                  aria-busy={pendente}
                  className={cn(
                    "grid grid-cols-1 gap-3 transition-opacity duration-200 md:grid-cols-2 md:gap-4 xl:grid-cols-3",
                    pendente && "opacity-60",
                  )}
                >
                  {itensDaPagina.map((item, indice) => (
                    <li key={item.id} className="flex">
                      <CardOportunidade
                        item={item}
                        indice={indice}
                        agoraInicial={agoraInicial}
                        motivos={motivosPorId.get(item.id)}
                        onAbrir={abrirDetalhe}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <>
                  <CabecalhoLista />
                  <ul
                    key={chaveLista}
                    aria-busy={pendente}
                    className={cn(
                      "border-t border-rule transition-opacity duration-200 md:border-t-0",
                      pendente && "opacity-60",
                    )}
                  >
                    {itensDaPagina.map((item, indice) => (
                      <li key={item.id}>
                        <LinhaOportunidade
                          item={item}
                          indice={indice}
                          agoraInicial={agoraInicial}
                          motivos={motivosPorId.get(item.id)}
                          onAbrir={abrirDetalhe}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {paraVoce ? null : (
                <Paginacao
                  pagina={pagina}
                  totalPaginas={totalPaginas}
                  inicio={primeiro + 1}
                  fim={primeiro + itensDaPagina.length}
                  total={visiveis.length}
                  onIr={irParaPagina}
                />
              )}
            </div>
          )}

          <DetalheSheet
            item={aberta}
            aberto={detalheAberto}
            onFechar={fecharDetalhe}
            agoraInicial={agoraInicial}
            acoesExtras={aberta && renderAcoes ? renderAcoes(aberta) : null}
          />
        </>
      ) : (
        <EstadoErro />
      )}
    </div>
  );
}
