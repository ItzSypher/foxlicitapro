"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopiarCnpj({ cnpj }: { cnpj: string }) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(t);
  }, [copiado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(cnpj);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={copiar}
        aria-label="Copiar CNPJ"
        className="-my-3 inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted-foreground outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-brand"
      >
        {copiado ? <Check aria-hidden="true" className="size-4 text-positive" /> : <Copy aria-hidden="true" className="size-4" />}
      </button>
      <span role="status" className="sr-only">
        {copiado ? "CNPJ copiado" : ""}
      </span>
    </>
  );
}
