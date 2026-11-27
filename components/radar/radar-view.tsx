"use client";

import { useCallback, useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { atualizarRadarAgora, definirFrente } from "@/app/(app)/actions";
import { adicionarUfAoRadarAction } from "@/app/(app)/empresa/actions";
import { Button } from "@/components/ui/button";
import type { Fonte } from "@/core/fonte";
import type { Frente, ModalidadeId, OportunidadeComScore } from "@/core/types";
import { formatarHora } from "@/lib/formato";
import {
  COOKIE_VISAO,
  ABA_PADRAO,
  FILTROS_PADRAO,
  contarFiltrosAtivos,
  fraseRamo,
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
import { BuscaPncp } from "./busca-pncp";
import { FaixaOferta } from "./faixa-oferta";
import { CabecalhoLista, LinhaOportunidade } from "./linha-oportunidade";
import { ListaDesertas } from "./lista-desertas";
import { Paginacao } from "./paginacao";
import type { PainelMeta } from "@/core/meta";
import { PainelDiaView } from "./painel-dia";
import { SeletorAba } from "./seletor-aba";
import { SeletorFrente } from "./seletor-frente";

/** Aviso acima da lista: coleta parcial do PNCP e UFs que ainda não foram coletadas. */
function textoAviso(falhas: ReadonlyArray<ModalidadeId>, ufsPendentes: ReadonlyArray<string>): string | null {
  const falha = textoFalhas(falhas);
  const pendentes =
    ufsPendentes.length > 0
      ? `Ainda estamos buscando as oportunidades de ${ufsPendentes.join(", ")}; elas aparecem aqui em alguns minutos.`
      : null;
  return [falha, pendentes].filter((t): t is string => t !== null).join(" ") || null;
}

function textoFalhas(falhas: ReadonlyArray<ModalidadeId>): string | null {
  const pregao = falhas.includes(6);
  const dispensa = falhas.includes(8);
  if (pregao && dispensa) return "O PNCP não entregou tudo agora; a lista pode estar incompleta.";
  if (pregao) return "Parte dos pregões não carregou agora; a lista pode estar incompleta.";
  if (dispensa) return "Parte das dispensas não carregou agora; a lista pode estar incompleta.";
  return null;
}

type ChaveParametro = "uf" | "modalidade" | "ordem" | "vmin" | "vmax" | "fonte" | "ramo" | "caixa" | "caixaMax" | "ver" | "pagina" | "aba" | "q" | "pc" | "por";

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
  /** Meta da semana; null quando não foi possível ler */
  meta?: PainelMeta | null;
  /** UFs das áreas da empresa (as que entram na busca diária) */
  ufsAtendidas?: string[];
  /** Termos do foco da empresa, mostrados como "Você oferece" acima da lista */
  foco?: string[];
}

export function RadarView({
  frente,
  pagina: dados,
  visao: visaoInicial,
  buscaInicial,
  renderAcoes,
  palavrasSalvas = [],
  meta = null,
  ufsAtendidas = [],
  foco = [],
}: Props) {
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
  const emDesertas = aba === "desertas";
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
  const aposPainelRef = useRef<HTMLDivElement>(null);
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
    (chave: "modalidade" | "ordem", valor: string, padrao: string) => {
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

  const limparFiltros = useCallback(() => {
    navegar([
      ["uf", null],
      ["modalidade", null],
      ["ordem", null],
      ["vmin", null],
      ["vmax", null],
      ["fonte", null],
      ["ramo", null],
      ["caixa", null],
      ["caixaMax", null],
      ["pagina", null],
    ]);
  }, [navegar]);

  const mudarUfs = useCallback(
    (ufs: string[]) => {
      navegar([
        ["uf", ufs.length === 0 ? null : ufs.join(",")],
        ["pagina", null],
      ]);
    },
    [navegar],
  );

  const mudarValor = useCallback(
    (min: number | null, max: number | null) => {
      navegar([
        ["vmin", min === null ? null : String(min)],
        ["vmax", max === null ? null : String(max)],
        ["pagina", null],
      ]);
    },
    [navegar],
  );

  const mudarFontes = useCallback(
    (fontes: Fonte[]) => {
      navegar([
        ["fonte", fontes.length === 0 ? null : fontes.join(",")],
        ["pagina", null],
      ]);
    },
    [navegar],
  );

  /** Ligar ou desligar vale só nesta consulta (o padrão fica em Empresa > Onde atender). */
  const mudarTudoDoRamo = useCallback(
    (ligado: boolean) => {
      navegar([
        ["ramo", ligado ? "1" : "0"],
        ["pagina", null],
      ]);
    },
    [navegar],
  );

  const mudarPoucoCaixa = useCallback(
    (ligado: boolean) => {
      navegar([
        ["caixa", ligado ? "1" : null],
        ["pagina", null],
      ]);
    },
    [navegar],
  );

  const mudarCaixaMax = useCallback(
    (valor: number | null) => {
      navegar([
        ["caixaMax", valor === null ? null : String(valor)],
        ["pagina", null],
      ]);
    },
    [navegar],
  );

  /** Leva a pessoa à lista depois de um clique no resumo; sem animação se ela pediu menos movimento. */
  const rolarParaLista = useCallback(() => {
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => {
      aposPainelRef.current?.scrollIntoView({ block: "start", behavior: reduzir ? "auto" : "smooth" });
    }, 0);
  }, []);

  /** Cada cartão do resumo troca a aba, a ordem e a página numa navegação só. */
  const verLista = useCallback(
    (nova: Aba, ordem: Ordem) => {
      navegar([
        ["aba", nova === ABA_PADRAO ? null : nova],
        ["ordem", ordem === FILTROS_PADRAO.ordem ? null : ordem],
        ["pagina", null],
      ]);
      rolarParaLista();
    },
    [navegar, rolarParaLista],
  );

  const [ufsAdicionadas, setUfsAdicionadas] = useState<string[]>([]);
  const [ufEmAdicao, setUfEmAdicao] = useState<string | null>(null);
  const [erroUf, setErroUf] = useState<string | null>(null);

  /** Estado que a empresa ainda não atende: entra nas áreas, vira filtro e a coleta roda em segundo plano. */
  const adicionarUf = useCallback(
    async (uf: string) => {
      setErroUf(null);
      setUfEmAdicao(uf);
      try {
        const r = await adicionarUfAoRadarAction(uf);
        if (!r.ok) {
          setErroUf(r.erro);
          return;
        }
        setUfsAdicionadas((atual) => (atual.includes(uf) ? atual : [...atual, uf]));
        mudarUfs(filtros.ufs.includes(uf) ? filtros.ufs : [...filtros.ufs, uf]);
      } catch {
        setErroUf("Não foi possível adicionar o estado agora. Tente de novo.");
      } finally {
        setUfEmAdicao(null);
      }
    },
    [mudarUfs, filtros.ufs],
  );

  const escolherUfDoPainel = useCallback(
    (uf: string) => {
      // Tocar no estado já escolhido tira o filtro dele.
      mudarUfs(filtros.ufs.includes(uf) ? filtros.ufs.filter((u) => u !== uf) : [...filtros.ufs, uf]);
      rolarParaLista();
    },
    [mudarUfs, filtros.ufs, rolarParaLista],
  );

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
  const filtrosPadrao = contarFiltrosAtivos(filtros, false) === 0;
  const aviso = dados ? textoAviso(dados.falhas, dados.ufsPendentes) : null;
  const total = dados?.total ?? 0;
  const ufsDaEmpresa = useMemo(() => [...new Set([...ufsAtendidas, ...ufsAdicionadas])], [ufsAtendidas, ufsAdicionadas]);
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
              <span className="tabular-nums">{formatarHora(dados.atualizadoEm)}</span>
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
          <PainelDiaView
            painel={dados.painel}
            meta={meta}
            contagensUf={dados.contagensUf}
            ufsAtivas={filtros.ufs}
            ocupado={pendente}
            aoVerNovas={() => verLista("todas", "recentes")}
            aoVerEncerrando={() => verLista("todas", "prazo")}
            aoVerSinalAlto={() => verLista("todas", "sinal")}
            aoVerValor={() => verLista("todas", "valor")}
            aoEscolherUf={escolherUfDoPainel}
          />
          <div ref={aposPainelRef} aria-hidden="true" className="-mt-4 scroll-mt-[68px] lg:-mt-5 lg:scroll-mt-6" />

          <SeletorAba aba={aba} contagens={dados.contagensAbas} onEscolher={mudarAba} />

          {emDesertas ? null : (
            <>
              <FaixaOferta foco={foco} />

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

              <BuscaPncp texto={buscaNaUrl} ufs={filtros.ufs.length > 0 ? filtros.ufs : ufsDaEmpresa} />

              <BarraFiltros
                filtros={filtros}
                ufsAtendidas={ufsDaEmpresa}
                ufEmAdicao={ufEmAdicao}
                erroUf={erroUf}
                onAdicionarUf={adicionarUf}
                contagensUf={dados.contagensUf}
                contagensFonte={dados.contagensFonte}
                tudoDoRamo={dados.tudoDoRamo}
                visao={visao}
                totalResultados={total}
                semOrdem={paraVoce}
                onUfs={mudarUfs}
                onValor={mudarValor}
                onFontes={mudarFontes}
                onTudoDoRamo={mudarTudoDoRamo}
                onPoucoCaixa={mudarPoucoCaixa}
                onCaixaMax={mudarCaixaMax}
                onModalidade={(valor: FiltroModalidade) =>
                  mudarFiltro("modalidade", valor, FILTROS_PADRAO.modalidade)
                }
                onOrdem={(valor: Ordem) => mudarFiltro("ordem", valor, FILTROS_PADRAO.ordem)}
                onVisao={mudarVisao}
                onLimparPainel={limparFiltros}
              />
            </>
          )}

          {aviso ? <AvisoFalhaParcial texto={aviso} /> : null}

          {total === 0 && emDesertas ? (
            <EstadoVazio frase="Nenhuma compra deserta nos últimos 60 dias; quando o órgão reabrir, ela aparece no Radar." />
          ) : total === 0 && filtroTextoAtivo ? (
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
                  {dados.tudoDoRamo
                    ? fraseRamo(dados.contagensAbas["para-voce"], dados.baseRecomendacao)
                    : fraseRecomendadas(dados.contagensAbas["para-voce"], dados.baseRecomendacao)}
                  .{" "}
                  <Link
                    href="/preferencias"
                    className="inline-flex min-h-11 items-center text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    Ajustar o que aparece aqui
                  </Link>
                </p>
              ) : null}
              {emDesertas ? (
                <>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Compras que deram deserta nos últimos 60 dias e costumam reabrir; cada uma aparece uma vez e some quando reabre.
                  </p>
                  <ListaDesertas key={chaveLista} itens={dados.desertas} ocupado={pendente} />
                </>
              ) : visao === "cards" ? (
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
                        propostaProntaId={dados.prontas[item.id]}
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
