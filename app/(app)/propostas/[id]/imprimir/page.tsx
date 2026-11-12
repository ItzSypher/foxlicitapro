import { connection } from "next/server";
import { notFound } from "next/navigation";
import { DocumentoProposta } from "@/components/propostas/documento";
import { BarraImprimir } from "@/components/propostas/barra-imprimir";
import { PreviaEscalada } from "@/components/propostas/previa-escalada";
import { lerProposta } from "@/db/propostas";

export const metadata = { title: "Proposta comercial" };

export default async function ImprimirPropostaPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const proposta = await lerProposta(id);
  if (!proposta) notFound();

  return (
    <div className="flex flex-col gap-4">
      <BarraImprimir voltarPara={`/propostas/${proposta.id}`} />
      <PreviaEscalada>
        <DocumentoProposta dados={proposta.dados} modeloId={proposta.modelo} />
      </PreviaEscalada>
    </div>
  );
}
