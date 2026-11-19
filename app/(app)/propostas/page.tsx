import { connection } from "next/server";
import { BotaoNovaProposta, ListaPropostas, type Aba } from "@/components/propostas/lista-propostas";
import { RegistrarExterna } from "@/components/propostas/registrar-externa";
import { listarPropostas, type ResumoProposta } from "@/db/propostas";
import { podeAgirNaRevisao } from "@/core/permissoes";
import { exigirSessao } from "@/lib/sessao";

export const metadata = { title: "Propostas · FoxLicita Pro" };

const ABAS: ReadonlyArray<Aba> = ["revisar", "minhas", "sem-resultado", "todas"];

function abaDaUrl(valor: string | string[] | undefined): Aba | undefined {
  const bruto = Array.isArray(valor) ? valor[0] : valor;
  return ABAS.find((a) => a === bruto);
}

export default async function PropostasPage({ searchParams }: { searchParams: Promise<{ aba?: string | string[] }> }) {
  await connection();
  const sessao = await exigirSessao();
  const { aba } = await searchParams;
  let propostas: ResumoProposta[] | null;
  try {
    propostas = await listarPropostas(sessao.empresaId);
  } catch (e) {
    console.error("[propostas] leitura falhou:", e instanceof Error ? e.message : e);
    propostas = null;
  }
  const podeCriar = podeAgirNaRevisao(sessao, "enviar");

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[22px] font-semibold leading-tight text-ink">Propostas</h1>
          <p className="text-sm text-muted-foreground">Edite, mande para revisão, envie e acompanhe o resultado.</p>
        </div>
        {podeCriar ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <RegistrarExterna />
            <BotaoNovaProposta />
          </div>
        ) : null}
      </header>
      {propostas === null ? (
        <p role="alert" className="rounded-card border border-dashed border-control px-6 py-12 text-center text-sm text-ink">
          Não foi possível carregar as propostas agora.
        </p>
      ) : (
        <ListaPropostas propostas={propostas} usuarioId={sessao.usuarioId} abaInicial={abaDaUrl(aba)} />
      )}
    </div>
  );
}
