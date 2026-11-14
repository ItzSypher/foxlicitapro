import { connection } from "next/server";
import { redirect } from "next/navigation";
import { ROTULO_PORTE } from "@/core/perfil";
import { perfilDaEmpresa } from "@/lib/empresa-atual";
import { exigirSessao } from "@/lib/sessao";
import { FormularioEmpresa } from "./formulario";

export const metadata = { title: "Empresa · FoxLicita Pro" };

export default async function EmpresaPage() {
  await connection();
  const sessao = await exigirSessao();
  if (sessao.papel !== "dono") redirect("/radar");
  const perfil = await perfilDaEmpresa(sessao.empresaId);

  return (
    <div className="flex max-w-[720px] min-w-0 flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] leading-tight font-semibold text-ink">Empresa</h1>
        <p className="text-sm break-words text-muted-foreground">
          {perfil.razaoSocial} · CNPJ {perfil.cnpj} · {ROTULO_PORTE[perfil.porte]} · {perfil.municipio}/{perfil.uf}
        </p>
      </header>
      <FormularioEmpresa nomeFantasia={perfil.nomeFantasia} cnaes={perfil.cnaes} regioes={perfil.regioes} />
    </div>
  );
}
