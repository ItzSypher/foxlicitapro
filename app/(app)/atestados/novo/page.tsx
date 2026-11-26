import Link from "next/link";
import { connection } from "next/server";
import { FormularioAtestado, VALORES_VAZIOS } from "@/components/atestados/formulario";
import { temPermissao } from "@/core/permissoes";
import { assistenteDisponivel } from "@/lib/gemini";
import { perfilAtual } from "@/lib/empresa-atual";
import { exigirSessao } from "@/lib/sessao";

export const metadata = { title: "Novo atestado · FoxLicita Pro" };

export default async function NovoAtestadoPage() {
  await connection();
  const sessao = await exigirSessao();
  const podeEditar = temPermissao(sessao, "editar_propostas");
  const perfil = await perfilAtual();

  return (
    <div className="mx-auto flex w-full max-w-[640px] min-w-0 flex-col gap-5">
      <header className="flex min-w-0 flex-col gap-1">
        <Link href="/atestados" className="text-[13px] text-muted-foreground underline-offset-4 hover:underline">
          Atestados
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Novo atestado</h1>
        <p className="text-sm text-muted-foreground">Preencha, revise o texto e envie o link ao cliente.</p>
      </header>
      <FormularioAtestado
        id={null}
        inicial={VALORES_VAZIOS}
        emissora={{ razaoSocial: perfil.razaoSocial, cnpj: perfil.cnpj }}
        podeEditar={podeEditar}
        podeAssistente={assistenteDisponivel() && temPermissao(sessao, "usar_assistente")}
      />
    </div>
  );
}
