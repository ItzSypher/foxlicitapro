import Link from "next/link";
import { connection } from "next/server";
import { FormularioFornecedor } from "@/components/fornecedores/formulario";
import { temPermissao } from "@/core/permissoes";
import { exigirSessao } from "@/lib/sessao";

export const metadata = { title: "Novo fornecedor · FoxLicita Pro" };

export default async function NovoFornecedorPage() {
  await connection();
  const sessao = await exigirSessao();
  const podeEditar = temPermissao(sessao, "editar_propostas");

  return (
    <div className="flex max-w-[720px] flex-col gap-5">
      <header className="flex flex-col gap-1">
        <Link href="/fornecedores" className="text-[13px] text-muted-foreground underline-offset-4 hover:underline">
          Fornecedores
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Novo fornecedor</h1>
      </header>
      {podeEditar ? (
        <FormularioFornecedor
          id={null}
          podeEditar
          inicial={{ nome: "", cnpj: null, contato: "", telefone: "", email: "", site: "", categorias: "", observacao: "", ativo: true }}
        />
      ) : (
        <p className="rounded-card border border-border px-4 py-5 text-sm text-muted-foreground">
          Você não tem permissão para cadastrar fornecedores.
        </p>
      )}
    </div>
  );
}
