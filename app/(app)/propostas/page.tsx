import { connection } from "next/server";
import { BotaoNovaProposta, ListaPropostas } from "@/components/propostas/lista-propostas";
import { listarPropostas, type ResumoProposta } from "@/db/propostas";
import { exigirSessao } from "@/lib/sessao";

export const metadata = { title: "Propostas · FoxLicita Pro" };

export default async function PropostasPage() {
  await connection();
  const sessao = await exigirSessao();
  let propostas: ResumoProposta[] | null;
  try {
    propostas = await listarPropostas();
  } catch (e) {
    console.error("[propostas] leitura falhou:", e instanceof Error ? e.message : e);
    propostas = null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[22px] font-semibold leading-tight text-ink">Propostas</h1>
          <p className="text-sm text-muted-foreground">Edite, mande para revisão e envie depois de aprovada.</p>
        </div>
        <BotaoNovaProposta />
      </header>
      {propostas === null ? (
        <p role="alert" className="rounded-card border border-dashed border-control px-6 py-12 text-center text-sm text-ink">
          Não foi possível carregar as propostas agora.
        </p>
      ) : (
        <ListaPropostas propostas={propostas} usuarioId={sessao.usuarioId} />
      )}
    </div>
  );
}
