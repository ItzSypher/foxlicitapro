import { Check, TriangleAlert } from "lucide-react";
import { avaliarCaixa, NOME_NIVEL_CAIXA, valorEstimadoCaixa, type NivelCaixa, type OportunidadeCaixa } from "@/core/caminho-dinheiro";
import { formatarMoedaCurta } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Pilula, type TomPilula } from "./pilula";

const TOM_NIVEL: Record<NivelCaixa, TomPilula> = { baixo: "positivo", medio: "neutro", alto: "aviso" };

/**
 * Selos do caixa: o nível (baixo, médio ou alto) e, quando o edital permite estimar,
 * "~R$ 2.000 antes de receber". A explicação do nível fica na dica (title), não em texto corrido.
 */
export function SelosCaixa({ oportunidade, className }: { oportunidade: OportunidadeCaixa; className?: string }) {
  const { nivel, explicacao } = avaliarCaixa(oportunidade);
  const valor = valorEstimadoCaixa(oportunidade);
  return (
    <span className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <Pilula tom={TOM_NIVEL[nivel]} className="gap-1">
        {nivel === "baixo" ? <Check aria-hidden="true" className="size-3" /> : null}
        {nivel === "alto" ? <TriangleAlert aria-hidden="true" className="size-3" /> : null}
        <span title={explicacao}>Caixa {NOME_NIVEL_CAIXA[nivel]}</span>
      </Pilula>
      {valor !== null && valor > 0 ? (
        <Pilula tom="neutro">~{formatarMoedaCurta(valor)} antes de receber</Pilula>
      ) : null}
    </span>
  );
}
