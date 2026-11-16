"use client";

import { LayoutGrid, List } from "lucide-react";
import { Segmentado } from "@/components/ui/segmentado";
import { VISOES, type Visao } from "@/lib/radar-filtros";

const ICONES = { cards: LayoutGrid, lista: List } as const;

const ROTULO_ACESSIVEL: Record<Visao, string> = {
  cards: "Ver em cards",
  lista: "Ver em lista",
};

interface Props {
  visao: Visao;
  onEscolher: (valor: Visao) => void;
  larguraTotal?: boolean;
}

/** Segmentado "Cards | Lista": ícone e rótulo visíveis, aria-label descritivo. */
export function AlternadorVisao({ visao, onEscolher, larguraTotal = false }: Props) {
  return (
    <Segmentado
      rotulo="Visualização"
      valor={visao}
      aoMudar={onEscolher}
      larguraTotal={larguraTotal}
      opcoes={VISOES.map((opcao) => {
        const Icone = ICONES[opcao.id];
        return {
          valor: opcao.id,
          rotulo: opcao.rotulo,
          rotuloAcessivel: ROTULO_ACESSIVEL[opcao.id],
          icone: <Icone className="size-4" aria-hidden="true" />,
        };
      })}
    />
  );
}
