import { connection } from "next/server";
import { notFound } from "next/navigation";
import { DocumentoProposta } from "@/components/propostas/documento";
import { BarraImprimir } from "@/components/propostas/barra-imprimir";
import { PreviaEscalada } from "@/components/propostas/previa-escalada";
import { emitenteDoPerfil } from "@/core/proposta-emitente";
import { lerProposta } from "@/db/propostas";
import { perfilAtual } from "@/lib/empresa-atual";
import { exigirSessao } from "@/lib/sessao";

export const metadata = { title: "Proposta comercial" };

export default async function ImprimirPropostaPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const sessao = await exigirSessao();
  const proposta = await lerProposta(sessao.empresaId, id);
  if (!proposta) notFound();
  const perfil = await perfilAtual();

  return (
    <div className="flex flex-col gap-4">
      <BarraImprimir voltarPara={`/propostas/${proposta.id}`} />
      <PreviaEscalada>
        <DocumentoProposta dados={proposta.dados} modeloId={proposta.modelo} emitente={emitenteDoPerfil(perfil)} />
      </PreviaEscalada>
    </div>
  );
}
