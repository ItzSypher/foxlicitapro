import type { Metadata } from "next";
import { connection } from "next/server";
import { BotaoBaixar } from "@/components/propostas/botao-baixar";
import { DocumentoProposta } from "@/components/propostas/documento";
import { PreviaEscalada } from "@/components/propostas/previa-escalada";
import { lerPorToken, type PropostaPublica } from "@/db/propostas";

export const metadata: Metadata = {
  title: "Proposta comercial",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function PropostaPublicaPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  let proposta: PropostaPublica | null;
  try {
    proposta = await lerPorToken(token);
  } catch {
    proposta = null;
  }

  if (!proposta) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#e5e5e5] px-6 text-center">
        <p className="text-base text-[#111]">Este link não está mais disponível.</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#e5e5e5] px-3 py-4 text-[#111] sm:px-6 sm:py-8 print:bg-white print:p-0">
      <div className="mx-auto flex w-full max-w-[794px] flex-col gap-4">
        <div className="nao-imprimir flex justify-end">
          <BotaoBaixar />
        </div>
        <PreviaEscalada>
          <DocumentoProposta dados={proposta.dados} modeloId={proposta.modelo} />
        </PreviaEscalada>
      </div>
    </main>
  );
}
