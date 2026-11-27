import { Check, TriangleAlert } from "lucide-react";
import { avaliarCaixa, NOME_NIVEL_CAIXA, valorEstimadoCaixa, type NivelCaixa, type OportunidadeCaixa } from "@/core/caminho-dinheiro";
import { formatarMoedaCurta } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { Pilula, type TomPilula } from "./pilula";

const TOM_NIVEL: Record<NivelCaixa, TomPilula> = { baixo: "positivo", medio: "neutro", alto: "aviso" };

interface Props {
  oportunidade: OportunidadeCaixa;
  className?: string;
  /** Duas pílulas curtas numa linha só ("~R$ 2.000" com a explicação no title), para o card do celular. */
  compacto?: boolean;
}

/**
 * Selos do caixa: o nível (baixo, médio ou alto) e, quando o edital permite estimar,
 * "~R$ 2.000 antes de receber". A explicação do nível fica na dica (title), não em texto corrido.
 */
export function SelosCaixa({ oportunidade, className, compacto = false }: Props) {
  const { nivel, explicacao } = avaliarCaixa(oportunidade);
  const valor = valorEstimadoCaixa(oportunidade);
  const tamanho = compacto ? "h-6 shrink-0" : undefined;
  return (
    <span className={cn("flex flex-wrap items-center gap-1.5", compacto && "flex-nowrap", className)}>
      <Pilula tom={TOM_NIVEL[nivel]} className={cn("gap-1", tamanho)}>
        {nivel === "baixo" ? <Check aria-hidden="true" className="size-3" /> : null}
        {nivel === "alto" ? <TriangleAlert aria-hidden="true" className="size-3" /> : null}
        <span title={explicacao}>Caixa {NOME_NIVEL_CAIXA[nivel]}</span>
      </Pilula>
      {valor !== null && valor > 0 ? (
        compacto ? (
          <Pilula tom="neutro" className={tamanho} title={`${formatarMoedaCurta(valor)} estimados antes de receber`}>
            ~{formatarMoedaCurta(valor)}
          </Pilula>
        ) : (
          <Pilula tom="neutro">~{formatarMoedaCurta(valor)} antes de receber</Pilula>
        )
      ) : null}
    </span>
  );
}
