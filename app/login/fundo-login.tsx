"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

interface Mancha {
  posicao: string;
  tamanho: string;
  opacidade: string;
  deslocamento: { x: number[]; y: number[] };
  duracao: number;
}

const MANCHAS: readonly Mancha[] = [
  {
    posicao: "-left-32 -top-32 lg:-left-24 lg:-top-24",
    tamanho: "size-[22rem] lg:size-[38rem]",
    opacidade: "opacity-25",
    deslocamento: { x: [0, 70, -20], y: [0, 50, 90] },
    duracao: 32,
  },
  {
    posicao: "-bottom-40 -right-32 lg:-bottom-48 lg:right-[8%]",
    tamanho: "size-[20rem] lg:size-[34rem]",
    opacidade: "opacity-20",
    deslocamento: { x: [0, -60, 30], y: [0, -70, -20] },
    duracao: 38,
  },
  {
    posicao: "hidden lg:block lg:left-[38%] lg:top-[30%]",
    tamanho: "lg:size-[24rem]",
    opacidade: "opacity-10",
    deslocamento: { x: [0, 50, -40], y: [0, -50, 40] },
    duracao: 44,
  },
];

/** Fundo da tela de entrada: manchas laranja em baixa opacidade, movimento lento, e grade de pontos. */
export function FundoLogin() {
  const reduzir = useReducedMotion();

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {MANCHAS.map((mancha) => (
        <motion.div
          key={mancha.posicao}
          className={cn(
            "absolute rounded-full bg-[radial-gradient(closest-side,var(--c-brand-fill),transparent)]",
            mancha.posicao,
            mancha.tamanho,
            mancha.opacidade,
          )}
          animate={reduzir ? undefined : mancha.deslocamento}
          transition={{
            duration: mancha.duracao,
            repeat: Infinity,
            repeatType: "mirror",
            ease: "easeInOut",
          }}
        />
      ))}
      <div className="absolute inset-0 [background-image:radial-gradient(color-mix(in_oklab,var(--c-text)_16%,transparent)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
    </div>
  );
}
