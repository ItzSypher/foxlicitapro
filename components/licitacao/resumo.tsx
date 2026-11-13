import type { DetalheCompra } from "@/core/types-detalhe";
import { formatarCnpj } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { CopiarCnpj } from "./copiar-cnpj";
import { Secao } from "./secao";

function Fato({
  rotulo,
  children,
  mono,
}: {
  rotulo: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className={cn("text-sm leading-snug wrap-break-word text-ink", mono ? "font-mono tabular-nums" : "")}>
        {children}
      </dd>
    </div>
  );
}

const SEM_VALOR = (
  <span aria-label="Não informado" className="text-faint">
    —
  </span>
);

function texto(valor: string | null): React.ReactNode {
  return valor === null || valor === "" ? SEM_VALOR : valor;
}

export function Resumo({ d }: { d: DetalheCompra }) {
  const local = [d.municipio, d.uf].filter((p) => p !== "").join("/");
  return (
    <Secao id="resumo" titulo="Resumo">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-5 rounded-card border border-border bg-surface p-4 lg:grid-cols-4">
        <Fato rotulo="Modalidade">{texto(d.modalidadeNome)}</Fato>
        <Fato rotulo="Modo de disputa">{texto(d.modoDisputa)}</Fato>
        <Fato rotulo="Amparo legal">{texto(d.amparoLegal)}</Fato>
        <Fato rotulo="Situação">{texto(d.situacao)}</Fato>
        <Fato rotulo="Registro de preços (SRP)">{d.srp ? "Sim" : "Não"}</Fato>
        <Fato rotulo="Unidade compradora">{texto(d.unidade)}</Fato>
        <Fato rotulo="Município/UF">{texto(local)}</Fato>
        <Fato rotulo="CNPJ do órgão">
          <span className="flex items-center gap-1">
            <span className="font-mono tabular-nums">{formatarCnpj(d.orgaoCnpj)}</span>
            <CopiarCnpj cnpj={formatarCnpj(d.orgaoCnpj)} />
          </span>
        </Fato>
      </dl>
    </Secao>
  );
}
