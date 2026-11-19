"use client";

import { Children, useEffect, useRef, useState } from "react";
import { animate, motion, useReducedMotion } from "motion/react";

/**
 * Movimento de entrada, sempre só na montagem (nada anima a cada re-render) e só com transform e opacidade.
 * Quem pede menos movimento no aparelho recebe o estado final na hora.
 */

/** Passo entre itens de uma lista escalonada, em segundos (no máximo 30 ms). */
export const PASSO_ESCALONADO = 0.03;
/** Só os primeiros itens animam; o resto aparece direto. */
export const LIMITE_ESCALONADO = 12;

const CURVA = [0.2, 0.7, 0.2, 1] as const;

type Tag = "div" | "li" | "section";

interface PropsEntrada {
  children: React.ReactNode;
  className?: string;
  /** Espera antes de entrar, em segundos */
  atraso?: number;
  /** Subida inicial em px */
  y?: number;
  as?: Tag;
}

/** Fade com subida curta ao montar. */
export function Entrada({ children, className, atraso = 0, y = 12, as = "div" }: PropsEntrada) {
  const reduzir = useReducedMotion();
  const comum = {
    className,
    initial: reduzir ? false : { opacity: 0, y },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay: atraso, ease: CURVA },
  } as const;
  if (as === "li") return <motion.li {...comum}>{children}</motion.li>;
  if (as === "section") return <motion.section {...comum}>{children}</motion.section>;
  return <motion.div {...comum}>{children}</motion.div>;
}

interface PropsLista {
  children: React.ReactNode;
  as?: "ul" | "div";
  className?: string;
  /** Classe de cada item (li ou div) */
  classeItem?: string;
  /** Intervalo entre itens, em segundos; limitado a 30 ms */
  passo?: number;
  /** Quantos itens animam */
  limite?: number;
}

/** Lista cujos primeiros itens entram em sequência curta. Os demais aparecem sem animação. */
export function ListaEscalonada({
  children,
  as = "div",
  className,
  classeItem,
  passo = PASSO_ESCALONADO,
  limite = LIMITE_ESCALONADO,
}: PropsLista) {
  const itens = Children.toArray(children);
  const intervalo = Math.min(passo, PASSO_ESCALONADO);
  const tagItem: Tag = as === "ul" ? "li" : "div";
  const conteudo = itens.map((filho, i) =>
    i < limite ? (
      <Entrada key={i} as={tagItem} atraso={i * intervalo} className={classeItem}>
        {filho}
      </Entrada>
    ) : tagItem === "li" ? (
      <li key={i} className={classeItem}>
        {filho}
      </li>
    ) : (
      <div key={i} className={classeItem}>
        {filho}
      </div>
    ),
  );
  return as === "ul" ? <ul className={className}>{conteudo}</ul> : <div className={className}>{conteudo}</div>;
}

interface PropsNumero {
  valor: number;
  /** Texto final a partir do número inteiro corrente; por padrão, pt-BR */
  formatar?: (n: number) => string;
  /** Duração da contagem, em ms */
  duracaoMs?: number;
}

/** Número que conta de 0 até o valor ao entrar e, se o valor mudar, segue do valor anterior até o novo. */
export function NumeroAnimado({ valor, formatar, duracaoMs = 600 }: PropsNumero) {
  const reduzir = useReducedMotion();
  const [exibido, definirExibido] = useState(Math.round(valor));
  const ultimo = useRef(0);
  const primeira = useRef(true);

  useEffect(() => {
    if (reduzir) {
      ultimo.current = valor;
      primeira.current = false;
      return;
    }
    const de = primeira.current ? 0 : ultimo.current;
    primeira.current = false;
    if (de === valor) {
      ultimo.current = valor;
      return;
    }
    const controle = animate(de, valor, {
      duration: duracaoMs / 1000,
      ease: "easeOut",
      onUpdate: (v) => {
        ultimo.current = v;
        definirExibido(Math.round(v));
      },
      onComplete: () => {
        ultimo.current = valor;
        definirExibido(Math.round(valor));
      },
    });
    return () => controle.stop();
  }, [valor, reduzir, duracaoMs]);

  const n = Math.round(reduzir ? valor : exibido);
  return <span className="tabular-nums">{formatar ? formatar(n) : n.toLocaleString("pt-BR")}</span>;
}
