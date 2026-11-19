"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import { BellRing, FileCheck2, Radar } from "lucide-react";
import { MarcaNome } from "./marca-nome";

const BENEFICIOS = [
  { icone: Radar, texto: "Licitações novas do seu ramo todo dia" },
  { icone: FileCheck2, texto: "Proposta pronta para revisar" },
  { icone: BellRing, texto: "Aviso no WhatsApp do que importa" },
] as const;

const LISTA: Variants = {
  oculto: {},
  visivel: { transition: { staggerChildren: 0.14, delayChildren: 0.25 } },
};

const ITEM: Variants = {
  oculto: { opacity: 0, y: 14 },
  visivel: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.2, 0.7, 0.2, 1] } },
};

/** Coluna da marca, só no PC: nome, frase e os três benefícios entrando em sequência. */
export function PainelMarca() {
  const reduzir = useReducedMotion();

  return (
    <div className="hidden flex-col gap-10 lg:flex">
      <MarcaNome />
      <div className="flex flex-col gap-4">
        <p className="max-w-md text-balance text-4xl font-semibold leading-tight tracking-tight text-ink">
          Licitações do seu ramo, do edital ao resultado.
        </p>
      </div>
      <motion.ul
        className="flex flex-col gap-5"
        variants={LISTA}
        initial={reduzir ? false : "oculto"}
        animate="visivel"
      >
        {BENEFICIOS.map(({ icone: Icone, texto }) => (
          <motion.li key={texto} variants={ITEM} className="flex items-center gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-control border border-border bg-surface/70 text-brand">
              <Icone className="size-5" aria-hidden="true" />
            </span>
            <span className="text-base text-ink">{texto}</span>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}
