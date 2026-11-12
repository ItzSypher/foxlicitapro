import { useCallback, useSyncExternalStore } from "react";
import { MS_DIA } from "@/lib/formato";

/**
 * Relógio compartilhado: um único intervalo de 1 s para a tela inteira.
 * Cada consumidor só re-renderiza quando o valor que ele enxerga muda:
 * a cada segundo se faltam menos de 24 h para o prazo, a cada minuto nos demais casos.
 */
const ouvintes = new Set<() => void>();
let intervalo: ReturnType<typeof setInterval> | null = null;

function assinar(avisar: () => void): () => void {
  ouvintes.add(avisar);
  if (intervalo === null) {
    intervalo = setInterval(() => {
      ouvintes.forEach((ouvinte) => ouvinte());
    }, 1000);
  }
  return () => {
    ouvintes.delete(avisar);
    if (ouvintes.size === 0 && intervalo !== null) {
      clearInterval(intervalo);
      intervalo = null;
    }
  };
}

/**
 * @param encerramentoMs prazo do item (para escolher a granularidade); null usa minuto
 * @param inicial valor usado no servidor e na hidratação, para os dois lados coincidirem
 */
export function useAgora(encerramentoMs: number | null, inicial: number): number {
  const lerAgora = useCallback((): number => {
    const t = Date.now();
    const restante = encerramentoMs === null ? Number.NaN : encerramentoMs - t;
    const passo = restante > 0 && restante < MS_DIA ? 1000 : 60_000;
    return Math.floor(t / passo) * passo;
  }, [encerramentoMs]);
  const lerInicial = useCallback((): number => inicial, [inicial]);
  return useSyncExternalStore(assinar, lerAgora, lerInicial);
}
