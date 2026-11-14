import { connection } from "next/server";
import { redirect } from "next/navigation";
import { listarEmpresas } from "@/db/empresas";
import { exigirSessao } from "@/lib/sessao";
import { PainelEmpresas } from "./painel";

export const metadata = { title: "Empresas · FoxLicita Pro" };

export default async function AdminEmpresasPage() {
  await connection();
  const sessao = await exigirSessao();
  if (!sessao.superadmin) redirect("/radar");
  const empresas = await listarEmpresas();

  return (
    <div className="flex max-w-[860px] min-w-0 flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] leading-tight font-semibold text-ink">Empresas</h1>
        <p className="text-sm text-muted-foreground">
          Cada empresa tem os próprios dados e a própria equipe. Empresa desativada não consegue entrar.
        </p>
      </header>
      <PainelEmpresas
        empresaAtualId={sessao.empresaId}
        empresas={empresas.map((e) => ({
          id: e.id,
          cnpj: e.cnpj,
          nome: e.nomeFantasia?.trim() || e.razaoSocial,
          porte: e.porte,
          local: `${e.municipio}/${e.uf}`,
          ativa: e.ativa,
          usuarios: e.usuarios,
        }))}
      />
    </div>
  );
}
