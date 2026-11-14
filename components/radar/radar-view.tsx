"use client";

import { useCallback, useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { atualizarRadarAgora, definirFrente } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import type { Frente, ModalidadeId, OportunidadeComScore } from "@/core/types";
import { formatarHora } from "@/lib/formato";
import {
  COOKIE_VISAO,
  ABA_PADRAO,
  FILTROS_PADRAO,
  fraseRecomendadas,
  fraseResumo,
  fraseVazio,
  lerAba,
  lerBusca,
  lerFiltros,
  lerPalavras,
  normalizarBusca,
  type Aba,
  type FiltroModalidade,
  type FiltroRegiao,
  type Ordem,
  type Visao,
} from "@/lib/radar-filtros";
import { POR_PAGINA_PADRAO, type PaginaRadar } from "@/lib/radar-pagina";
import { cn } from "@/lib/utils";
import { CardOportunidade } from "./card-oportunidade";
import { DetalheSheet } from "./detalhe-sheet";
import { AvisoFalhaParcial, EstadoErro, EstadoVazio } from "./estados";
import { BarraFiltros } from "./filtros";
import { BuscaPalavras } from "./busca-palavras";
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

type ChaveParametro = "regiao" | "modalidade" | "ordem" | "ver" | "pagina" | "aba" | "q" | "pc" | "por";

const ATRASO_BUSCA_MS = 300;

interface Props {
  frente: Frente;
  /** Página atual, filtrada e ordenada pelo servidor; null quando a busca falhou */
  pagina: PaginaRadar | null;
  /** Visualização (?ver= ou cookie) na carga da página */
  visao: Visao;
  /** Texto de ?q= na carga da página */
  buscaInicial: string;
  /** Ponto de inserção no detalhe, antes de "Abrir no PNCP" (ex.: "Salvar no pipeline"). */
  renderAcoes?: (item: OportunidadeComScore) => React.ReactNode;
  /** Palavras-chave que a pessoa guardou */
  palavrasSalvas?: string[];
}

export function RadarView({ frente, pagina: dados, visao: visaoInicial, buscaInicial, renderAcoes, palavrasSalvas = [] }: Props) {
  const router = useRouter();
  const caminho = usePathname();
  const parametrosUrl = useSearchParams().toString();

  const [pendente, iniciar] = useTransition();
  // A URL é a fonte da verdade; o valor otimista deixa chips e abas responderem antes do servidor.
  const [consulta, definirConsulta] = useOptimistic(parametrosUrl, (_atual: string, nova: string) => nova);
  const params = useMemo(() => new URLSearchParams(consulta), [consulta]);
  const filtros = useMemo(() => lerFiltros(params), [params]);
  const aba = lerAba(params);
  const paraVoce = aba === "para-voce";
  const buscaNaUrl = lerBusca(params);

  // O campo de busca vive no estado (digitar não espera o servidor); a URL recebe o texto após a pausa.
  const [busca, setBusca] = useState(buscaInicial);
  const [visao, setVisao] = useState<Visao>(visaoInicial);
  const [salvas, setSalvas] = useState<string[]>(palavrasSalvas);
  const urlTimer = useRef<number | null>(null);
  const selecionadas = useMemo(() => lerPalavras(params).filter((p) => salvas.includes(p)), [params, salvas]);

  const [frenteOtimista, definirFrenteOtimista] = useOptimistic(frente);

  const [aberta, setAberta] = useState<OportunidadeComScore | null>(null);
  const [detalheAberto, setDetalheAberto] = useState(false);
  const topoRef = useRef<HTMLDivElement>(null);
  const rolarAoTrocar = useRef(false);

  const numeroDaPagina = dados?.pagina ?? 1;
  const agoraInicial = useMemo(() => {
    const t = dados ? Date.parse(dados.atualizadoEm) : Number.NaN;
    return Number.isNaN(t) ? 0 : t;
  }, [dados]);

  useEffect(() => {
    if (!rolarAoTrocar.current) return;
    rolarAoTrocar.current = false;
    topoRef.current?.scrollIntoView({ block: "start" });
  }, [numeroDaPagina]);

  /** Troca parâmetros da URL; o servidor refaz filtro, ordem e página, e a tela segue utilizável. */
  const navegar = useCallback(
    (mudancas: ReadonlyArray<readonly [ChaveParametro, string | null]>, empilhar = false) => {
      const proximos = new URLSearchParams(consulta);
      for (const [chave, valor] of mudancas) {
        if (valor === null) proximos.delete(chave);
        else proximos.set(chave, valor);
      }
      const texto = proximos.toString();
      iniciar(() => {
        definirConsulta(texto);
        const destino = texto ? `${caminho}?${texto}` : caminho;
        if (empilhar) router.push(destino, { scroll: false });
        else router.replace(destino, { scroll: false });
      });
    },
    [consulta, caminho, router, definirConsulta],
  );

  const irParaPagina = useCallback(
    (destino: number) => {
      rolarAoTrocar.current = true;
      navegar([["pagina", destino <= 1 ? null : String(destino)]], true);
    },
    [navegar],
  );

  const mudarPorPagina = useCallback(
    (valor: number) => {
      navegar([
        ["por", valor === POR_PAGINA_PADRAO ? null : String(valor)],
        ["pagina", null],
      ]);
    },
    [navegar],
  );

  const mudarFiltro = useCallback(
    (chave: "regiao" | "modalidade" | "ordem", valor: string, padrao: string) => {
      navegar([
        [chave, valor === padrao ? null : valor],
        ["pagina", null],
      ]);
    },
    [navegar],
  );

  const aplicarBusca = useCallback(
    (texto: string) => {
      if (urlTimer.current !== null) window.clearTimeout(urlTimer.current);
      urlTimer.current = null;
      const limpo = texto.trim().slice(0, 100);
      if (limpo === buscaNaUrl) return;
      navegar([
        ["q", limpo === "" ? null : limpo],
        ["pagina", null],
      ]);
    },
    [navegar, buscaNaUrl],
  );

  const buscar = useCallback(
    (texto: string) => {
      setBusca(texto);
      if (urlTimer.current !== null) window.clearTimeout(urlTimer.current);
      urlTimer.current = window.setTimeout(() => aplicarBusca(texto), ATRASO_BUSCA_MS);
    },
    [aplicarBusca],
  );

  const alternarPalavra = useCallback(
    (termo: string) => {
      const proximas = selecionadas.includes(termo) ? selecionadas.filter((p) => p !== termo) : [...selecionadas, termo];
      navegar([
        ["pc", proximas.length === 0 ? null : proximas.join(",")],
        ["pagina", null],
      ]);
    },
    [navegar, selecionadas],
  );

  /** Palavra recém-guardada: limpa a busca e marca a palavra, numa navegação só. */
  const marcarGuardada = useCallback(
    (termo: string) => {
      if (urlTimer.current !== null) window.clearTimeout(urlTimer.current);
      urlTimer.current = null;
      setBusca("");
      const proximas = selecionadas.includes(termo) ? selecionadas : [...selecionadas, termo];
      navegar([
        ["q", null],
        ["pc", proximas.join(",")],
        ["pagina", null],
      ]);
    },
    [navegar, selecionadas],
  );

  const limparTexto = useCallback(() => {
    if (urlTimer.current !== null) window.clearTimeout(urlTimer.current);
    urlTimer.current = null;
    setBusca("");
    navegar([
      ["q", null],
      ["pc", null],
      ["pagina", null],
    ]);
  }, [navegar]);

  useEffect(
    () => () => {
      if (urlTimer.current !== null) window.clearTimeout(urlTimer.current);
    },
    [],
  );

  const mudarAba = useCallback(
    (nova: Aba) => {
      navegar([
        ["aba", nova === ABA_PADRAO ? null : nova],
        ["pagina", null],
      ]);
    },
    [navegar],
  );

  // A visualização só muda o desenho: o cookie e a URL guardam a escolha sem pedir nada ao servidor.
  const mudarVisao = useCallback((nova: Visao) => {
    setVisao(nova);
    document.cookie = `${COOKIE_VISAO}=${nova}; path=/; max-age=31536000; samesite=lax`;
    const proximos = new URLSearchParams(window.location.search);
    proximos.set("ver", nova);
    window.history.replaceState(null, "", `?${proximos.toString()}`);
  }, []);

  const limparPainel = useCallback(() => {
    navegar([
      ["modalidade", null],
      ["ordem", null],
      ["pagina", null],
    ]);
  }, [navegar]);

  const limparFiltros = useCallback(() => {
    navegar([
      ["regiao", null],
      ["modalidade", null],
      ["ordem", null],
      ["pagina", null],
    ]);
  }, [navegar]);

  const abrirDetalhe = useCallback((item: OportunidadeComScore) => {
    setAberta(item);
    setDetalheAberto(true);
  }, []);
  const fecharDetalhe = useCallback(() => setDetalheAberto(false), []);

  function escolherFrente(nova: Frente) {
    if (nova === frenteOtimista) return;
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

  const filtroTextoAtivo = normalizarBusca(buscaNaUrl) !== "" || selecionadas.length > 0;
  const filtrosPadrao =
    filtros.regiao === FILTROS_PADRAO.regiao && filtros.modalidade === FILTROS_PADRAO.modalidade;
  const aviso = dados ? textoFalhas(dados.falhas) : null;
  const total = dados?.total ?? 0;
  const chaveLista = `${aba}|${frenteOtimista}|${visao}|${dados?.pagina ?? 1}|${dados?.porPagina ?? 0}|${total}`;

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 md:flex-nowrap">
        <h1 className="order-1 text-[22px] leading-tight font-semibold text-ink">Radar</h1>
        {dados ? (
          <p className="order-4 w-full text-[13px] text-muted-foreground md:order-2 md:w-auto md:min-w-0 md:flex-1 md:text-sm">
            {fraseResumo(dados.resumo)}
          </p>
        ) : (
          <span className="order-2 md:flex-1" />
        )}
        <div className="order-3 w-full md:w-auto">
          <SeletorFrente frente={frenteOtimista} onEscolher={escolherFrente} />
        </div>
        {dados ? (
          <div className="order-2 ml-auto flex items-center gap-2 md:order-4 md:ml-0">
            <span className="hidden text-xs text-muted-foreground lg:inline">
              Atualizado às{" "}
              <span className="font-mono tabular-nums">{formatarHora(dados.atualizadoEm)}</span>
            </span>
            <Button
              type="button"
              variant="ghost"
              onClick={atualizar}
              disabled={pendente}
              aria-label={`Atualizar oportunidades (última atualização às ${formatarHora(dados.atualizadoEm)})`}
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

      {dados ? (
        <>
          <SeletorAba aba={aba} contagens={dados.contagensAbas} onEscolher={mudarAba} />

          <BuscaPalavras
            busca={busca}
            aoBuscar={buscar}
            aoAplicar={aplicarBusca}
            salvas={salvas}
            aoMudarSalvas={setSalvas}
            selecionadas={selecionadas}
            aoAlternar={alternarPalavra}
            aoRemoverMarcada={alternarPalavra}
            aoGuardar={marcarGuardada}
          />

          <BarraFiltros
            filtros={filtros}
            contagens={dados.contagensRegiao}
            visao={visao}
            totalResultados={total}
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

          {total === 0 && filtroTextoAtivo ? (
            <EstadoVazio
              frase="Nada encontrado com essa busca."
              rotuloAcao="Limpar a busca"
              onLimpar={limparTexto}
            />
          ) : total === 0 && paraVoce ? (
            <EstadoVazio
              frase="Nenhuma oportunidade combina com o seu perfil agora."
              rotuloAcao="Ver todas"
              onLimpar={() => mudarAba("todas")}
            />
          ) : total === 0 ? (
            <EstadoVazio frase={fraseVazio(filtros)} onLimpar={filtrosPadrao ? undefined : limparFiltros} />
          ) : (
            <div ref={topoRef} className="scroll-mt-[68px] lg:scroll-mt-6">
              {paraVoce ? (
                <p className="mb-3 text-sm text-muted-foreground">
                  {fraseRecomendadas(dados.contagensAbas["para-voce"], dados.baseRecomendacao)}.{" "}
                  <Link
                    href="/preferencias"
                    className="inline-flex min-h-11 items-center text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    Ajustar o que aparece aqui
                  </Link>
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
                  {dados.itens.map((item, indice) => (
                    <li key={item.id} className="flex">
                      <CardOportunidade
                        item={item}
                        indice={indice}
                        agoraInicial={agoraInicial}
                        motivos={dados.motivos[item.id]}
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
                    {dados.itens.map((item, indice) => (
                      <li key={item.id}>
                        <LinhaOportunidade
                          item={item}
                          indice={indice}
                          agoraInicial={agoraInicial}
                          motivos={dados.motivos[item.id]}
                          onAbrir={abrirDetalhe}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <Paginacao
                pagina={dados.pagina}
                totalPaginas={dados.totalPaginas}
                inicio={dados.inicio}
                fim={dados.fim}
                total={dados.total}
                porPagina={dados.porPagina}
                ocupado={pendente}
                onIr={irParaPagina}
                onPorPagina={mudarPorPagina}
              />
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
