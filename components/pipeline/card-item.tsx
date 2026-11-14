"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { comentarAction, lerComentariosAction, salvarNotas } from "@/app/(app)/pipeline/actions";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ComentarioPipeline } from "@/core/types-equipe";
import { resumirObjeto } from "@/core/objeto";
import { PASSOS_JURIDICOS, checklistCompleto } from "@/core/revisao-juridica";
import type { Faixa } from "@/core/types";
import { restanteMs } from "@/lib/formato";
import { useAgora } from "@/lib/relogio";
import { cn } from "@/lib/utils";
import { formatarReais, textoFecha } from "./formato";
import { MenuAcoes } from "./menu-acoes";
import { CLASSE_FOLHA, useColunas } from "./midia";
import { RevisaoJuridica } from "./revisao-juridica";
import type { EtapaId, ItemPipeline, PessoaPipeline } from "./tipos";

const COR_FAIXA: Record<Faixa, string> = {
  go: "text-positive",
  atencao: "text-warning",
  nogo: "text-negative",
};

const LINHA_FOLHA =
  "flex h-11 w-full items-center justify-between gap-2 rounded-control bg-raised px-3 text-left text-[13px] text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand";

/** Folha com o conteúdo de um card: sobe de baixo no celular e abre à direita nas colunas. */
function Folha({
  aberto,
  aoMudar,
  titulo,
  descricao,
  children,
}: {
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  const colunas = useColunas();
  return (
    <Sheet open={aberto} onOpenChange={aoMudar}>
      <SheetContent side={colunas ? "right" : "bottom"} className={colunas ? "gap-0 overflow-y-auto" : CLASSE_FOLHA}>
        <SheetHeader className="pr-14">
          <SheetTitle>{titulo}</SheetTitle>
          <SheetDescription className="line-clamp-2">{descricao}</SheetDescription>
        </SheetHeader>
        <div className="flex min-w-0 flex-col gap-3 px-4 pb-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

/** Linha do card que mostra o andamento da revisão jurídica e abre o checklist numa folha. */
function LinhaRevisao({
  dado,
  titulo,
  podeRevisar,
  aoAbrir,
}: {
  dado: ItemPipeline;
  titulo: string;
  podeRevisar: boolean;
  aoAbrir: (aberto: boolean) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const completo = checklistCompleto(dado.revisao);
  function mudar(valor: boolean) {
    setAberto(valor);
    aoAbrir(valor);
  }
  return (
    <>
      <button type="button" onClick={() => mudar(true)} aria-haspopup="dialog" className={LINHA_FOLHA}>
        <span>Revisão jurídica</span>
        <span className="flex items-center gap-1 font-mono text-xs tabular-nums text-muted-foreground">
          <span className={completo ? "text-positive" : ""}>
            {completo ? "Ok" : `${dado.revisao.length}/${PASSOS_JURIDICOS.length}`}
          </span>
          <ChevronRight aria-hidden="true" className="size-4" />
        </span>
      </button>
      <Folha aberto={aberto} aoMudar={mudar} titulo="Revisão jurídica" descricao={titulo}>
        <RevisaoJuridica
          key={dado.revisao.map((m) => `${m.passo}:${m.em}`).join("|")}
          itemId={dado.id}
          inicial={dado.revisao}
          podeMarcar={podeRevisar}
        />
      </Folha>
    </>
  );
}

function Prazo({ encerramentoIso, agoraInicial }: { encerramentoIso: string; agoraInicial: number }) {
  const fim = Date.parse(encerramentoIso);
  const agora = useAgora(Number.isNaN(fim) ? null : fim, agoraInicial);
  const texto = textoFecha(restanteMs(encerramentoIso, agora));
  return (
    <span
      className={cn(
        "font-mono text-xs tabular-nums",
        texto === null ? "text-muted-foreground" : "text-ink",
      )}
    >
      {texto ?? "Encerrada"}
    </span>
  );
}

function Notas({
  id,
  inicial,
  aoAbrir,
  somenteLeitura,
}: {
  id: string;
  inicial: string;
  aoAbrir: (aberto: boolean) => void;
  somenteLeitura: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState(inicial);
  const [base, setBase] = useState(inicial);
  const [carimbo, setCarimbo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  useEffect(() => {
    if (!carimbo) return;
    const t = setTimeout(() => setCarimbo(false), 2000);
    return () => clearTimeout(t);
  }, [carimbo]);

  function alternar() {
    const novo = !aberto;
    setAberto(novo);
    aoAbrir(novo);
  }

  function salvar() {
    if (somenteLeitura || texto === base) return;
    setErro(null);
    iniciar(async () => {
      const r = await salvarNotas(id, texto);
      if (r.ok) {
        setBase(texto);
        setCarimbo(true);
      } else {
        setErro(r.erro);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={alternar}
          aria-expanded={aberto}
          className="inline-flex h-11 items-center gap-1 rounded-control text-[13px] text-muted-foreground outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand lg:h-8"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn("size-4 transition-transform", aberto ? "rotate-180" : "")}
          />
          {base.trim() === "" ? "Notas" : "Notas (com texto)"}
        </button>
        {carimbo ? (
          <span role="status" className="text-xs text-faint">
            Salvo
          </span>
        ) : null}
      </div>
      {aberto ? (
        <>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={salvar}
            readOnly={somenteLeitura}
            rows={4}
            maxLength={5000}
            aria-label="Notas do item"
            className="w-full resize-y rounded-control border border-control bg-ground p-2 font-mono text-base leading-snug text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand md:text-[13px]"
          />
          {erro ? (
            <p role="alert" className="text-xs text-negative">
              {erro}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

const horaFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
  hourCycle: "h23",
});

/** "agora", "há 5 min", "há 3 h", "ontem" ou a data, em relação a agora. */
function horaRelativa(iso: string, agora: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const minutos = Math.max(0, Math.floor((agora - t) / 60_000));
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return horaFmt.format(new Date(t)).replace(" ", ", ");
}

function Comentarios({
  id,
  total,
  titulo,
  aoAbrir,
}: {
  id: string;
  total: number;
  titulo: string;
  aoAbrir: (aberto: boolean) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<ComentarioPipeline[] | null>(null);
  const [quantidade, setQuantidade] = useState(total);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const [agora, setAgora] = useState<number | null>(null);

  function mudar(novo: boolean) {
    setAberto(novo);
    aoAbrir(novo);
    if (novo && lista === null) {
      setErro(null);
      iniciar(async () => {
        const r = await lerComentariosAction(id);
        if (r.ok) {
          setLista(r.comentarios);
          setQuantidade(r.comentarios.length);
          setAgora(Date.now());
        } else {
          setErro(r.erro);
        }
      });
    }
  }

  function enviar() {
    if (texto.trim() === "") return;
    setErro(null);
    iniciar(async () => {
      const r = await comentarAction(id, texto);
      if (r.ok) {
        setLista(r.comentarios);
        setQuantidade(r.comentarios.length);
        setAgora(Date.now());
        setTexto("");
      } else {
        setErro(r.erro);
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => mudar(true)} aria-haspopup="dialog" className={LINHA_FOLHA}>
        <span>Comentários</span>
        <span className="flex items-center gap-1 font-mono text-xs tabular-nums text-muted-foreground">
          {quantidade}
          <ChevronRight aria-hidden="true" className="size-4" />
        </span>
      </button>
      <Folha aberto={aberto} aoMudar={mudar} titulo="Comentários" descricao={titulo}>
        {lista === null && !erro ? <p className="text-xs text-muted-foreground">Carregando…</p> : null}
        {lista !== null && lista.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum comentário ainda.</p>
        ) : null}
        {lista !== null && lista.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {lista.map((c) => (
              <li key={c.id} className="flex flex-col gap-0.5 rounded-control bg-raised px-2.5 py-2">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-ink">{c.autor ?? "Pessoa removida"}</span>
                  {agora === null ? "" : ` · ${horaRelativa(c.em, agora)}`}
                </p>
                <p className="text-[13px] leading-snug whitespace-pre-line text-ink">{c.texto}</p>
              </li>
            ))}
          </ul>
        ) : null}
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          maxLength={2000}
          aria-label="Escrever comentário"
          placeholder="Escreva um comentário"
          className="w-full resize-y rounded-control border border-control bg-ground p-2 text-base leading-snug text-ink outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand md:text-[13px]"
        />
        <button
          type="button"
          onClick={enviar}
          disabled={pendente || texto.trim() === ""}
          className="inline-flex h-11 items-center justify-center rounded-control bg-brand-fill px-4 text-sm font-medium text-black outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 lg:h-9"
        >
          Comentar
        </button>
        {erro ? (
          <p role="alert" className="text-xs text-negative">
            {erro}
          </p>
        ) : null}
      </Folha>
    </>
  );
}

function Responsavel({
  dado,
  pessoas,
  aoMudar,
  somenteLeitura,
}: {
  dado: ItemPipeline;
  pessoas: PessoaPipeline[];
  aoMudar: (responsavelId: string | null) => void;
  somenteLeitura: boolean;
}) {
  const id = `resp-${dado.id}`;
  // Responsável que saiu da equipe continua aparecendo, para o valor não sumir do seletor.
  const foraDaLista =
    dado.responsavelId !== null && !pessoas.some((p) => p.id === dado.responsavelId)
      ? { id: dado.responsavelId, nome: dado.responsavelNome ?? "Pessoa removida" }
      : null;
  if (somenteLeitura) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">
          {dado.criadoPorNome ? `Adicionado por ${dado.criadoPorNome}` : "Adicionado por pessoa não registrada"}
        </p>
        <p className="text-[13px] text-ink">Responsável: {dado.responsavelNome ?? "ninguém"}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">
        {dado.criadoPorNome ? `Adicionado por ${dado.criadoPorNome}` : "Adicionado por pessoa não registrada"}
      </p>
      <label htmlFor={id} className="text-xs text-muted-foreground">
        Responsável
      </label>
      <select
        id={id}
        value={dado.responsavelId ?? ""}
        onChange={(e) => aoMudar(e.target.value === "" ? null : e.target.value)}
        className="h-11 w-full rounded-control border border-control bg-ground px-2 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand lg:h-9 lg:text-[13px]"
      >
        <option value="">Sem responsável</option>
        {foraDaLista ? <option value={foraDaLista.id}>{foraDaLista.nome}</option> : null}
        {pessoas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </select>
    </div>
  );
}

interface Props {
  dado: ItemPipeline;
  pessoas: PessoaPipeline[];
  aoResponsavel: (id: string, responsavelId: string | null) => void;
  agoraInicial: number;
  podeEditar: boolean;
  /** Tem a permissão de revisão jurídica: pode marcar o checklist */
  podeRevisar: boolean;
  arrastavel: boolean;
  arrastando: boolean;
  aoIniciarArraste: (id: string) => void;
  aoTerminarArraste: () => void;
  aoMover: (id: string, etapa: EtapaId) => void;
  aoRemover: (id: string) => void;
}

export function CardItem({
  dado,
  pessoas,
  aoResponsavel,
  agoraInicial,
  podeEditar,
  podeRevisar,
  arrastavel,
  arrastando,
  aoIniciarArraste,
  aoTerminarArraste,
  aoMover,
  aoRemover,
}: Props) {
  const { item } = dado;
  const [confirmando, setConfirmando] = useState(false);
  const [notasAbertas, setNotasAbertas] = useState(false);
  const [comentariosAbertos, setComentariosAbertos] = useState(false);
  const [revisaoAberta, setRevisaoAberta] = useState(false);
  const titulo = useMemo(() => resumirObjeto(item.objeto), [item.objeto]);
  const tituloCurto = titulo.length > 90 ? `${titulo.slice(0, 89)}…` : titulo;
  const pncp = item.linkPncp;
  const podeArrastar = arrastavel && !notasAbertas && !comentariosAbertos && !revisaoAberta && !confirmando;

  return (
    <li
      draggable={podeArrastar}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", dado.id);
        e.dataTransfer.effectAllowed = "move";
        aoIniciarArraste(dado.id);
      }}
      onDragEnd={aoTerminarArraste}
      className={cn(
        "flex min-w-0 flex-col gap-2.5 rounded-card border border-border bg-surface p-3",
        podeArrastar ? "cursor-grab active:cursor-grabbing" : "",
        arrastando ? "opacity-40" : "",
      )}
    >
      <div className="-mt-1 -mr-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-2">
          <span
            className={cn(
              "font-mono text-base font-medium tabular-nums",
              COR_FAIXA[item.score.faixa],
            )}
          >
            {item.score.total}
          </span>
          <Prazo encerramentoIso={item.dataEncerramento} agoraInicial={agoraInicial} />
        </span>
        <span className="flex shrink-0 items-center">
          <Link
            href={`/licitacao/${item.orgaoCnpj}/${item.anoCompra}/${item.sequencialCompra}`}
            className="inline-flex h-11 items-center rounded-control px-2 text-[13px] font-medium text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand lg:h-8"
          >
            Abrir
          </Link>
          <MenuAcoes
            etapa={dado.etapa}
            itemId={dado.id}
            linkPncp={pncp}
            titulo={tituloCurto}
            podeEditar={podeEditar}
            aoMover={(etapa) => aoMover(dado.id, etapa)}
            aoPedirRemocao={() => setConfirmando(true)}
          />
        </span>
      </div>

      <p className="line-clamp-3 text-sm font-medium leading-snug text-ink">{titulo}</p>

      <p className="text-[13px] leading-snug text-muted-foreground">
        {item.municipio} ·{" "}
        <span className="font-mono tabular-nums">
          {item.valorEstimado === null ? "—" : formatarReais(item.valorEstimado)}
        </span>
      </p>

      <Responsavel
        dado={dado}
        pessoas={pessoas}
        aoMudar={(r) => aoResponsavel(dado.id, r)}
        somenteLeitura={!podeEditar}
      />

      {dado.etapa === "revisao_juridica" ? (
        <LinhaRevisao dado={dado} titulo={tituloCurto} podeRevisar={podeRevisar} aoAbrir={setRevisaoAberta} />
      ) : null}

      <Notas id={dado.id} inicial={dado.notas} aoAbrir={setNotasAbertas} somenteLeitura={!podeEditar} />

      <Comentarios id={dado.id} total={dado.comentarios} titulo={tituloCurto} aoAbrir={setComentariosAbertos} />

      {confirmando && podeEditar ? (
        <div role="group" aria-label="Confirmar remoção" className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="text-[13px] leading-snug text-ink">
            Remover “{tituloCurto}” do pipeline?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => aoRemover(dado.id)}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-control bg-negative px-3 text-sm font-medium text-ground outline-none focus-visible:ring-2 focus-visible:ring-brand lg:h-9"
            >
              Remover
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-control border border-control px-3 text-sm text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand lg:h-9"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
