"use client";

import { useCallback, type RefCallback } from "react";

/**
 * Marca uma faixa que rola na horizontal com `data-esquerda` e `data-direita` ("true" ou "false")
 * conforme haja conteúdo escondido de cada lado. A classe `sem-barra` usa esses atributos para
 * esmaecer só a borda que esconde algo. Escreve direto no elemento: rolar não renderiza de novo.
 * Uso: `<div ref={useFaixaRolavel()} className="sem-barra overflow-x-auto">`.
 */
export function useFaixaRolavel<T extends HTMLElement>(): RefCallback<T> {
  return useCallback((no: T | null) => {
    if (!no) return;
    const faixa: HTMLElement = no;

    function medir() {
      const escondido = faixa.scrollWidth - faixa.clientWidth;
      faixa.dataset.esquerda = String(escondido > 1 && faixa.scrollLeft > 1);
      faixa.dataset.direita = String(escondido > 1 && faixa.scrollLeft < escondido - 1);
    }

    const tamanhos = new ResizeObserver(medir);
    function observar() {
      tamanhos.disconnect();
      tamanhos.observe(faixa);
      for (const filho of Array.from(faixa.children)) tamanhos.observe(filho);
      medir();
    }
    const filhos = new MutationObserver(observar);

    faixa.addEventListener("scroll", medir, { passive: true });
    filhos.observe(faixa, { childList: true });
    observar();

    return () => {
      faixa.removeEventListener("scroll", medir);
      tamanhos.disconnect();
      filhos.disconnect();
    };
  }, []);
}
