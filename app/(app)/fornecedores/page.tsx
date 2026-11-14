import Link from "next/link";
import { connection } from "next/server";
import { Search } from "lucide-react";
import { temPermissao } from "@/core/permissoes";
import type { Fornecedor } from "@/core/fornecedores";
import { formatarCnpj } from "@/core/brasilapi";
import { listarFornecedores } from "@/db/fornecedores";
import { exigirSessao } from "@/lib/sessao";
import { BOTAO_PRIMARIO, CONTROLE } from "@/components/fornecedores/estilo";
import { plural } from "@/lib/formato";

export const metadata = { title: "Fornecedores · FoxLicita Pro" };

interface Props {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function FornecedoresPage({ searchParams }: Props) {
  await connection();
  const sessao = await exigirSessao();
  const { q } = await searchParams;
  const busca = ((Array.isArray(q) ? q[0] : q) ?? "").trim().slice(0, 100);
  const podeEditar = temPermissao(sessao, "editar_propostas");

  let lista: Fornecedor[] | null;
  try {
    lista = await listarFornecedores(sessao.empresaId, busca);
  } catch (e) {
    console.error("[fornecedores] leitura falhou:", e instanceof Error ? e.message : e);
    lista = null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[22px] font-semibold leading-tight text-ink">Fornecedores</h1>
          <p className="text-sm text-muted-foreground">Quem vende para você e quanto cobrou.</p>
        </div>
        {podeEditar ? (
          <Link href="/fornecedores/novo" className={`${BOTAO_PRIMARIO} shrink-0`}>
            Novo fornecedor
          </Link>
        ) : null}
      </header>

      <form role="search" action="/fornecedores" className="relative">
        <label htmlFor="busca-fornecedor" className="sr-only">
          Buscar fornecedor
        </label>
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
        <input
          id="busca-fornecedor"
          name="q"
          type="search"
          defaultValue={busca}
          placeholder="Buscar por nome, CNPJ, contato ou categoria"
          autoComplete="off"
          className={`${CONTROLE} pl-9`}
        />
      </form>

      {lista === null ? (
        <p role="alert" className="rounded-card border border-border px-4 py-5 text-sm text-negative">
          Não foi possível carregar os fornecedores agora. Tente de novo em instantes.
        </p>
      ) : lista.length === 0 ? (
        <p className="rounded-card border border-border px-4 py-5 text-sm text-muted-foreground">
          {busca === "" ? "Nenhum fornecedor cadastrado ainda." : "Nenhum fornecedor encontrado para essa busca."}
        </p>
      ) : (
        <section aria-label="Lista de fornecedores" className="flex flex-col gap-2">
          <p className="text-[13px] text-muted-foreground">
            {lista.length} {plural(lista.length, "fornecedor", "fornecedores")}
          </p>
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card border border-border">
            {lista.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/fornecedores/${f.id}`}
                  className="flex min-h-14 flex-col justify-center gap-1 px-4 py-3 outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium text-ink">{f.nome}</span>
                    {f.ativo ? null : <span className="shrink-0 text-xs text-faint">Inativo</span>}
                  </span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    {[f.categorias, f.telefone, f.cnpj ? formatarCnpj(f.cnpj) : ""].filter((t) => t !== "").join(" · ") || "Sem detalhes"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
