import { FileText } from "lucide-react";
import type { ArquivoCompra } from "@/core/types-detalhe";
import { dataHora, ehArquivoPrincipal } from "./dominio";
import { Secao } from "./secao";

function LinhaArquivo({ arquivo }: { arquivo: ArquivoCompra }) {
  const data = dataHora(arquivo.publicadoEm);
  return (
    <li className="border-t border-border first:border-t-0">
      <a
        href={arquivo.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-14 items-center gap-3 px-4 py-3 outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
      >
        <FileText aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm leading-snug font-medium wrap-break-word text-ink">{arquivo.titulo}</span>
          <span className="text-xs leading-snug text-muted-foreground">
            {arquivo.tipo ?? "Documento"}
            {data ? (
              <>
                {" · "}
                <span className="font-mono tabular-nums">{data}</span>
              </>
            ) : null}
          </span>
        </span>
        <span className="sr-only">(abre em nova aba)</span>
      </a>
    </li>
  );
}

function Lista({ rotulo, arquivos }: { rotulo?: string; arquivos: readonly ArquivoCompra[] }) {
  return (
    <div className="flex flex-col gap-2">
      {rotulo ? <h3 className="text-xs font-medium text-muted-foreground">{rotulo}</h3> : null}
      <ul className="overflow-hidden rounded-card border border-border bg-surface">
        {arquivos.map((a) => (
          <LinhaArquivo key={a.sequencial} arquivo={a} />
        ))}
      </ul>
    </div>
  );
}

interface Props {
  arquivos: readonly ArquivoCompra[];
  /** Aviso de falha com "Tentar de novo"; quando existe, não afirma que não há arquivos */
  aviso: React.ReactNode;
}

export function ArquivosCompra({ arquivos, aviso }: Props) {
  const principais = arquivos.filter(ehArquivoPrincipal);
  const outros = arquivos.filter((a) => !ehArquivoPrincipal(a));
  const separar = principais.length > 0 && outros.length > 0;

  return (
    <Secao
      id="arquivos"
      titulo="Arquivos"
      detalhe={arquivos.length > 0 ? <span className="font-mono tabular-nums">{arquivos.length}</span> : null}
    >
      {aviso}
      {arquivos.length === 0 ? (
        aviso ? null : (
          <p className="rounded-card border border-dashed border-control px-4 py-8 text-center text-sm text-muted-foreground">
            O órgão não publicou arquivos.
          </p>
        )
      ) : separar ? (
        <>
          <Lista rotulo="Para ler primeiro" arquivos={principais} />
          <Lista rotulo="Outros documentos" arquivos={outros} />
        </>
      ) : (
        <Lista arquivos={arquivos} />
      )}
    </Secao>
  );
}
