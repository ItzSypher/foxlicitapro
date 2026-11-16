"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Interruptor } from "@/components/ui/interruptor";
import { Seletor } from "@/components/ui/seletor";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { normalizarTexto } from "@/core/texto-busca";
import {
  LIMITES_FORA_RJ,
  MAX_PALAVRA,
  UFS_FORA_RJ,
  UF_BRASIL_TODO,
  acharUf,
  montarQueryForaRj,
  validarBuscaForaRj,
  type BuscaForaRj,
} from "@/lib/fora-rj-busca";
import type { MunicipioIbge } from "@/lib/ibge";

const CAMINHO_RESULTADO = "/radar/fora-rj";

type EstadoMunicipios = "parado" | "carregando" | "pronto" | "erro";

const CAMPO =
  "h-11 w-full min-w-0 rounded-control border border-control bg-raised px-3 text-base text-ink outline-none placeholder:text-faint focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50 md:text-sm";

interface Props {
  /** Busca em exibição, para preencher o formulário ao refinar */
  inicial?: BuscaForaRj | null;
  /** "discreto": botão de texto, perto dos filtros do Radar; "contorno": botão com borda */
  variante?: "discreto" | "contorno";
  rotulo?: string;
}

function Campo({ id, rotulo, dica, children }: { id: string; rotulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {rotulo}
      </label>
      {children}
      {dica ? <p className="text-[13px] text-muted-foreground">{dica}</p> : null}
    </div>
  );
}

/** Botão e folha de "Buscar fora do RJ": estado, município (opcional), palavra-chave e frentes. */
export function BuscaForaRjSheet({ inicial = null, variante = "discreto", rotulo = "Buscar fora do RJ" }: Props) {
  const router = useRouter();
  const idBase = useId();
  const [aberto, setAberto] = useState(false);
  const [uf, setUf] = useState(inicial?.uf ?? "");
  const [municipio, setMunicipio] = useState(inicial?.codigoMunicipioIbge ?? "");
  const [filtroMunicipio, setFiltroMunicipio] = useState("");
  const [palavra, setPalavra] = useState(inicial?.palavra ?? "");
  const [produtos, setProdutos] = useState(inicial?.incluirProdutos ?? false);
  const [erro, setErro] = useState<string | null>(null);
  const [municipios, setMunicipios] = useState<MunicipioIbge[]>([]);
  const [estadoMunicipios, setEstadoMunicipios] = useState<EstadoMunicipios>("parado");
  const cache = useRef(new Map<string, MunicipioIbge[]>());
  const requisicao = useRef<AbortController | null>(null);

  useEffect(() => () => requisicao.current?.abort(), []);

  const brasilTodo = uf === UF_BRASIL_TODO;
  const estado = acharUf(uf);

  function carregarMunicipios(sigla: string) {
    requisicao.current?.abort();
    if (acharUf(sigla) === null) {
      setMunicipios([]);
      setEstadoMunicipios("parado");
      return;
    }
    const guardados = cache.current.get(sigla);
    if (guardados) {
      setMunicipios(guardados);
      setEstadoMunicipios("pronto");
      return;
    }
    const controle = new AbortController();
    requisicao.current = controle;
    setMunicipios([]);
    setEstadoMunicipios("carregando");
    fetch(`/api/ibge/municipios?uf=${encodeURIComponent(sigla)}`, { signal: controle.signal })
      .then(async (resposta): Promise<MunicipioIbge[] | null> => (resposta.ok ? ((await resposta.json()) as MunicipioIbge[]) : null))
      .then((lista) => {
        if (controle.signal.aborted) return;
        if (lista === null) {
          setEstadoMunicipios("erro");
          return;
        }
        cache.current.set(sigla, lista);
        setMunicipios(lista);
        setEstadoMunicipios("pronto");
      })
      .catch(() => {
        if (!controle.signal.aborted) setEstadoMunicipios("erro");
      });
  }

  function mudarAberto(proximo: boolean) {
    setAberto(proximo);
    if (proximo) {
      setErro(null);
      if (uf !== "" && estadoMunicipios === "parado") carregarMunicipios(uf);
    }
  }

  function escolherUf(sigla: string) {
    setUf(sigla);
    setMunicipio("");
    setFiltroMunicipio("");
    setErro(null);
    carregarMunicipios(sigla);
  }

  const opcoesMunicipio = useMemo(() => {
    const termo = normalizarTexto(filtroMunicipio);
    const filtrados = termo === "" ? municipios : municipios.filter((m) => normalizarTexto(m.nome).includes(termo));
    const selecionado = municipios.find((m) => m.codigo === municipio);
    return selecionado && !filtrados.includes(selecionado) ? [selecionado, ...filtrados] : filtrados;
  }, [municipios, filtroMunicipio, municipio]);

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const leitura = validarBuscaForaRj({
      uf,
      codigoMunicipioIbge: brasilTodo ? null : municipio,
      palavra,
      incluirProdutos: produtos,
    });
    if (leitura.tipo !== "ok") {
      setErro(leitura.tipo === "invalida" ? leitura.erro : "Escolha um estado ou o Brasil todo.");
      return;
    }
    setErro(null);
    setAberto(false);
    router.push(`${CAMINHO_RESULTADO}?${montarQueryForaRj(leitura.busca)}`);
  }

  const idUf = `${idBase}-uf`;
  const idBuscaMunicipio = `${idBase}-busca-municipio`;
  const idMunicipio = `${idBase}-municipio`;
  const idPalavra = `${idBase}-palavra`;

  return (
    <>
      {variante === "discreto" ? (
        <button
          type="button"
          onClick={() => mudarAberto(true)}
          className="inline-flex h-11 items-center gap-1.5 rounded-control px-2 text-sm text-muted-foreground outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-brand md:h-9"
        >
          <Globe className="size-4" aria-hidden="true" />
          {rotulo}
        </button>
      ) : (
        <Button type="button" variant="outline" onClick={() => mudarAberto(true)} className="h-11 gap-2 px-3 md:h-9">
          <Globe className="size-4" aria-hidden="true" />
          {rotulo}
        </Button>
      )}

      <Sheet open={aberto} onOpenChange={mudarAberto}>
        <SheetContent
          side="bottom"
          className="max-h-[92dvh] gap-0 rounded-t-sheet border-t border-border data-[side=bottom]:h-auto md:mx-auto md:max-w-[520px]"
        >
          <SheetHeader className="border-b border-border p-4 pr-14">
            <SheetTitle>Buscar fora do RJ</SheetTitle>
            <SheetDescription>
              Consulta o PNCP na hora, só para esta busca. O Radar diário continua com Nova Iguaçu, Baixada e RJ.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={enviar} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain p-4">
              <Campo id={idUf} rotulo="Estado">
                <Seletor
                  id={idUf}
                  valor={uf}
                  aoMudar={escolherUf}
                  placeholder="Escolha o estado"
                  opcoes={[
                    { valor: UF_BRASIL_TODO, rotulo: "Brasil todo (exige palavra-chave)" },
                    ...UFS_FORA_RJ.map((u) => ({ valor: u.sigla, rotulo: `${u.nome} (${u.sigla})` })),
                  ]}
                />
              </Campo>

              {estado ? (
                <div className="flex min-w-0 flex-col gap-2">
                  <Campo
                    id={idBuscaMunicipio}
                    rotulo="Município (opcional)"
                    dica={
                      estadoMunicipios === "erro"
                        ? "Não foi possível carregar os municípios agora. A busca funciona para o estado todo."
                        : "Escolher um município deixa a busca mais completa."
                    }
                  >
                    <input
                      id={idBuscaMunicipio}
                      type="search"
                      value={filtroMunicipio}
                      onChange={(e) => setFiltroMunicipio(e.target.value)}
                      placeholder="Digite para filtrar a lista"
                      autoComplete="off"
                      disabled={estadoMunicipios !== "pronto"}
                      className={CAMPO}
                    />
                  </Campo>
                  <Seletor
                    id={idMunicipio}
                    rotulo="Município"
                    posicaoRotulo="oculto"
                    valor={municipio}
                    aoMudar={setMunicipio}
                    desabilitado={estadoMunicipios !== "pronto"}
                    opcoes={[
                      {
                        valor: "",
                        rotulo: estadoMunicipios === "carregando" ? "Carregando municípios…" : `Todos os municípios de ${estado.nome}`,
                      },
                      ...opcoesMunicipio.map((m) => ({ valor: m.codigo, rotulo: m.nome })),
                    ]}
                  />
                </div>
              ) : null}

              <Campo
                id={idPalavra}
                rotulo={brasilTodo ? "Palavra-chave (obrigatória)" : "Palavra-chave (opcional)"}
                dica="Procura no objeto, no órgão e no município. Ex.: software, suporte, servidor."
              >
                <input
                  id={idPalavra}
                  type="text"
                  value={palavra}
                  onChange={(e) => setPalavra(e.target.value)}
                  maxLength={MAX_PALAVRA}
                  placeholder="software"
                  autoComplete="off"
                  aria-required={brasilTodo}
                  className={CAMPO}
                />
              </Campo>

              <div className="flex flex-col gap-1">
                <p className="text-sm text-ink">
                  Por padrão, só <strong className="font-semibold">serviços</strong>: software, infraestrutura e suporte.
                </p>
                <Interruptor
                  rotulo="Incluir produtos também"
                  descricao="Equipamentos e materiais que combinam com a frente de produtos."
                  checked={produtos}
                  onChange={(e) => setProdutos(e.target.checked)}
                />
              </div>

              <p className="rounded-control border border-border bg-raised px-3 py-2 text-[13px] text-muted-foreground">
                Limite de cada busca: propostas que encerram em até {LIMITES_FORA_RJ.diasAFrente} dias e até{" "}
                {LIMITES_FORA_RJ.maxPaginas} páginas por modalidade. Se passar disso, a tela avisa.
              </p>

              {erro ? (
                <p role="alert" className="text-sm text-negative">
                  {erro}
                </p>
              ) : null}
            </div>

            <SheetFooter className="mt-0 flex-none flex-row gap-2 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button type="submit" className="h-12 flex-1 bg-brand-fill text-sm font-semibold text-black hover:opacity-90">
                Buscar
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
