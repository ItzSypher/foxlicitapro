import Link from "next/link";
import { connection } from "next/server";
import { Download, FolderArchive } from "lucide-react";
import { ROTULO_CURTO_TIPO_ACERVO, sugerirDoAcervo, type SugestaoAcervo } from "@/core/acervo";
import { listarAcervo } from "@/db/acervo";

/** Instante do pedido, lido fora do render. */
function momento(): number {
  return Date.now();
}

/**
 * "Do seu acervo, servem para esta licitação": até 5 documentos que casam com o objeto, com link para abrir.
 * Sem sugestão, convida a guardar documentos no acervo. Falha de leitura não derruba a página da licitação.
 */
export async function SugestoesAcervo({ empresaId, objeto, max = 5 }: { empresaId: string; objeto: string; max?: number }) {
  await connection();
  let sugestoes: SugestaoAcervo[];
  try {
    sugestoes = sugerirDoAcervo(objeto, await listarAcervo(empresaId), max, momento());
  } catch (e) {
    console.error("[acervo] sugestões falharam:", e instanceof Error ? e.message : e);
    return null;
  }

  return (
    <section aria-labelledby="sugestoes-acervo" className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <h2 id="sugestoes-acervo" className="flex items-center gap-2 text-sm font-semibold text-ink">
        <FolderArchive aria-hidden="true" className="size-4 text-muted-foreground" />
        Do seu acervo, servem para esta licitação:
      </h2>
      {sugestoes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nada do seu acervo parece servir para este objeto.{" "}
          <Link href="/acervo" className="text-ink underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-brand">
            Adicionar ao acervo
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {sugestoes.map(({ documento: d, motivo }) => (
            <li key={d.id} className="flex min-w-0 items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium break-words text-ink">{d.titulo}</span>
                <span className="text-[13px] break-words text-muted-foreground">
                  {ROTULO_CURTO_TIPO_ACERVO[d.tipo]} · {motivo}
                </span>
              </div>
              {d.arquivoNome !== null ? (
                <a
                  href={`/acervo/${d.id}/arquivo`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-control px-3 text-sm text-ink ring-1 ring-inset ring-border outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <Download aria-hidden="true" className="size-4" />
                  Baixar
                </a>
              ) : (
                <Link href="/acervo" className="shrink-0 text-[13px] text-muted-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-brand">
                  Sem arquivo
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
