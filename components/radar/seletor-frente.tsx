"use client";

import { Segmentado } from "@/components/ui/segmentado";
import type { Frente } from "@/core/types";

const OPCOES: ReadonlyArray<{ valor: Frente; rotulo: string }> = [
  { valor: "servicos", rotulo: "Serviços" },
  { valor: "produtos", rotulo: "Produtos" },
];

export function SeletorFrente({
  frente,
  onEscolher,
}: {
  frente: Frente;
  onEscolher: (valor: Frente) => void;
}) {
  return (
    <Segmentado
      rotulo="Frente de atuação"
      valor={frente}
      aoMudar={onEscolher}
      opcoes={OPCOES}
      larguraTotal
      className="min-[480px]:w-auto"
    />
  );
}
