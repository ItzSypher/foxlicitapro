"use client";

import { useEffect, useRef, useState } from "react";

/** Largura da folha A4 em pixels CSS (210 mm a 96 dpi). */
const LARGURA_FOLHA = 794;

/**
 * Ajusta a folha à largura disponível (nunca amplia). Fora da impressão a folha vira
 * uma miniatura fiel; na impressão o CSS global desfaz a escala.
 */
export function PreviaEscalada({ children }: { children: React.ReactNode }) {
  const moldura = useRef<HTMLDivElement>(null);
  const folha = useRef<HTMLDivElement>(null);
  const [medida, setMedida] = useState<{ escala: number; altura: number } | null>(null);

  useEffect(() => {
    const m = moldura.current;
    const f = folha.current;
    if (!m || !f) return;
    function medir() {
      if (!m || !f) return;
      const largura = m.clientWidth;
      if (largura === 0) return;
      const escala = Math.min(1, largura / LARGURA_FOLHA);
      setMedida({ escala, altura: f.offsetHeight * escala });
    }
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(m);
    obs.observe(f);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={moldura}
      className="previa-moldura w-full overflow-hidden"
      style={{ height: medida ? medida.altura : undefined }}
    >
      <div
        ref={folha}
        className="previa-escala w-[794px] origin-top-left"
        style={{ transform: medida ? `scale(${medida.escala})` : undefined, opacity: medida ? 1 : 0 }}
      >
        {children}
      </div>
    </div>
  );
}
