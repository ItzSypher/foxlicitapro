"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Send, X } from "lucide-react";
import { TextoComLinks } from "@/components/assistente/texto-com-links";
import { interpretarRota, sugestoesRapidas } from "@/lib/assistente/rota";

interface Mensagem {
  papel: "usuario" | "assistente";
  texto: string;
}

const MAX_HISTORICO = 12;
const MAX_TEXTO = 2000;

function Raposa({ classe }: { classe: string }) {
  return <Image src="/raposa.svg" alt="" width={249} height={254} unoptimized className={classe} />;
}

/** Posição do botão: acima da barra inferior e das barras fixas de cada página no celular. */
function posicaoBotao(tipo: string, caminho: string): string {
  if (tipo === "licitacao") return "bottom-[calc(142px+env(safe-area-inset-bottom))] lg:bottom-6";
  if (tipo === "proposta") return "bottom-[calc(152px+env(safe-area-inset-bottom))] lg:bottom-[104px] xl:bottom-6";
  if (caminho.startsWith("/calculadora")) return "bottom-[calc(140px+env(safe-area-inset-bottom))] lg:bottom-6";
  return "bottom-[calc(80px+env(safe-area-inset-bottom))] lg:bottom-6";
}

/** Chat flutuante. O histórico (até 12 mensagens) fica só aqui; o contexto da página é montado no servidor. */
export function Assistente() {
  const caminho = usePathname();
  const rota = interpretarRota(caminho);
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens, pensando, erro, aberto]);

  useEffect(() => {
    if (aberto) campo.current?.focus();
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  async function perguntar(historico: Mensagem[]) {
    setErro(null);
    setPensando(true);
    try {
      const r = await fetch("/api/assistente/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rota: caminho, mensagens: historico.slice(-MAX_HISTORICO) }),
      });
      const corpo: unknown = await r.json().catch(() => null);
      const resposta =
        corpo !== null && typeof corpo === "object" && "resposta" in corpo && typeof corpo.resposta === "string"
          ? corpo.resposta
          : null;
      const mensagemErro =
        corpo !== null && typeof corpo === "object" && "erro" in corpo && typeof corpo.erro === "string" ? corpo.erro : null;
      if (!r.ok || resposta === null) {
        setErro(mensagemErro ?? "Não foi possível responder agora.");
      } else {
        const nova: Mensagem = { papel: "assistente", texto: resposta };
        setMensagens((atuais) => [...atuais, nova].slice(-MAX_HISTORICO));
      }
    } catch {
      setErro("Não foi possível falar com o assistente agora.");
    }
    setPensando(false);
  }

  function enviar(conteudo: string) {
    const limpo = conteudo.trim().slice(0, MAX_TEXTO);
    if (limpo === "" || pensando) return;
    const historico = [...mensagens, { papel: "usuario" as const, texto: limpo }].slice(-MAX_HISTORICO);
    setMensagens(historico);
    setTexto("");
    void perguntar(historico);
  }

  function tentarDeNovo() {
    if (pensando || mensagens.length === 0) return;
    void perguntar(mensagens);
  }

  const sugestoes = sugestoesRapidas(rota);

  return (
    <>
      {aberto ? null : (
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Abrir o assistente"
          className={`fixed right-4 z-40 flex size-14 items-center justify-center rounded-full border border-border bg-surface shadow-sm outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-brand lg:right-6 ${posicaoBotao(rota.tipo, caminho)}`}
        >
          <Raposa classe="h-8 w-auto" />
        </button>
      )}

      {aberto ? (
        <section
          role="dialog"
          aria-label="Assistente"
          className="fixed inset-0 z-50 flex h-dvh flex-col bg-ground animate-in fade-in slide-in-from-bottom-4 duration-200 motion-reduce:animate-none lg:inset-auto lg:right-6 lg:bottom-6 lg:h-[560px] lg:w-[380px] lg:rounded-card lg:border lg:border-border lg:shadow-lg"
        >
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border pr-1 pl-4">
            <div className="flex items-center gap-2">
              <Raposa classe="h-6 w-auto" />
              <h2 className="text-sm font-semibold text-ink">Assistente</h2>
            </div>
            <button
              type="button"
              onClick={() => setAberto(false)}
              aria-label="Fechar o assistente"
              className="inline-flex size-11 items-center justify-center rounded-control text-muted-foreground outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {mensagens.length === 0 ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm leading-snug text-muted-foreground">
                  Pergunte sobre esta página. Respondo com base nos dados que estão nela.
                </p>
                <div className="flex flex-wrap gap-2">
                  {sugestoes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => enviar(s)}
                      className="min-h-9 rounded-control border border-control bg-transparent px-3 py-1.5 text-left text-[13px] text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {mensagens.map((m, i) => (
              <div
                key={i}
                className={
                  m.papel === "usuario"
                    ? "ml-auto max-w-[85%] rounded-card bg-active px-3 py-2 text-sm leading-snug break-words text-ink"
                    : "mr-auto max-w-[92%] rounded-card border border-border bg-surface px-3 py-2 text-sm leading-snug break-words text-ink"
                }
              >
                <TextoComLinks texto={m.texto} />
              </div>
            ))}

            {pensando ? (
              <p role="status" className="mr-auto rounded-card border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
                Pensando…
              </p>
            ) : null}

            {erro ? (
              <div role="alert" className="flex flex-col items-start gap-2 text-sm text-negative">
                <p>{erro}</p>
                {mensagens.length > 0 && mensagens[mensagens.length - 1].papel === "usuario" ? (
                  <button
                    type="button"
                    onClick={tentarDeNovo}
                    className="min-h-9 rounded-control border border-control px-3 text-[13px] font-medium text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    Tentar de novo
                  </button>
                ) : null}
              </div>
            ) : null}
            <div ref={fim} />
          </div>

          <form
            className="flex shrink-0 items-end gap-2 border-t border-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:pb-3"
            onSubmit={(e) => {
              e.preventDefault();
              enviar(texto);
            }}
          >
            <textarea
              ref={campo}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  enviar(texto);
                }
              }}
              rows={2}
              maxLength={MAX_TEXTO}
              placeholder="Escreva sua pergunta"
              aria-label="Sua pergunta"
              className="max-h-32 min-h-11 flex-1 resize-none rounded-control border border-control bg-surface px-3 py-2 text-base text-ink outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-brand md:text-sm"
            />
            <button
              type="submit"
              disabled={pensando || texto.trim() === ""}
              aria-label="Enviar"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-control bg-brand-fill text-black outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
            >
              <Send aria-hidden="true" className="size-4" />
            </button>
          </form>
        </section>
      ) : null}
    </>
  );
}
