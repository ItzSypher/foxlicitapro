"use client";

import { useEffect, useState } from "react";
import { restantesHojeAction } from "@/app/(app)/propostas/assistente-actions";

/**
 * "Restam N hoje": quantas propostas a pessoa ainda pode montar com o assistente.
 * Não mostra nada para o dono (sem limite) nem enquanto carrega. Mude `versao` para reconsultar.
 */
export function RestantesHoje({ versao = 0 }: { versao?: number }) {
  const [texto, setTexto] = useState<string | null>(null);
  const [zerado, setZerado] = useState(false);

  useEffect(() => {
    let ativo = true;
    restantesHojeAction()
      .then((r) => {
        if (!ativo) return;
        if (r.ok && !r.ilimitada) {
          setTexto(r.texto);
          setZerado(r.restantes === 0);
        } else {
          setTexto(null);
        }
      })
      .catch(() => {
        if (ativo) setTexto(null);
      });
    return () => {
      ativo = false;
    };
  }, [versao]);

  if (!texto) return null;
  return <p className={zerado ? "text-xs text-negative" : "text-xs text-muted-foreground"}>{texto}</p>;
}
