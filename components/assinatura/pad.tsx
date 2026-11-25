"use client";

import { useEffect, useRef, useState, type PointerEvent as EventoPonteiro } from "react";
import { ampliarCaixa, caixaDeConteudo, dimensoesFinais } from "@/lib/assinatura-imagem";

/** Cabe no limite do banco (400000) com folga. */
const LIMITE_DATA_URL = 300_000;
const LARGURA_MAXIMA = 600;
const ESCALAS = [1, 0.75, 0.55, 0.4];
const PROPORCAO = 3;
const TRACO_PX = 2.5;

interface Ponto {
  x: number;
  y: number;
}

/** Recorta as bordas vazias, limita a largura e exporta PNG; reduz a escala se passar do limite. */
function exportarPng(origem: HTMLCanvasElement): string | null {
  const ctx = origem.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const { width, height } = origem;
  const conteudo = caixaDeConteudo(ctx.getImageData(0, 0, width, height).data, width, height);
  if (!conteudo) return null;
  const caixa = ampliarCaixa(conteudo, width, height, Math.max(2, Math.round(Math.max(width, height) * 0.01)));
  for (const escala of ESCALAS) {
    const tamanho = dimensoesFinais(caixa.largura, caixa.altura, LARGURA_MAXIMA, escala);
    const saida = document.createElement("canvas");
    saida.width = tamanho.largura;
    saida.height = tamanho.altura;
    const destino = saida.getContext("2d");
    if (!destino) return null;
    destino.imageSmoothingEnabled = true;
    destino.imageSmoothingQuality = "high";
    destino.drawImage(origem, caixa.x, caixa.y, caixa.largura, caixa.altura, 0, 0, tamanho.largura, tamanho.altura);
    const url = saida.toDataURL("image/png");
    if (url.length <= LIMITE_DATA_URL) return url;
  }
  return null;
}

interface Props {
  /** Chamado a cada traço concluído com o PNG recortado (data URL), e com null ao limpar */
  aoMudar: (dataUrl: string | null) => void;
  /** Texto de ajuda sob o quadro */
  ajuda?: string;
  desabilitado?: boolean;
}

/**
 * Quadro para assinar com o dedo, a caneta ou o mouse (pointer events, sem rolar a página ao desenhar).
 * Fundo branco e traço preto, igual em qualquer tema.
 */
export function PadAssinatura({ aoMudar, ajuda = "Assine com o dedo dentro do quadro.", desabilitado = false }: Props) {
  const quadro = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const ultimo = useRef<Ponto>({ x: 0, y: 0 });
  const meio = useRef<Ponto>({ x: 0, y: 0 });
  const [temTraco, setTemTraco] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // O canvas nasce no tamanho da tela, em pixels reais (nítido em telas de alta densidade).
  useEffect(() => {
    const canvas = quadro.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const largura = Math.max(1, Math.round(canvas.getBoundingClientRect().width * dpr));
    canvas.width = largura;
    canvas.height = Math.round(largura / PROPORCAO);
  }, []);

  function ponto(e: EventoPonteiro<HTMLCanvasElement>, canvas: HTMLCanvasElement): Ponto {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * canvas.width) / r.width, y: ((e.clientY - r.top) * canvas.height) / r.height };
  }

  function escala(canvas: HTMLCanvasElement): number {
    return canvas.width / canvas.getBoundingClientRect().width;
  }

  function comecar(e: EventoPonteiro<HTMLCanvasElement>) {
    if (desabilitado) return;
    const canvas = e.currentTarget;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.setPointerCapture(e.pointerId);
    desenhando.current = true;
    const p = ponto(e, canvas);
    ultimo.current = p;
    meio.current = p;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(p.x, p.y, (TRACO_PX * escala(canvas)) / 2, 0, Math.PI * 2);
    ctx.fill();
    setTemTraco(true);
    setErro(null);
  }

  function mover(e: EventoPonteiro<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    const canvas = e.currentTarget;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const p = ponto(e, canvas);
    const novoMeio = { x: (ultimo.current.x + p.x) / 2, y: (ultimo.current.y + p.y) / 2 };
    ctx.strokeStyle = "#000";
    ctx.lineWidth = TRACO_PX * escala(canvas);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(meio.current.x, meio.current.y);
    ctx.quadraticCurveTo(ultimo.current.x, ultimo.current.y, novoMeio.x, novoMeio.y);
    ctx.stroke();
    ultimo.current = p;
    meio.current = novoMeio;
  }

  function terminar() {
    if (!desenhando.current) return;
    desenhando.current = false;
    const canvas = quadro.current;
    if (!canvas) return;
    const url = exportarPng(canvas);
    if (url === null) {
      setErro("Não consegui registrar a assinatura. Limpe e assine de novo, com traços mais simples.");
      aoMudar(null);
      return;
    }
    setErro(null);
    aoMudar(url);
  }

  function limpar() {
    const canvas = quadro.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    desenhando.current = false;
    setTemTraco(false);
    setErro(null);
    aoMudar(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={quadro}
        role="img"
        aria-label="Quadro para desenhar a assinatura"
        onPointerDown={comecar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerCancel={terminar}
        className="block aspect-[3/1] w-full cursor-crosshair rounded-xl border border-[#b8b8b8] bg-white"
        style={{ touchAction: "none" }}
      />
      <p className="text-[13px] text-[#555]">{ajuda}</p>
      <div>
        <button
          type="button"
          onClick={limpar}
          disabled={!temTraco || desabilitado}
          className="h-11 cursor-pointer rounded-xl border border-[#b8b8b8] bg-white px-4 text-sm font-medium text-[#111] outline-none focus-visible:ring-2 focus-visible:ring-[#f57e11] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Limpar
        </button>
      </div>
      {erro ? (
        <p role="alert" className="text-sm text-[#b42318]">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
