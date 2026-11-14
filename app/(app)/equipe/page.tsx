import { connection } from "next/server";
import { redirect } from "next/navigation";
import { listarUsuarios } from "@/db/usuarios";
import { exigirSessao } from "@/lib/sessao";
import type { Usuario } from "@/core/types-equipe";
import { ListaEquipe } from "./lista-equipe";

export const metadata = { title: "Equipe · FoxLicita Pro" };

export default async function EquipePage() {
  await connection();
  const sessao = await exigirSessao();
  if (sessao.papel !== "dono") redirect("/radar");

  let usuarios: Usuario[] | null;
  try {
    usuarios = await listarUsuarios(sessao.empresaId);
  } catch (e) {
    console.error("[equipe] leitura falhou:", e instanceof Error ? e.message : e);
    usuarios = null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold leading-tight text-ink">Equipe</h1>
        <p className="text-sm text-muted-foreground">Quem acessa o painel. Cada pessoa entra com o próprio e-mail e senha.</p>
      </header>
      {usuarios === null ? (
        <p role="alert" className="rounded-card border border-dashed border-control px-6 py-12 text-center text-sm text-ink">
          Não foi possível carregar a equipe agora.
        </p>
      ) : (
        <ListaEquipe usuarios={usuarios} usuarioId={sessao.usuarioId} />
      )}
    </div>
  );
}
