"use client";

import { useEffect, useRef, useState, type PointerEvent as EventoPonteiro } from "react";
import {
  ampliarCaixa,
  caixaDeConteudo,
  dimensoesFinais,
  dimensoesLimitadas,
  removerFundoClaro,
} from "@/lib/assinatura-imagem";

/** O banco aceita até 280000 caracteres; fica uma folga */
const LIMITE_DATA_URL = 270000;
const LIMITE_ARQUIVO_BYTES = 10 * 1024 * 1024;
const TIPOS_ARQUIVO = ["image/png", "image/jpeg"];
const LARGURA_MAXIMA = 600;
const LADO_MAXIMO_FOTO = 1600;
const ESCALAS = [1, 0.75, 0.55, 0.4];
const PROPORCAO_QUADRO = 3;
const TRACO_PX = 2.5;

const BOTAO =
  "h-9 cursor-pointer rounded-control border border-border px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50";
const BOTAO_PRIMARIO =
  "h-9 cursor-pointer rounded-control bg-brand-fill px-3 text-sm font-medium text-black outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50";

type Modo = "desenhar" | "foto";
type Resultado = { ok: true; url: string } | { ok: false; erro: string };

/**
 * Recorta as bordas vazias, limita a largura e exporta PNG. Se passar do limite do banco,
 * reduz a escala e tenta de novo. Quando `semFundo`, tira o fundo claro antes (altera a origem).
 */
function gerarPng(origem: HTMLCanvasElement, semFundo: boolean): Resultado {
  const ctx = origem.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { ok: false, erro: "Seu navegador não conseguiu processar a imagem." };
  const { width, height } = origem;
  const imagem = ctx.getImageData(0, 0, width, height);
  if (semFundo) {
    removerFundoClaro(imagem.data);
    ctx.putImageData(imagem, 0, 0);
  }
  const conteudo = caixaDeConteudo(imagem.data, width, height);
  if (!conteudo) return { ok: false, erro: "Não encontrei a assinatura na imagem. Tente de novo." };
  const caixa = ampliarCaixa(conteudo, width, height, Math.max(2, Math.round(Math.max(width, height) * 0.01)));

  for (const escala of ESCALAS) {
    const tamanho = dimensoesFinais(caixa.largura, caixa.altura, LARGURA_MAXIMA, escala);
    const saida = document.createElement("canvas");
    saida.width = tamanho.largura;
    saida.height = tamanho.altura;
    const destino = saida.getContext("2d");
    if (!destino) return { ok: false, erro: "Seu navegador não conseguiu processar a imagem." };
    destino.imageSmoothingEnabled = true;
    destino.imageSmoothingQuality = "high";
    destino.drawImage(origem, caixa.x, caixa.y, caixa.largura, caixa.altura, 0, 0, tamanho.largura, tamanho.altura);
    const url = saida.toDataURL("image/png");
    if (url.length <= LIMITE_DATA_URL) return { ok: true, url };
  }
  return { ok: false, erro: "A assinatura ficou pesada demais. Use uma imagem mais simples." };
}

/** Desenha a foto girada em um canvas de trabalho, com o maior lado limitado. */
function canvasDaFoto(bitmap: ImageBitmap, graus: number): HTMLCanvasElement | null {
  const { largura, altura } = dimensoesLimitadas(bitmap.width, bitmap.height, LADO_MAXIMO_FOTO);
  const deitada = graus % 180 !== 0;
  const canvas = document.createElement("canvas");
  canvas.width = deitada ? altura : largura;
  canvas.height = deitada ? largura : altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((graus * Math.PI) / 180);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, -largura / 2, -altura / 2, largura, altura);
  return canvas;
}

interface Props {
  /** Data URL da assinatura salva, ou null */
  valor: string | null;
  aoMudar: (valor: string | null) => void;
}

interface Ponto {
  x: number;
  y: number;
}

export function AssinaturaCampo({ valor, aoMudar }: Props) {
  const [modo, setModo] = useState<Modo>("desenhar");
  const [erro, setErro] = useState<string | null>(null);
  const [temTraco, setTemTraco] = useState(false);

  const quadro = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const ultimo = useRef<Ponto>({ x: 0, y: 0 });
  const meio = useRef<Ponto>({ x: 0, y: 0 });

  const entradaArquivo = useRef<HTMLInputElement>(null);
  const bitmap = useRef<ImageBitmap | null>(null);
  const [rotacao, setRotacao] = useState(0);
  const [previaFoto, setPreviaFoto] = useState<string | null>(null);

  // O canvas nasce no tamanho do card, em pixels reais da tela (nítido em telas retina).
  useEffect(() => {
    const canvas = quadro.current;
    if (modo !== "desenhar" || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const largura = Math.max(1, Math.round(canvas.getBoundingClientRect().width * dpr));
    canvas.width = largura;
    canvas.height = Math.round(largura / PROPORCAO_QUADRO);
  }, [modo]);

  useEffect(
    () => () => {
      bitmap.current?.close();
    },
    [],
  );

  function ponto(e: EventoPonteiro<HTMLCanvasElement>, canvas: HTMLCanvasElement): Ponto {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * canvas.width) / r.width, y: ((e.clientY - r.top) * canvas.height) / r.height };
  }

  function escala(canvas: HTMLCanvasElement): number {
    return canvas.width / canvas.getBoundingClientRect().width;
  }

  function comecar(e: EventoPonteiro<HTMLCanvasElement>) {
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
    desenhando.current = false;
  }

  function limparQuadro() {
    const canvas = quadro.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setTemTraco(false);
    setErro(null);
  }

  function usarDesenho() {
    const canvas = quadro.current;
    if (!canvas) return;
    const r = gerarPng(canvas, false);
    if (r.ok) {
      aoMudar(r.url);
      limparQuadro();
    } else {
      setErro(r.erro);
    }
  }

  function processarFoto(graus: number) {
    const origem = bitmap.current;
    if (!origem) return;
    const canvas = canvasDaFoto(origem, graus);
    if (!canvas) {
      setErro("Seu navegador não conseguiu processar a imagem.");
      return;
    }
    const r = gerarPng(canvas, true);
    if (r.ok) {
      setPreviaFoto(r.url);
      setErro(null);
    } else {
      setPreviaFoto(null);
      setErro(r.erro);
    }
  }

  async function escolherArquivo(arquivo: File | undefined) {
    setErro(null);
    if (!arquivo) return;
    if (!TIPOS_ARQUIVO.includes(arquivo.type)) {
      setErro("Use uma imagem PNG ou JPEG.");
      return;
    }
    if (arquivo.size > LIMITE_ARQUIVO_BYTES) {
      setErro("A foto passa de 10 MB. Use uma menor.");
      return;
    }
    try {
      const lido = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
      bitmap.current?.close();
      bitmap.current = lido;
      setRotacao(0);
      processarFoto(0);
    } catch {
      setErro("Não foi possível ler a imagem.");
    }
  }

  function girar(delta: number) {
    const nova = (rotacao + delta + 360) % 360;
    setRotacao(nova);
    processarFoto(nova);
  }

  function usarFoto() {
    if (!previaFoto) return;
    aoMudar(previaFoto);
    descartarFoto();
  }

  function descartarFoto() {
    bitmap.current?.close();
    bitmap.current = null;
    setPreviaFoto(null);
    setRotacao(0);
    if (entradaArquivo.current) entradaArquivo.current.value = "";
  }

  function trocarModo(novo: Modo) {
    if (novo === modo) return;
    setErro(null);
    setTemTraco(false);
    descartarFoto();
    setModo(novo);
  }

  const aba = (ativa: boolean) =>
    `h-9 cursor-pointer rounded-control border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand ${
      ativa ? "border-brand bg-brand-fill font-medium text-black" : "border-border text-ink"
    }`;

  return (
    <div data-tour="empresa-assinatura" className="flex flex-col gap-3">
      <span className="text-sm font-medium text-ink">Assinatura</span>

      {valor ? (
        <div className="flex flex-wrap items-end gap-3">
          {/* data URL gerada no navegador: next/image não se aplica a esse tipo de origem */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={valor} alt="Prévia da assinatura" className="h-16 max-w-[240px] rounded-control border border-border bg-white object-contain p-1" />
          <button type="button" onClick={() => aoMudar(null)} className={BOTAO}>
            Remover
          </button>
        </div>
      ) : null}

      <div role="group" aria-label="Como informar a assinatura" className="flex gap-2">
        <button type="button" aria-pressed={modo === "desenhar"} onClick={() => trocarModo("desenhar")} className={aba(modo === "desenhar")}>
          Assinar na tela
        </button>
        <button type="button" aria-pressed={modo === "foto"} onClick={() => trocarModo("foto")} className={aba(modo === "foto")}>
          Enviar foto
        </button>
      </div>

      {modo === "desenhar" ? (
        <div className="flex flex-col gap-2">
          <canvas
            ref={quadro}
            aria-label="Área para desenhar a assinatura"
            onPointerDown={comecar}
            onPointerMove={mover}
            onPointerUp={terminar}
            onPointerCancel={terminar}
            className="block aspect-[3/1] w-full max-w-[600px] cursor-crosshair rounded-xl border border-border bg-white"
            style={{ touchAction: "none" }}
          />
          <p className="text-[13px] text-muted-foreground">Assine com o dedo, a caneta ou o mouse.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={limparQuadro} disabled={!temTraco} className={BOTAO}>
              Limpar
            </button>
            <button type="button" onClick={usarDesenho} disabled={!temTraco} className={BOTAO_PRIMARIO}>
              Usar esta assinatura
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            ref={entradaArquivo}
            type="file"
            accept="image/png,image/jpeg"
            aria-label="Foto da assinatura"
            onChange={(e) => void escolherArquivo(e.target.files?.[0])}
            className="text-sm text-ink file:mr-3 file:h-9 file:cursor-pointer file:rounded-control file:border file:border-border file:bg-surface file:px-3 file:text-sm"
          />
          <p className="text-[13px] text-muted-foreground">
            PNG ou JPEG, até 10 MB. Fotografe a assinatura em papel branco; o fundo claro sai sozinho.
          </p>
          {previaFoto ? (
            <div className="flex flex-col gap-2">
              {/* data URL gerada no navegador: next/image não se aplica a esse tipo de origem */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previaFoto} alt="Prévia da foto tratada" className="h-24 max-w-full self-start rounded-control border border-border bg-white object-contain p-1" />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => girar(-90)} className={BOTAO}>
                  Girar ↺
                </button>
                <button type="button" onClick={() => girar(90)} className={BOTAO}>
                  Girar ↻
                </button>
                <button type="button" onClick={usarFoto} className={BOTAO_PRIMARIO}>
                  Usar esta assinatura
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {erro ? (
        <p role="alert" className="text-sm text-negative">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
