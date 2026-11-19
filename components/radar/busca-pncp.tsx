"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { RespostaBuscaPncp } from "@/core/pncp/busca";
import { formatarEncerramento, formatarMoeda } from "@/lib/formato";

interface Props {
  /** Texto já aplicado na busca do Radar */
  texto: string;
  /** UFs escolhidas no filtro; vazio busca no Brasil todo */
  ufs: ReadonlyArray<string>;
}

type Estado =
  | { fase: "parado" }
  | { fase: "buscando" }
  | { fase: "erro"; mensagem: string }
  | { fase: "pronto"; resposta: RespostaBuscaPncp; pagina: number };

function lerResposta(corpo: unknown): RespostaBuscaPncp | null {
  if (corpo === null || typeof corpo !== "object" || !("itens" in corpo) || !Array.isArray(corpo.itens)) return null;
  return corpo as RespostaBuscaPncp;
}

/**
 * Busca a mesma palavra direto no PNCP, além do que já está no Radar.
 * Só consulta quando a pessoa pede, para não gastar chamadas a cada letra digitada.
 */
export function BuscaPncp({ texto, ufs }: Props) {
  const limpo = texto.trim();
  const chaveUfs = ufs.join(",");
  const chave = `${limpo}|${chaveUfs}`;
  const [guardado, setGuardado] = useState<{ chave: string; estado: Estado }>({ chave, estado: { fase: "parado" } });
  // Mudou a palavra ou os estados: o resultado anterior não vale mais.
  const estado: Estado = guardado.chave === chave ? guardado.estado : { fase: "parado" };
  const setEstado = (e: Estado) => setGuardado({ chave, estado: e });

  if (limpo.length < 3) return null;

  async function buscar(pagina: number) {
    setEstado({ fase: "buscando" });
    try {
      const params = new URLSearchParams({ q: limpo, uf: chaveUfs, pagina: String(pagina) });
      const r = await fetch(`/api/pncp/busca?${params.toString()}`);
      const corpo: unknown = await r.json().catch(() => null);
      const resposta = lerResposta(corpo);
      if (!r.ok || resposta === null) {
        const msg =
          corpo !== null && typeof corpo === "object" && "erro" in corpo && typeof corpo.erro === "string"
            ? corpo.erro
            : "O PNCP não respondeu agora. Tente de novo.";
        setEstado({ fase: "erro", mensagem: msg });
        return;
      }
      setEstado({ fase: "pronto", resposta, pagina });
    } catch {
      setEstado({ fase: "erro", mensagem: "O PNCP não respondeu agora. Tente de novo." });
    }
  }

  const onde = ufs.length > 0 ? ufs.join(", ") : "todo o Brasil";

  return (
    <section aria-label="Busca direta no PNCP" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-sm text-muted-foreground">
          Não achou? Procure “{limpo}” direto no PNCP em {onde}.
        </p>
        <button
          type="button"
          onClick={() => void buscar(1)}
          disabled={estado.fase === "buscando"}
          className="inline-flex min-h-9 items-center gap-2 rounded-control border border-control px-3 text-[13px] font-medium text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
        >
          <Search aria-hidden="true" className="size-4" />
          {estado.fase === "buscando" ? "Buscando…" : "Buscar no PNCP"}
        </button>
      </div>

      {estado.fase === "erro" ? (
        <p role="alert" className="text-sm text-negative">
          {estado.mensagem}
        </p>
      ) : null}

      {estado.fase === "pronto" ? (
        <div className="flex flex-col gap-2" aria-live="polite">
          <p className="text-[13px] text-muted-foreground">
            {estado.resposta.itens.length === 0
              ? "O PNCP não tem edital aberto com essas palavras."
              : `${estado.resposta.total} no PNCP com essas palavras (editais abertos).`}
          </p>
          <ul className="flex flex-col divide-y divide-border">
            {estado.resposta.itens.map((i) => (
              <li key={i.id} className="py-2">
                <Link href={i.href} className="flex flex-col gap-1 rounded-control outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand">
                  <span className="line-clamp-2 text-sm text-ink">{i.objeto || i.titulo}</span>
                  <span className="text-[12px] text-muted-foreground">
                    {[
                      i.orgao,
                      i.municipio && i.uf ? `${i.municipio}-${i.uf}` : i.uf,
                      i.modalidade,
                      i.encerramento ? `fecha ${formatarEncerramento(i.encerramento)}` : null,
                      i.valor !== null && i.valor > 0 ? formatarMoeda(i.valor) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {estado.resposta.total > estado.pagina * 50 ? (
            <button
              type="button"
              onClick={() => void buscar(estado.pagina + 1)}
              className="min-h-9 self-start rounded-control border border-control px-3 text-[13px] font-medium text-ink outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand"
            >
              Próximos 50
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
