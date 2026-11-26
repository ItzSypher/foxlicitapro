import Link from "next/link";
import { connection } from "next/server";
import { Ban, Check, Clock, FileText, type LucideIcon } from "lucide-react";
import { AcoesAtestado } from "@/components/atestados/acoes";
import { periodoTexto, ROTULO_STATUS, type StatusAtestado } from "@/core/atestados";
import { temPermissao } from "@/core/permissoes";
import { listarAtestados, type Atestado } from "@/db/atestados";
import { lerEmpresa } from "@/db/empresas";
import { BOTAO_PRIMARIO } from "@/components/fornecedores/estilo";
import { linkParaEnvio } from "@/lib/atestados-url";
import { formatarMoeda } from "@/lib/formato";
import { exigirSessao } from "@/lib/sessao";

export const metadata = { title: "Atestados · FoxLicita Pro" };

const COR_STATUS: Record<StatusAtestado, string> = {
  rascunho: "bg-pill-neutral-bg text-pill-neutral-fg",
  aguardando: "bg-pill-warn-bg text-pill-warn-fg",
  assinado: "bg-pill-pos-bg text-pill-pos-fg",
  cancelado: "bg-pill-neg-bg text-pill-neg-fg",
};

const ICONE_STATUS: Record<StatusAtestado, LucideIcon> = {
  rascunho: FileText,
  aguardando: Clock,
  assinado: Check,
  cancelado: Ban,
};

export default async function AtestadosPage() {
  await connection();
  const sessao = await exigirSessao();
  const podeEditar = temPermissao(sessao, "editar_propostas");

  let lista: Atestado[] | null;
  let emissora = "nossa empresa";
  try {
    lista = await listarAtestados(sessao.empresaId);
    const empresa = await lerEmpresa(sessao.empresaId);
    emissora = empresa?.nomeFantasia ?? empresa?.razaoSocial ?? emissora;
  } catch (e) {
    console.error("[atestados] leitura falhou:", e instanceof Error ? e.message : e);
    lista = null;
  }

  return (
    <div className="mx-auto flex w-full max-w-[960px] min-w-0 flex-col gap-4 lg:gap-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[22px] font-semibold leading-tight text-ink">Atestados</h1>
          <p className="text-sm text-muted-foreground">O cliente assina pelo celular e o atestado vai para o acervo.</p>
        </div>
        {podeEditar ? (
          <Link href="/atestados/novo" className={`${BOTAO_PRIMARIO} shrink-0`}>
            Novo atestado
          </Link>
        ) : null}
      </header>

      {lista === null ? (
        <p role="alert" className="rounded-card border border-border px-4 py-5 text-sm text-negative">
          Não foi possível carregar os atestados agora. Tente de novo em instantes.
        </p>
      ) : lista.length === 0 ? (
        <p className="rounded-card border border-border px-4 py-5 text-sm text-muted-foreground">Nenhum atestado ainda.</p>
      ) : (
        <section aria-label="Lista de atestados" className="flex flex-col gap-2">
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border">
            {lista.map((a) => {
              const Icone = ICONE_STATUS[a.status];
              return (
                <li key={a.id} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/atestados/${a.id}`}
                      className="flex min-w-0 flex-col gap-0.5 outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <span className="truncate text-sm font-medium text-ink">{a.clienteNome}</span>
                      <span className="flex min-w-0 items-baseline gap-2 text-[13px] text-muted-foreground">
                        {a.valor !== null ? <span className="shrink-0 font-medium tabular-nums text-ink">{formatarMoeda(a.valor)}</span> : null}
                        <span className="truncate">{periodoTexto(a)}</span>
                      </span>
                    </Link>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${COR_STATUS[a.status]}`}>
                      <Icone aria-hidden="true" className="size-3.5" />
                      {ROTULO_STATUS[a.status]}
                    </span>
                  </div>
                  <AcoesAtestado
                    id={a.id}
                    status={a.status}
                    linkInicial={linkParaEnvio(a, emissora)}
                    podeEditar={podeEditar}
                    compacta
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
