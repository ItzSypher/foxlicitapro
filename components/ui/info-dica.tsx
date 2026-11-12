"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

const CONSULTA_ESTREITA = "(max-width: 639px)";
const LARGURA_MAXIMA = 280;
const MARGEM = 8;
const ATRASO_FECHAR_MS = 140;

function assinarEstreita(avisar: () => void): () => void {
  const lista = window.matchMedia(CONSULTA_ESTREITA);
  lista.addEventListener("change", avisar);
  return () => lista.removeEventListener("change", avisar);
}

function useTelaEstreita(): boolean {
  return useSyncExternalStore(
    assinarEstreita,
    () => window.matchMedia(CONSULTA_ESTREITA).matches,
    () => false,
  );
}

interface Posicao {
  top: number;
  left: number;
  largura: number;
}

/** Posiciona o balão perto do botão sem sair da tela: abaixo se couber, senão acima. */
function calcularPosicao(botao: HTMLElement, balao: HTMLElement): Posicao {
  const alvo = botao.getBoundingClientRect();
  const largura = Math.min(LARGURA_MAXIMA, window.innerWidth - 2 * MARGEM);
  const altura = balao.offsetHeight;
  const esquerda = alvo.left + alvo.width / 2 - largura / 2;
  const left = Math.min(Math.max(esquerda, MARGEM), window.innerWidth - largura - MARGEM);
  const cabeAbaixo = alvo.bottom + MARGEM + altura <= window.innerHeight - MARGEM;
  const topIdeal = cabeAbaixo ? alvo.bottom + 4 : alvo.top - altura - 4;
  const top = Math.min(Math.max(topIdeal, MARGEM), Math.max(MARGEM, window.innerHeight - altura - MARGEM));
  return { top, left, largura };
}

interface Props {
  /** Texto lido por leitores de tela no botão */
  rotulo?: string;
  /** Conteúdo do balão */
  children: React.ReactNode;
  className?: string;
}

/**
 * Ícone "i" que explica um termo ou uma nota.
 * Mouse: abre ao passar e ao focar pelo teclado; um clique fixa o balão.
 * Toque: abre e fecha ao tocar. Esc e toque fora fecham.
 * O balão usa a camada superior do navegador (atributo popover): não é cortado por rolagem
 * nem por cartões. Em telas estreitas vira um painel ancorado na base.
 */
export function InfoDica({ rotulo = "O que é isso?", children, className }: Props) {
  const idBalao = useId();
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState<Posicao | null>(null);
  const estreita = useTelaEstreita();

  const raizRef = useRef<HTMLSpanElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const balaoRef = useRef<HTMLDivElement>(null);
  const fixadoRef = useRef(false);
  const ultimoTipoRef = useRef<string>("mouse");
  const temporizadorRef = useRef<number | undefined>(undefined);

  const cancelarFechamento = useCallback(() => {
    window.clearTimeout(temporizadorRef.current);
  }, []);

  const fechar = useCallback(() => {
    window.clearTimeout(temporizadorRef.current);
    fixadoRef.current = false;
    setAberto(false);
    setPosicao(null);
  }, []);

  const agendarFechamento = useCallback(() => {
    window.clearTimeout(temporizadorRef.current);
    temporizadorRef.current = window.setTimeout(() => {
      if (fixadoRef.current) return;
      setAberto(false);
      setPosicao(null);
    }, ATRASO_FECHAR_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(temporizadorRef.current), []);

  // Mostra o balão na camada superior assim que ele existe no DOM.
  useLayoutEffect(() => {
    const balao = balaoRef.current;
    if (!aberto || !balao) return;
    if (!balao.matches(":popover-open")) {
      try {
        balao.showPopover();
      } catch {
        // navegador sem a API popover: o balão fica como bloco comum
      }
    }
  }, [aberto]);

  // Em tela larga, mede e posiciona; reposiciona quando a página rola ou muda de tamanho.
  useLayoutEffect(() => {
    const botao = botaoRef.current;
    const balao = balaoRef.current;
    if (!aberto || estreita || !botao || !balao) return;
    const atualizar = () => setPosicao(calcularPosicao(botao, balao));
    atualizar();
    window.addEventListener("scroll", atualizar, true);
    window.addEventListener("resize", atualizar);
    return () => {
      window.removeEventListener("scroll", atualizar, true);
      window.removeEventListener("resize", atualizar);
    };
  }, [aberto, estreita]);

  // Esc e toque fora fecham.
  useEffect(() => {
    if (!aberto) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      evento.stopPropagation();
      evento.preventDefault();
      fechar();
      botaoRef.current?.focus();
    }
    function aoTocarFora(evento: PointerEvent) {
      const alvo = evento.target;
      if (alvo instanceof Node && raizRef.current?.contains(alvo)) return;
      fechar();
    }
    document.addEventListener("keydown", aoTeclar, true);
    document.addEventListener("pointerdown", aoTocarFora, true);
    return () => {
      document.removeEventListener("keydown", aoTeclar, true);
      document.removeEventListener("pointerdown", aoTocarFora, true);
    };
  }, [aberto, fechar]);

  function aoEntrarMouse(evento: React.PointerEvent) {
    if (evento.pointerType !== "mouse") return;
    cancelarFechamento();
    setAberto(true);
  }

  function aoSairMouse(evento: React.PointerEvent) {
    if (evento.pointerType !== "mouse") return;
    if (!fixadoRef.current) agendarFechamento();
  }

  function aoClicar(evento: React.MouseEvent) {
    evento.stopPropagation();
    const porMouse = ultimoTipoRef.current === "mouse" && evento.detail > 0;
    if (porMouse) {
      if (aberto && fixadoRef.current) {
        fechar();
      } else {
        fixadoRef.current = true;
        setAberto(true);
      }
      return;
    }
    if (aberto) {
      fechar();
    } else {
      fixadoRef.current = true;
      setAberto(true);
    }
  }

  function aoFocar(evento: React.FocusEvent<HTMLButtonElement>) {
    if (evento.currentTarget.matches(":focus-visible")) setAberto(true);
  }

  function aoDesfocar(evento: React.FocusEvent<HTMLButtonElement>) {
    const proximo = evento.relatedTarget;
    if (proximo instanceof Node && raizRef.current?.contains(proximo)) return;
    if (!fixadoRef.current) {
      setAberto(false);
      setPosicao(null);
    }
  }

  const estiloBalao: React.CSSProperties = estreita
    ? {
        inset: "auto 12px calc(env(safe-area-inset-bottom, 0px) + 12px) 12px",
        margin: 0,
        width: "auto",
        maxWidth: "none",
      }
    : {
        inset: "auto",
        margin: 0,
        top: posicao?.top ?? 0,
        left: posicao?.left ?? 0,
        width: posicao?.largura ?? LARGURA_MAXIMA,
        visibility: posicao ? "visible" : "hidden",
      };

  return (
    <span
      ref={raizRef}
      className={cn("relative z-10 inline-flex shrink-0", className)}
      onPointerEnter={aoEntrarMouse}
      onPointerLeave={aoSairMouse}
    >
      <button
        ref={botaoRef}
        type="button"
        aria-label={rotulo}
        aria-expanded={aberto}
        aria-describedby={aberto ? idBalao : undefined}
        onPointerDown={(evento) => {
          ultimoTipoRef.current = evento.pointerType;
        }}
        onClick={aoClicar}
        onFocus={aoFocar}
        onBlur={aoDesfocar}
        className="inline-flex size-11 cursor-help items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-brand aria-expanded:text-brand"
      >
        <Info className="size-4" aria-hidden="true" />
      </button>

      {aberto ? (
        <div
          ref={balaoRef}
          id={idBalao}
          role={estreita ? undefined : "tooltip"}
          popover="manual"
          style={estiloBalao}
          className={cn(
            "fixed max-h-[70dvh] overflow-y-auto rounded-card border border-control bg-surface p-3 text-left text-[13px] leading-snug font-normal whitespace-normal text-ink shadow-lg",
            estreita ? "max-w-none" : "max-w-[280px]",
          )}
        >
          {children}
          {estreita ? (
            <button
              type="button"
              onClick={() => {
                fechar();
                botaoRef.current?.focus();
              }}
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-control border border-control text-sm font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <X className="size-4" aria-hidden="true" />
              Fechar
            </button>
          ) : null}
        </div>
      ) : null}
    </span>
  );
}
