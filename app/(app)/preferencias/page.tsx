import { connection } from "next/server";
import { temPermissao } from "@/core/permissoes";
import { lerPreferencias } from "@/db/preferencias";
import { lerSessao } from "@/lib/sessao";
import { FormularioPreferencias } from "./formulario";

/** Quem tem a permissão pode editar; qualquer falha ao ler a sessão vira "só leitura". */
async function pessoaPodeEditar(): Promise<boolean> {
  try {
    const sessao = await lerSessao();
    return sessao !== null && temPermissao(sessao, "editar_preferencias");
  } catch {
    return false;
  }
}

export default async function PreferenciasPage() {
  await connection();
  const [preferencias, podeEditar] = await Promise.all([lerPreferencias(), pessoaPodeEditar()]);

  return (
    <div className="flex max-w-[720px] flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] leading-tight font-semibold text-ink">Preferências</h1>
        <p className="text-sm text-muted-foreground">
          Aqui você diz o que quer ver no Radar e quem recebe o resumo por e-mail.
        </p>
      </header>
      <FormularioPreferencias inicial={preferencias} podeEditar={podeEditar} />
    </div>
  );
}
