"use client";

import { Suspense, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EVENTO_TOUR_TELA,
  calcularBalao,
  chaveVisto,
  deslocamentoParaVer,
  ehCelular,
  escolherPassos,
  recorteDoAlvo,
  rotaDoCaminho,
  temArea,
  vizinho,
  type PassoTour,
  type Retangulo,
  type RotaTour,
  type Tamanho,
} from "./logica";
import { roteiroDaRota } from "./roteiros";

const ATRASO_ABERTURA_MS = 800;
const FOLGA_DESTAQUE = 6;
const TAMANHO_INICIAL: Tamanho = { largura: 340, altura: 240 };

const BOTAO_BASE =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none";

const VARIANTES = {
  entra: (direcao: number) => ({ opacity: 0, x: direcao * 18 }),
  fica: { opacity: 1, x: 0 },
  sai: (direcao: number) => ({ opacity: 0, x: direcao * -18 }),
};

function lerVisto(chave: string): boolean {
  try {
    return window.localStorage.getItem(chave) !== null;
  } catch {
    return false;
  }
}

function gravarVisto(chave: string) {
  try {
    window.localStorage.setItem(chave, "1");
  } catch {
    // Armazenamento bloqueado: o tour só pode voltar a abrir sozinho.
  }
}

function paraRetangulo(r: DOMRect): Retangulo {
  return { x: r.left, y: r.top, largura: r.width, altura: r.height };
}

function mesmoRetangulo(a: Retangulo | null, b: Retangulo | null): boolean {
  if (a === null || b === null) return a === b;
  return a.x === b.x && a.y === b.y && a.largura === b.largura && a.altura === b.altura;
}

/** Primeiro elemento marcado com o alvo que aparece na tela (o menu lateral e o do celular repetem o mesmo alvo). */
function acharAlvo(alvo: string): HTMLElement | null {
  const todos = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${alvo}"]`));
  return todos.find((el) => temArea(paraRetangulo(el.getBoundingClientRect()))) ?? null;
}

/**
 * Tour guiado: destaca elementos da tela e explica cada um num balão.
 * Abre sozinho na primeira visita de cada tela e pode ser reaberto pelo menu.
 */
export function TourGuiado({ usuarioId }: { usuarioId: string }) {
  return (
    <Suspense fallback={null}>
      <TourComCaminho usuarioId={usuarioId} />
    </Suspense>
  );
}

function TourComCaminho({ usuarioId }: { usuarioId: string }) {
  const rota = rotaDoCaminho(usePathname());
  if (rota === null) return null;
  // A chave recomeça o tour quando a pessoa muda de tela.
  return <TourDaRota key={rota} rota={rota} usuarioId={usuarioId} />;
}

function TourDaRota({ rota, usuarioId }: { rota: RotaTour; usuarioId: string }) {
  const reduzir = useReducedMotion() ?? false;
  const idTitulo = useId();
  const idTexto = useId();
  const [aberto, setAberto] = useState(false);
  const [passos, setPassos] = useState<PassoTour[]>([]);
  const [indice, setIndice] = useState(0);
  const [direcao, setDirecao] = useState(1);
  const [alvo, setAlvo] = useState<Retangulo | null>(null);
  const [viewport, setViewport] = useState<Tamanho>({ largura: 1024, altura: 768 });
  const [tamanho, setTamanho] = useState<Tamanho>(TAMANHO_INICIAL);
  const balaoRef = useRef<HTMLDivElement>(null);
  const proximoRef = useRef<HTMLButtonElement>(null);
  const tamanhoRef = useRef<Tamanho>(TAMANHO_INICIAL);
  const focoAnterior = useRef<HTMLElement | null>(null);

  const chave = chaveVisto(usuarioId, rota);
  const passo: PassoTour | undefined = passos[indice];
  const alvoId = passo?.alvo ?? null;
  const ultimo = indice >= passos.length - 1;

  const abrir = useCallback(() => {
    const validos = escolherPassos(roteiroDaRota(rota), (a) => acharAlvo(a) !== null);
    if (validos.length === 0) return;
    focoAnterior.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    gravarVisto(chave);
    setPassos(validos);
    setIndice(0);
    setDirecao(1);
    setAlvo(null);
    setAberto(true);
  }, [rota, chave]);

  const fechar = useCallback(() => {
    gravarVisto(chave);
    setAberto(false);
    const anterior = focoAnterior.current;
    focoAnterior.current = null;
    if (anterior && document.contains(anterior)) anterior.focus();
  }, [chave]);

  function ir(passoDado: 1 | -1) {
    setDirecao(passoDado);
    setIndice((atual) => vizinho(atual, passos.length, passoDado));
  }

  // Primeira visita à tela: abre sozinho, esperando um popup aberto (ex.: novidades) terminar.
  useEffect(() => {
    if (lerVisto(chave)) return;
    let tentativas = 0;
    let temporizador = 0;
    const tentar = () => {
      if (document.querySelector('[role="dialog"]') && tentativas < 20) {
        tentativas += 1;
        temporizador = window.setTimeout(tentar, 1000);
        return;
      }
      abrir();
    };
    temporizador = window.setTimeout(tentar, ATRASO_ABERTURA_MS);
    return () => window.clearTimeout(temporizador);
  }, [chave, abrir]);

  // Menu lateral e menu "Mais" pedem a reabertura por um evento de janela.
  useEffect(() => {
    window.addEventListener(EVENTO_TOUR_TELA, abrir);
    return () => window.removeEventListener(EVENTO_TOUR_TELA, abrir);
  }, [abrir]);

  // Mede o alvo e reposiciona em resize, rolagem e mudança de tamanho do próprio elemento.
  useEffect(() => {
    if (!aberto) return;
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      const vp = { largura: window.innerWidth, altura: window.innerHeight };
      setViewport((atual) => (atual.largura === vp.largura && atual.altura === vp.altura ? atual : vp));
      const el = alvoId ? acharAlvo(alvoId) : null;
      const r = el ? paraRetangulo(el.getBoundingClientRect()) : null;
      setAlvo((atual) => (mesmoRetangulo(atual, r) ? atual : r));
    };
    const agendar = () => {
      if (quadro === 0) quadro = window.requestAnimationFrame(medir);
    };
    agendar();
    window.addEventListener("resize", agendar);
    window.addEventListener("scroll", agendar, true);
    const el = alvoId ? acharAlvo(alvoId) : null;
    const observador = el ? new ResizeObserver(agendar) : null;
    if (el) observador?.observe(el);
    return () => {
      window.removeEventListener("resize", agendar);
      window.removeEventListener("scroll", agendar, true);
      observador?.disconnect();
      if (quadro !== 0) window.cancelAnimationFrame(quadro);
    };
  }, [aberto, alvoId]);

  // Tamanho real do balão, para posicioná-lo sem cortar.
  useEffect(() => {
    const no = balaoRef.current;
    if (!aberto || !no) return;
    const ler = () => {
      const novo = { largura: no.offsetWidth, altura: no.offsetHeight };
      tamanhoRef.current = novo;
      setTamanho((atual) => (atual.largura === novo.largura && atual.altura === novo.altura ? atual : novo));
    };
    ler();
    const observador = new ResizeObserver(ler);
    observador.observe(no);
    return () => observador.disconnect();
  }, [aberto, viewport.largura]);

  // Traz o alvo para a área livre da tela (acima da folha, no celular).
  useEffect(() => {
    if (!aberto || alvoId === null) return;
    const quadro = window.requestAnimationFrame(() => {
      const el = acharAlvo(alvoId);
      if (!el) return;
      const vp = { largura: window.innerWidth, altura: window.innerHeight };
      const celular = ehCelular(vp);
      const topo = celular ? 64 : 16;
      const base = celular ? vp.altura - tamanhoRef.current.altura - 12 : vp.altura - 16;
      const dy = deslocamentoParaVer(paraRetangulo(el.getBoundingClientRect()), topo, base);
      if (Math.abs(dy) > 1) window.scrollBy({ top: dy, behavior: reduzir ? "auto" : "smooth" });
    });
    return () => window.cancelAnimationFrame(quadro);
  }, [aberto, alvoId, indice, reduzir]);

  // Foco no botão principal ao abrir e a cada passo.
  useEffect(() => {
    if (!aberto) return;
    const quadro = window.requestAnimationFrame(() => proximoRef.current?.focus());
    return () => window.cancelAnimationFrame(quadro);
  }, [aberto, indice]);

  // Teclado: Esc fecha, setas navegam, Tab fica preso no balão.
  useEffect(() => {
    if (!aberto) return;
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        fechar();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setDirecao(1);
        setIndice((atual) => vizinho(atual, passos.length, 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setDirecao(-1);
        setIndice((atual) => vizinho(atual, passos.length, -1));
      } else if (e.key === "Tab") {
        const no = balaoRef.current;
        if (!no) return;
        const focaveis = Array.from(no.querySelectorAll<HTMLElement>("button:not([disabled])"));
        if (focaveis.length === 0) {
          e.preventDefault();
          return;
        }
        const primeiro = focaveis[0];
        const ultimoFocavel = focaveis[focaveis.length - 1];
        const ativo = document.activeElement;
        if (!(ativo instanceof Node) || !no.contains(ativo)) {
          e.preventDefault();
          primeiro.focus();
        } else if (e.shiftKey && ativo === primeiro) {
          e.preventDefault();
          ultimoFocavel.focus();
        } else if (!e.shiftKey && ativo === ultimoFocavel) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    };
    const aoFocar = (e: FocusEvent) => {
      const no = balaoRef.current;
      if (no && e.target instanceof Node && !no.contains(e.target)) proximoRef.current?.focus();
    };
    window.addEventListener("keydown", aoTecla, true);
    document.addEventListener("focusin", aoFocar);
    return () => {
      window.removeEventListener("keydown", aoTecla, true);
      document.removeEventListener("focusin", aoFocar);
    };
  }, [aberto, fechar, passos.length]);

  if (!aberto || !passo) return null;

  const folha = ehCelular(viewport);
  const posicao = calcularBalao({ alvo, balao: tamanho, viewport });
  const foco = alvo
    ? recorteDoAlvo(alvo, FOLGA_DESTAQUE, viewport)
    : { x: viewport.largura / 2, y: viewport.altura / 2, largura: 0, altura: 0 };
  const duracao = reduzir ? 0 : 0.28;
  const Icone = passo.icone;

  const conteudo = (
    <>
      <AnimatePresence mode="wait" initial={false} custom={direcao}>
        <motion.div
          key={passo.id}
          custom={direcao}
          variants={VARIANTES}
          initial="entra"
          animate="fica"
          exit="sai"
          transition={{ duration: reduzir ? 0 : 0.18, ease: "easeOut" }}
          className="flex items-start gap-4"
        >
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-fill text-black"
          >
            <Icone className="size-7" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={idTitulo} className="font-heading text-lg leading-tight font-semibold text-ink">
              {passo.titulo}
            </h2>
            <p id={idTexto} className="text-sm leading-relaxed text-muted-foreground">
              {passo.texto}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span aria-live="polite" className="text-xs font-medium tabular-nums text-muted-foreground">
          {indice + 1} de {passos.length}
        </span>
        <span aria-hidden="true" className="flex items-center gap-1.5">
          {passos.map((p, i) => (
            <span
              key={p.id}
              className={cn(
                "h-1.5 rounded-full transition-all motion-reduce:transition-none",
                i === indice ? "w-4 bg-brand-fill" : i < indice ? "w-1.5 bg-ink/40" : "w-1.5 bg-control",
              )}
            />
          ))}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {ultimo ? null : (
          <button
            type="button"
            onClick={fechar}
            className={cn(BOTAO_BASE, "-ml-2 px-2 text-muted-foreground hover:text-ink")}
          >
            Pular
          </button>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => ir(-1)}
          disabled={indice === 0}
          className={cn(BOTAO_BASE, "border border-border text-ink hover:bg-raised disabled:pointer-events-none disabled:opacity-40")}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Voltar
        </button>
        <button
          type="button"
          ref={proximoRef}
          onClick={ultimo ? fechar : () => ir(1)}
          className={cn(BOTAO_BASE, "bg-brand-fill font-semibold text-black hover:opacity-90")}
        >
          {ultimo ? "Concluir" : "Próximo"}
          {ultimo ? null : <ChevronRight className="size-4" aria-hidden="true" />}
        </button>
      </div>
    </>
  );

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[100]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduzir ? 0 : 0.2 }}
    >
      {/* Segura os toques: a página fica parada atrás do tour. */}
      <div aria-hidden="true" className="absolute inset-0" />

      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-card"
        style={{ boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.62)" }}
        initial={false}
        animate={{ left: foco.x, top: foco.y, width: foco.largura, height: foco.altura }}
        transition={{ duration: duracao, ease: "easeOut" }}
      >
        <motion.span
          className="absolute inset-0 rounded-[inherit] border-2 border-brand"
          initial={false}
          animate={reduzir ? { opacity: alvo ? 1 : 0 } : alvo ? { opacity: [1, 0.4, 1] } : { opacity: 0 }}
          transition={reduzir || !alvo ? { duration: 0 } : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      {folha ? (
        <motion.div
          key="folha"
          ref={balaoRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={idTitulo}
          aria-describedby={idTexto}
          className="fixed inset-x-0 bottom-0 max-h-[70dvh] overflow-y-auto rounded-t-sheet border-t border-border bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl"
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduzir ? 0 : 0.25, ease: "easeOut" }}
        >
          {conteudo}
        </motion.div>
      ) : (
        <motion.div
          key="balao"
          ref={balaoRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={idTitulo}
          aria-describedby={idTexto}
          className="fixed w-[360px] max-w-[calc(100vw-2rem)] rounded-card border border-border bg-surface p-5 shadow-xl"
          initial={{ opacity: 0, scale: 0.94, left: posicao.x, top: posicao.y }}
          animate={{ opacity: 1, scale: 1, left: posicao.x, top: posicao.y }}
          transition={{ duration: reduzir ? 0 : 0.25, ease: "easeOut" }}
        >
          {conteudo}
        </motion.div>
      )}
    </motion.div>,
    document.body,
  );
}
