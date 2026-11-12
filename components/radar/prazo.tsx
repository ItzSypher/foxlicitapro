"use client";

import { MS_DIA, formatarContagem, formatarRestanteCurto, restanteMs } from "@/lib/formato";
import { useAgora } from "@/lib/relogio";
import { Pilula } from "./pilula";

/** Estado do prazo calculado a partir do relógio compartilhado. */
export function usePrazo(encerramentoIso: string, agoraInicial: number) {
  const fim = Date.parse(encerramentoIso);
  const agora = useAgora(Number.isNaN(fim) ? null : fim, agoraInicial);
  const restante = restanteMs(encerramentoIso, agora);
  return {
    restante,
    contagem: formatarContagem(restante),
    curto: formatarRestanteCurto(restante),
    encerrada: !Number.isNaN(restante) && restante <= 0,
    menosDe24h: restante > 0 && restante < MS_DIA,
  };
}

/**
 * Prazo do card, embaixo do valor: "Fecha em 3 d" a partir de 24 h;
 * abaixo disso o relógio "18:30:22" dentro de uma pílula vermelha.
 */
export function PrazoDoCard({
  encerramentoIso,
  agoraInicial,
}: {
  encerramentoIso: string;
  agoraInicial: number;
}) {
  const { contagem, curto, encerrada, menosDe24h } = usePrazo(encerramentoIso, agoraInicial);
  if (menosDe24h) {
    return (
      <Pilula tom="negativo" className="font-mono tabular-nums">
        {contagem}
      </Pilula>
    );
  }
  return (
    <span className="text-[13px] text-muted-foreground">
      {encerrada ? "Encerrada" : `Fecha em ${curto}`}
    </span>
  );
}

/** Contagem simples para o detalhe. */
export function ContagemTexto({
  encerramentoIso,
  agoraInicial,
}: {
  encerramentoIso: string;
  agoraInicial: number;
}) {
  const { contagem } = usePrazo(encerramentoIso, agoraInicial);
  return <span className="font-mono tabular-nums">{contagem}</span>;
}
