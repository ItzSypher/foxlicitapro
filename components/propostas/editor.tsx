"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Download, Send, Trash2 } from "lucide-react";
import {
  duplicarPropostaAction,
  excluirPropostaAction,
  acaoRevisaoAction,
  salvarPropostaAction,
} from "@/app/(app)/propostas/actions";
import {
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  CONTROLE,
  CampoArea,
  CampoLinha,
  Secao,
} from "@/components/propostas/campos";
import { DocumentoProposta } from "@/components/propostas/documento";
import { dadosParaFormulario, formularioParaDados, type Formulario } from "@/components/propostas/estado";
import { FolhaEnviar, type LinkPublico } from "@/components/propostas/folha-enviar";
import { PreviaEscalada } from "@/components/propostas/previa-escalada";
import { SecaoItens } from "@/components/propostas/secao-itens";
import { BlocoAnalise } from "@/components/propostas/bloco-analise";
import { FaixaRevisao } from "@/components/propostas/faixa-revisao";
import { PainelRevisao } from "@/components/propostas/painel-revisao";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { totalProposta, validarProposta, valorPorExtenso } from "@/core/proposta";
import { MODELOS, obterModelo, type ModeloId } from "@/core/proposta-modelos";
import { podeEditar, type AcaoRevisao } from "@/core/revisao";
import type { DadosProposta } from "@/core/types-detalhe";
import type { AnaliseAssistente, AutorProposta, StatusPropostaEquipe } from "@/core/types-equipe";
import { formatarMoeda } from "@/lib/formato";
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
}

interface Props {
  proposta: PropostaParaEditor;
  /** Quem está olhando a proposta */
  usuarioId: string;
  /** Valor unitário estimado pelo órgão, por número do item */
  referencias: Record<number, number>;
  cotacao: { precoMinimo: number; precoAlvo: number } | null;
  avisoSemItens: boolean;
}

type EstadoSalvo =
  | { tipo: "parado" }
  | { tipo: "salvando" }
  | { tipo: "ok"; hora: string }
  | { tipo: "erro"; mensagem: string };

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

export function Editor({ proposta, usuarioId, referencias, cotacao, avisoSemItens }: Props) {
  const [form, setForm] = useState<Formulario>(() =>
    dadosParaFormulario(proposta.titulo, proposta.modelo, proposta.dados, referencias),
  );
  const [status, setStatus] = useState<StatusPropostaEquipe>(proposta.status);
  const [revisao, setRevisao] = useState({
    revisadoPorNome: proposta.revisadoPorNome,
    revisaoNota: proposta.revisaoNota,
    revisadoEm: proposta.revisadoEm,
  });
  const somenteLeitura = !podeEditar(status);
  const [link, setLink] = useState<LinkPublico | null>(proposta.link);
  const [salvo, setSalvo] = useState<EstadoSalvo>({ tipo: "parado" });
  const [aba, setAba] = useState<"editar" | "previa">("editar");
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

  const abaveis = "inline-flex h-11 flex-1 items-center justify-center rounded-[5px] text-sm text-muted-foreground aria-selected:bg-brand-fill aria-selected:font-medium aria-selected:text-black outline-none focus-visible:ring-2 focus-visible:ring-brand";
  const abaixoDoMinimo = cotacao !== null && totalCentavos > 0 && total < cotacao.precoMinimo;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/propostas"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Propostas
          </Link>
          <div className="flex items-center gap-3">
            <p
              role="status"
              className={cn("text-[13px]", salvo.tipo === "erro" ? "text-negative" : "text-muted-foreground")}
            >
              {salvo.tipo === "salvando" && "Salvando…"}
              {salvo.tipo === "ok" && `Salvo às ${salvo.hora}`}
              {salvo.tipo === "erro" && salvo.mensagem}
            </p>
            {salvo.tipo === "erro" && (
              <button
                type="button"
                onClick={() => void persistir()}
                className="inline-flex h-11 items-center px-1 text-[13px] font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
              >
                Tentar de novo
              </button>
            )}
          </div>
        </div>

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

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void baixarPdf()} className={BOTAO_PRIMARIO}>
            <Download aria-hidden className="size-4" />
            Baixar PDF
          </button>
          <button type="button" onClick={() => setEnviarAberto(true)} className={BOTAO_SECUNDARIO}>
            <Send aria-hidden className="size-4" />
            Enviar
          </button>
          <button type="button" onClick={duplicar} disabled={pendente} className={BOTAO_SECUNDARIO}>
            <Copy aria-hidden className="size-4" />
            Duplicar
          </button>
          <button
            type="button"
            onClick={() => setExcluirAberto(true)}
            className={cn(BOTAO_SECUNDARIO, "text-negative")}
          >
            <Trash2 aria-hidden className="size-4" />
            Excluir
          </button>
        </div>
        <p className="text-[13px] text-muted-foreground">No diálogo de impressão, escolha Salvar como PDF.</p>
        {mensagem && (
          <p role="alert" className="text-[13px] text-negative">
            {mensagem}
          </p>
        )}
        {avisoSemItens && (
          <p role="status" className="rounded-card border border-border bg-surface px-4 py-3 text-[13px] text-muted-foreground">
            Não deu para puxar os itens do PNCP. Preencha à mão.
          </p>
        )}
      </header>

      <Secao id="secao-revisao" titulo="Revisão">
        <PainelRevisao
          status={status}
          autor={proposta.autor}
          criadoPor={proposta.criadoPor}
          usuarioId={usuarioId}
          pendencias={pendencias.length}
          pendente={pendente}
          aoAgir={agir}
        />
      </Secao>

      <div
        role="tablist"
        aria-label="Modo de exibição"
        className="flex gap-1 rounded-control border border-control bg-raised p-0.5 xl:hidden"
      >
        <button type="button" role="tab" aria-selected={aba === "editar"} onClick={() => setAba("editar")} className={abaveis}>
          Editar
        </button>
        <button type="button" role="tab" aria-selected={aba === "previa"} onClick={() => setAba("previa")} className={abaveis}>
          Prévia
        </button>
      </div>

      <div
        className={cn(
          "fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface px-4 py-2 lg:bottom-0 lg:left-[220px]",
          "xl:static xl:z-auto xl:rounded-card xl:border xl:px-4 xl:py-3",
        )}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] text-muted-foreground">Total</span>
          <span className="font-mono text-xl font-semibold tabular-nums text-ink">{formatarMoeda(total)}</span>
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground">{valorPorExtenso(total)}</p>
        {abaixoDoMinimo && cotacao && (
          <p role="alert" className="text-xs font-medium text-negative">
            Abaixo do seu preço mínimo de {formatarMoeda(cotacao.precoMinimo)}.
          </p>
        )}
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,620px)] xl:gap-6">
        <fieldset
          disabled={somenteLeitura}
          className={cn("m-0 min-w-0 flex-col gap-4 border-0 p-0", aba === "editar" ? "flex" : "hidden", "xl:flex")}
        >
          {proposta.analise ? <BlocoAnalise analise={proposta.analise} /> : null}

          {cotacao && (
            <p className="rounded-card border border-border bg-surface px-4 py-3 text-[13px] text-muted-foreground">
              Seu preço mínimo:{" "}
              <span className="font-mono tabular-nums text-ink">{formatarMoeda(cotacao.precoMinimo)}</span> · alvo:{" "}
              <span className="font-mono tabular-nums text-ink">{formatarMoeda(cotacao.precoAlvo)}</span>
            </p>
          )}

          <Secao id="secao-pendencias" titulo={`Pendências (${pendencias.length})`}>
            {pendencias.length === 0 ? (
              <p className="text-sm text-positive">Nada pendente.</p>
            ) : (
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink">
                {pendencias.slice(0, 8).map((p) => (
                  <li key={p}>{p}</li>
                ))}
                {pendencias.length > 8 && (
                  <li className="text-muted-foreground">e mais {pendencias.length - 8}</li>
                )}
              </ul>
            )}
          </Secao>

          <Secao id="secao-destinatario" titulo="Destinatário">
            <CampoLinha id="orgao" rotulo="Órgão" valor={form.orgao} onMudar={campo("orgao")} />
            <CampoLinha id="unidade" rotulo="Unidade" valor={form.unidade} onMudar={campo("unidade")} />
            <div className="grid gap-3 sm:grid-cols-2">
              <CampoLinha id="compra" rotulo="Nº da compra" valor={form.numeroCompra} onMudar={campo("numeroCompra")} maxLength={60} />
              <CampoLinha id="processo" rotulo="Processo" valor={form.processo} onMudar={campo("processo")} maxLength={60} />
            </div>
            <CampoArea id="objeto" rotulo="Objeto" valor={form.objeto} onMudar={campo("objeto")} linhas={3} />
          </Secao>

          <SecaoItens itens={form.itens} aoMudar={(itens) => setForm((f) => ({ ...f, itens }))} />

          <Secao id="secao-condicoes" titulo="Condições">
            <div className="grid grid-cols-2 gap-3">
              <CampoLinha
                id="validade"
                rotulo="Validade (dias)"
                valor={form.validadeDias}
                onMudar={campo("validadeDias")}
                inputMode="numeric"
                maxLength={4}
              />
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="data-proposta" className="text-[13px] font-medium text-ink">
                  Data da proposta
                </label>
                <input
                  id="data-proposta"
                  type="date"
                  value={form.data}
                  onChange={(e) => campo("data")(e.target.value)}
                  className={cn(CONTROLE, "font-mono tabular-nums")}
                />
              </div>
            </div>
            <CampoArea id="prazo" rotulo="Prazo de entrega ou execução" valor={form.prazoEntrega} onMudar={campo("prazoEntrega")} linhas={2} />
            <CampoArea id="local" rotulo="Local de entrega" valor={form.localEntrega} onMudar={campo("localEntrega")} linhas={2} />
            <CampoArea id="pagamento" rotulo="Pagamento" valor={form.pagamento} onMudar={campo("pagamento")} linhas={2} />
            <CampoArea id="garantia" rotulo="Garantia" valor={form.garantia} onMudar={campo("garantia")} linhas={2} />
            <CampoArea id="observacoes" rotulo="Observações" valor={form.observacoes} onMudar={campo("observacoes")} linhas={3} />
          </Secao>

          <Secao id="secao-modelo" titulo="Modelo">
            <p className="text-[13px] text-muted-foreground">Trocar o modelo muda os textos do documento e mantém os itens.</p>
            <div className="flex flex-col gap-2" role="group" aria-label="Modelo da proposta">
              {MODELOS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={form.modelo === m.id}
                  onClick={() => setForm((f) => aplicarPadroes(f, m.id))}
                  className={cn(
                    "flex min-h-11 flex-col items-start gap-0.5 rounded-control border px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand",
                    form.modelo === m.id ? "border-brand bg-active" : "border-control bg-raised hover:bg-active",
                  )}
                >
                  <span className="text-sm font-medium text-ink">{m.nome}</span>
                  <span className="text-[13px] text-muted-foreground">{m.quandoUsar}</span>
                </button>
              ))}
            </div>
          </Secao>
          <div aria-hidden className="h-20 xl:hidden" />
        </fieldset>

        <div className={cn("min-w-0", aba === "previa" ? "block" : "hidden", "xl:block")}>
          <div className="rounded-card bg-raised p-2 xl:sticky xl:top-8 xl:max-h-[calc(100dvh-4rem)] xl:overflow-y-auto">
            <PreviaEscalada>
              <DocumentoProposta dados={dados} modeloId={form.modelo} />
            </PreviaEscalada>
          </div>
          <div aria-hidden className="h-20 xl:hidden" />
        </div>
      </div>

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
      />

      <Sheet open={excluirAberto} onOpenChange={setExcluirAberto}>
        <SheetContent side="right" className="gap-0">
          <SheetHeader className="pr-14">
            <SheetTitle>Excluir esta proposta?</SheetTitle>
            <SheetDescription>
              {titulo}. A proposta e o link enviado deixam de existir. Não dá para desfazer.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-4 pb-6">
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
