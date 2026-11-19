"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Trash2 } from "lucide-react";
import {
  duplicarPropostaAction,
  excluirPropostaAction,
  acaoRevisaoAction,
  salvarPropostaAction,
} from "@/app/(app)/propostas/actions";
import { BarraProposta, type EstadoSalvo } from "@/components/propostas/barra-proposta";
import { BOTAO_SECUNDARIO, CONTROLE, Secao } from "@/components/propostas/campos";
import { DocumentoEditavel } from "@/components/propostas/documento-editavel";
import { DocumentoProposta } from "@/components/propostas/documento";
import { dadosParaFormulario, formularioParaDados, type Formulario } from "@/components/propostas/estado";
import { FolhaEnviar, type LinkPublico } from "@/components/propostas/folha-enviar";
import { PreviaEscalada } from "@/components/propostas/previa-escalada";
import { BlocoAnalise } from "@/components/propostas/bloco-analise";
import { FaixaRevisao } from "@/components/propostas/faixa-revisao";
import { LinhaDoTempo, QuadroResultado, type ResumoResultado } from "@/components/propostas/linha-do-tempo";
import type { EventoProposta } from "@/core/proposta-eventos";
import { PainelRevisao } from "@/components/propostas/painel-revisao";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { totalProposta, validarProposta } from "@/core/proposta";
import type { Emitente } from "@/core/proposta-emitente";
import { MODELOS, obterModelo, type ModeloId } from "@/core/proposta-modelos";
import { podeEditar, type AcaoRevisao } from "@/core/revisao";
import type { DadosProposta } from "@/core/types-detalhe";
import type { AnaliseAssistente, AutorProposta, StatusPropostaEquipe } from "@/core/types-equipe";
import { formatarMoeda } from "@/lib/formato";
import { TRILHO_SEGMENTADO, classeItemSegmentado } from "@/components/ui/segmentado";
import { cn } from "@/lib/utils";

export interface PropostaParaEditor {
  id: string;
  titulo: string;
  modelo: ModeloId;
  dados: DadosProposta;
  status: StatusPropostaEquipe;
  link: LinkPublico | null;
  autor: AutorProposta;
  criadoPor: string | null;
  criadoPorNome: string | null;
  revisadoPorNome: string | null;
  revisaoNota: string | null;
  revisadoEm: string | null;
  analise: AnaliseAssistente | null;
  /** ISO 8601 do primeiro envio registrado */
  enviadaEm: string | null;
  resultado: Omit<ResumoResultado, "status">;
}

export interface AcessosProposta {
  /** Criar, editar, enviar, duplicar e excluir */
  editar: boolean;
  /** Aprovar e voltar para rascunho */
  aprovar: boolean;
  /** Devolver com nota */
  devolver: boolean;
}

interface Props {
  proposta: PropostaParaEditor;
  /** Quem está olhando a proposta */
  usuarioId: string;
  /** Valor unitário estimado pelo órgão, por número do item */
  referencias: Record<number, number>;
  cotacao: { precoMinimo: number; precoAlvo: number } | null;
  avisoSemItens: boolean;
  emitente: Emitente;
  /** O que esta pessoa pode fazer; o servidor confere de novo em cada ação */
  acessos: AcessosProposta;
  /** Linha do tempo, já em ordem */
  eventos: EventoProposta[];
}

const horaFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function hora(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "--:--" : horaFmt.format(d);
}

/** Conserva o que o usuário editou: só troca o padrão do modelo antigo pelo do novo. */
function aplicarPadroes(f: Formulario, novo: ModeloId): Formulario {
  const antigo = obterModelo(f.modelo).padroes;
  const padroes = obterModelo(novo).padroes;
  const trocar = (atual: string, velho: string | undefined, novoValor: string | undefined): string =>
    atual.trim() === "" || atual === (velho ?? "") ? (novoValor ?? "") : atual;
  return {
    ...f,
    modelo: novo,
    validadeDias: trocar(f.validadeDias, String(antigo.validadeDias ?? ""), String(padroes.validadeDias ?? "")),
    prazoEntrega: trocar(f.prazoEntrega, antigo.prazoEntrega, padroes.prazoEntrega),
    localEntrega: trocar(f.localEntrega, antigo.localEntrega, padroes.localEntrega),
    pagamento: trocar(f.pagamento, antigo.pagamento, padroes.pagamento),
    garantia: trocar(f.garantia, antigo.garantia, padroes.garantia),
  };
}

export function Editor({ proposta, usuarioId, referencias, cotacao, avisoSemItens, acessos, emitente, eventos }: Props) {
  const [form, setForm] = useState<Formulario>(() =>
    dadosParaFormulario(proposta.titulo, proposta.modelo, proposta.dados, referencias),
  );
  const [status, setStatus] = useState<StatusPropostaEquipe>(proposta.status);
  const [revisao, setRevisao] = useState({
    revisadoPorNome: proposta.revisadoPorNome,
    revisaoNota: proposta.revisaoNota,
    revisadoEm: proposta.revisadoEm,
  });
  const somenteLeitura = !podeEditar(status) || !acessos.editar;
  const [link, setLink] = useState<LinkPublico | null>(proposta.link);
  const [salvo, setSalvo] = useState<EstadoSalvo>({ tipo: "parado" });
  const [visao, setVisao] = useState<"editar" | "leitura" | "pdf">("editar");
  const [enviarAberto, setEnviarAberto] = useState(false);
  const [excluirAberto, setExcluirAberto] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const roteador = useRouter();

  const dados = useMemo(() => formularioParaDados(form), [form]);
  const pendencias = useMemo(() => validarProposta(dados, form.modelo), [dados, form.modelo]);
  const totalCentavos = useMemo(() => totalProposta(dados), [dados]);
  const total = totalCentavos / 100;
  const titulo = form.titulo.trim() === "" ? "Proposta sem título" : form.titulo.trim();
  const assinatura = useMemo(() => JSON.stringify({ titulo, modelo: form.modelo, dados }), [titulo, form.modelo, dados]);

  const assinaturaRef = useRef(assinatura);
  const ultimoSalvo = useRef(assinatura);
  const cadeia = useRef<Promise<boolean>>(Promise.resolve(true));
  const id = proposta.id;

  useEffect(() => {
    assinaturaRef.current = assinatura;
  });

  /** Grava o que está na tela agora. As gravações andam em fila, então a última sempre vence. */
  const persistir = useCallback((): Promise<boolean> => {
    const proxima = cadeia.current.then(async (): Promise<boolean> => {
      const atual = assinaturaRef.current;
      if (atual === ultimoSalvo.current) return true;
      setSalvo({ tipo: "salvando" });
      try {
        const r = await salvarPropostaAction({ id, ...(JSON.parse(atual) as object) });
        if (r.ok) {
          ultimoSalvo.current = atual;
          setSalvo({ tipo: "ok", hora: hora(r.salvoEm) });
          setStatus(r.status);
          return true;
        }
        setSalvo({ tipo: "erro", mensagem: r.mensagem });
        return false;
      } catch {
        setSalvo({ tipo: "erro", mensagem: "Sem conexão. Tente de novo." });
        return false;
      }
    });
    cadeia.current = proxima;
    return proxima;
  }, [id]);

  useEffect(() => {
    if (assinatura === ultimoSalvo.current) return;
    const t = window.setTimeout(() => {
      void persistir();
    }, 1000);
    return () => window.clearTimeout(t);
  }, [assinatura, persistir]);

  function campo<K extends keyof Formulario>(chave: K) {
    return (valor: Formulario[K]) => setForm((f) => ({ ...f, [chave]: valor }));
  }

  function agir(acao: AcaoRevisao, nota?: string) {
    setMensagem(null);
    iniciar(async () => {
      if (!(await persistir())) {
        setMensagem("Não foi possível salvar. Tente de novo.");
        return;
      }
      const r = await acaoRevisaoAction(id, acao, nota);
      if (r.ok) {
        setStatus(r.status);
        setRevisao(r.revisao);
        roteador.refresh();
      } else {
        setMensagem(r.mensagem);
      }
    });
  }

  async function baixarPdf() {
    setMensagem(null);
    const aberta = window.open("", "_blank");
    const ok = await persistir();
    if (!ok) {
      aberta?.close();
      setMensagem("Não foi possível salvar. Tente de novo.");
      return;
    }
    const destino = `/propostas/${id}/imprimir`;
    if (aberta) aberta.location.href = destino;
    else roteador.push(destino);
  }

  function duplicar() {
    setMensagem(null);
    iniciar(async () => {
      await persistir();
      const r = await duplicarPropostaAction(id);
      if (r && !r.ok) setMensagem(r.mensagem);
    });
  }

  function excluir() {
    setMensagem(null);
    iniciar(async () => {
      const r = await excluirPropostaAction(id);
      if (r && !r.ok) {
        setMensagem(r.mensagem);
        setExcluirAberto(false);
      }
    });
  }

  const abaixoDoMinimo = cotacao !== null && totalCentavos > 0 && total < cotacao.precoMinimo;
  const editavel = visao === "editar" && !somenteLeitura;
  const opcao = (ativa: boolean) => classeItemSegmentado(ativa);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <header className="nao-imprimir flex flex-col gap-3">
        <Link
          href="/propostas"
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm text-muted-foreground outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Propostas
        </Link>

        <FaixaRevisao
          dados={{
            status,
            autor: proposta.autor,
            criadoPorNome: proposta.criadoPorNome,
            revisadoPorNome: revisao.revisadoPorNome,
            revisaoNota: revisao.revisaoNota,
            revisadoEm: revisao.revisadoEm,
          }}
        />

        <input
          value={form.titulo}
          disabled={somenteLeitura}
          onChange={(e) => campo("titulo")(e.target.value)}
          aria-label="Título da proposta"
          maxLength={160}
          className={cn(CONTROLE, "h-12 text-lg font-semibold")}
        />

        {mensagem && (
          <p role="alert" className="text-[13px] text-negative">
            {mensagem}
          </p>
        )}
        {abaixoDoMinimo && cotacao && (
          <p role="alert" className="text-[13px] font-medium text-negative">
            Abaixo do seu preço mínimo de {formatarMoeda(cotacao.precoMinimo)}.
          </p>
        )}
        {avisoSemItens && (
          <p role="status" className="rounded-card border border-border bg-surface px-4 py-3 text-[13px] text-muted-foreground">
            Não deu para puxar os itens do PNCP. Preencha à mão.
          </p>
        )}
      </header>

      <BarraProposta
        salvo={salvo}
        aoTentarDeNovo={() => void persistir()}
        total={total}
        abaixoDoMinimo={abaixoDoMinimo}
        aoBaixar={() => void baixarPdf()}
        aoEnviar={acessos.editar ? () => setEnviarAberto(true) : undefined}
      />

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start xl:gap-6">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="nao-imprimir flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Modo do documento" className={TRILHO_SEGMENTADO}>
              {!somenteLeitura && (
                <button type="button" aria-pressed={visao === "editar"} onClick={() => setVisao("editar")} className={opcao(visao === "editar")}>
                  Editar
                </button>
              )}
              <button
                type="button"
                aria-pressed={visao === "leitura" || (somenteLeitura && visao === "editar")}
                onClick={() => setVisao("leitura")}
                className={opcao(visao === "leitura" || (somenteLeitura && visao === "editar"))}
              >
                Ver como ficará
              </button>
              <button
                type="button"
                aria-pressed={visao === "pdf"}
                onClick={() => setVisao("pdf")}
                className={cn(opcao(visao === "pdf"), "hidden xl:inline-flex")}
              >
                Visualizar como PDF
              </button>
            </div>
            <p className="text-[13px] text-muted-foreground">No diálogo de impressão, escolha Salvar como PDF.</p>
          </div>

          <DocumentoEditavel
            form={form}
            dados={dados}
            emitente={emitente}
            editavel={editavel}
            aoEditar={setForm}
            className={cn("mx-auto", visao === "pdf" && "xl:hidden")}
          />

          {visao === "pdf" && (
            <div className="hidden rounded-card bg-raised p-2 xl:block">
              <PreviaEscalada>
                <DocumentoProposta dados={dados} modeloId={form.modelo} emitente={emitente} />
              </PreviaEscalada>
            </div>
          )}
        </div>

        <aside
          aria-label="Painel da proposta"
          className="nao-imprimir flex min-w-0 flex-col gap-4 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-8rem)] xl:overflow-y-auto"
        >
          <div id="revisao" className="scroll-mt-16 lg:scroll-mt-24">
            <Secao id="secao-revisao" titulo="Revisão">
              <PainelRevisao
                status={status}
                autor={proposta.autor}
                criadoPor={proposta.criadoPor}
                usuarioId={usuarioId}
                acessos={acessos}
                pendencias={pendencias.length}
                pendente={pendente}
                aoAgir={agir}
              />
            </Secao>
          </div>

          <Secao id="secao-linha-do-tempo" titulo="Linha do tempo">
            <QuadroResultado dados={{ status: status === "enviada" ? "enviada" : "outro", ...proposta.resultado }} />
            <LinhaDoTempo propostaId={id} eventos={eventos} />
          </Secao>

          <Secao id="secao-pendencias" titulo={`Pendências (${pendencias.length})`}>
            {pendencias.length === 0 ? (
              <p className="text-sm text-positive">Nada pendente.</p>
            ) : (
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink">
                {pendencias.slice(0, 8).map((p) => (
                  <li key={p}>{p}</li>
                ))}
                {pendencias.length > 8 && <li className="text-muted-foreground">e mais {pendencias.length - 8}</li>}
              </ul>
            )}
          </Secao>

          {cotacao && (
            <p className="rounded-card border border-border bg-surface px-4 py-3 text-[13px] text-muted-foreground">
              Seu preço mínimo: <span className="tabular-nums text-ink">{formatarMoeda(cotacao.precoMinimo)}</span> · alvo:{" "}
              <span className="tabular-nums text-ink">{formatarMoeda(cotacao.precoAlvo)}</span>
            </p>
          )}

          {proposta.analise ? <BlocoAnalise analise={proposta.analise} /> : null}

          <Secao id="secao-modelo" titulo="Modelo">
            <p className="text-[13px] text-muted-foreground">Trocar o modelo muda os textos do documento e mantém os itens.</p>
            <div className="flex flex-col gap-2" role="group" aria-label="Modelo da proposta">
              {MODELOS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={somenteLeitura}
                  aria-pressed={form.modelo === m.id}
                  onClick={() => setForm((f) => aplicarPadroes(f, m.id))}
                  className={cn(
                    "flex min-h-11 flex-col items-start gap-0.5 rounded-control border px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-60",
                    form.modelo === m.id ? "border-brand bg-active" : "border-control bg-raised hover:bg-active",
                  )}
                >
                  <span className="text-sm font-medium text-ink">{m.nome}</span>
                  <span className="text-[13px] text-muted-foreground">{m.quandoUsar}</span>
                </button>
              ))}
            </div>
          </Secao>

          {acessos.editar && (
            <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
              <button type="button" onClick={duplicar} disabled={pendente} className={cn(BOTAO_SECUNDARIO, "sm:flex-1")}>
                <Copy aria-hidden className="size-4" />
                {pendente ? "Duplicando…" : "Duplicar proposta"}
              </button>
              <button
                type="button"
                onClick={() => setExcluirAberto(true)}
                className={cn(BOTAO_SECUNDARIO, "text-negative sm:flex-1")}
              >
                <Trash2 aria-hidden className="size-4" />
                Excluir proposta
              </button>
            </div>
          )}
        </aside>
      </div>

      <div aria-hidden className="nao-imprimir h-28 lg:hidden" />

      <FolhaEnviar
        aberto={enviarAberto}
        aoMudar={setEnviarAberto}
        propostaId={id}
        titulo={titulo}
        orgao={form.orgao}
        objeto={form.objeto}
        status={status}
        link={link}
        aoMudarLink={(novo, novoStatus) => {
          setLink(novo);
          if (novoStatus) setStatus(novoStatus);
        }}
        aoSalvar={persistir}
        emitente={emitente}
        enviadaEm={proposta.enviadaEm}
        aoRegistrarEnvio={(novoStatus) => {
          setStatus(novoStatus);
          roteador.refresh();
        }}
      />

      <Sheet open={excluirAberto} onOpenChange={setExcluirAberto}>
        <SheetContent side="right" className="gap-0">
          <SheetHeader className="pr-14">
            <SheetTitle>Excluir esta proposta?</SheetTitle>
            <SheetDescription>
              {titulo}. A proposta e o link enviado deixam de existir. Não dá para desfazer.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={excluir}
              disabled={pendente}
              className="inline-flex h-11 items-center justify-center rounded-control bg-pill-neg-bg px-4 text-sm font-medium text-pill-neg-fg outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
            >
              {pendente ? "Excluindo…" : "Excluir"}
            </button>
            <button type="button" onClick={() => setExcluirAberto(false)} className={BOTAO_SECUNDARIO}>
              Cancelar
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

