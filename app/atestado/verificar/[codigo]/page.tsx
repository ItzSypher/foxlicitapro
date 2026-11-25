import type { Metadata } from "next";
import { connection } from "next/server";
import { formatarCnpj } from "@/core/brasilapi";
import { formatarDataHoraBrasilia } from "@/core/datas-edital";
import { lerPorCodigo, type VerificacaoAtestado } from "@/db/atestados";

export const metadata: Metadata = {
  title: "Verificar atestado",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

function Linha({ rotulo, valor, mono = false }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[13px] text-[#555]">{rotulo}</dt>
      <dd className={mono ? "font-mono text-[13px] break-all" : "text-base"}>{valor}</dd>
    </div>
  );
}

export default async function VerificarAtestadoPage({ params }: { params: Promise<{ codigo: string }> }) {
  await connection();
  const { codigo } = await params;
  let r: VerificacaoAtestado | null;
  let falhou = false;
  try {
    r = await lerPorCodigo(decodeURIComponent(codigo).slice(0, 40));
  } catch {
    r = null;
    falhou = true;
  }

  return (
    <main className="min-h-dvh bg-[#e5e5e5] px-3 py-6 text-[#111] sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
        <h1 className="text-[22px] leading-tight font-semibold">Verificação de atestado</h1>

        {r === null ? (
          <p role="alert" className="rounded-xl border border-[#cfcfcf] bg-white p-4 text-base">
            {falhou
              ? "Não foi possível consultar agora. Tente de novo em instantes."
              : "Não encontramos nenhum atestado assinado com este código. Confira o código impresso no rodapé do documento."}
          </p>
        ) : (
          <section aria-label="Dados do atestado" className="flex flex-col gap-4 rounded-xl border border-[#cfcfcf] bg-white p-4">
            <p className="text-base font-semibold text-[#14632f]">
              {r.integro === false ? "Atestado encontrado, mas o conteúdo não confere com o registro." : "Atestado autêntico: o registro confere."}
            </p>
            <dl className="flex flex-col gap-3">
              <Linha rotulo="Cliente" valor={r.clienteNome + (r.clienteCnpj ? ` · CNPJ ${formatarCnpj(r.clienteCnpj)}` : "")} />
              <Linha rotulo="Empresa que prestou o serviço" valor={r.emissora} />
              <Linha rotulo="Assinado em" valor={formatarDataHoraBrasilia(r.assinadoEm) ?? r.assinadoEm} />
              <Linha
                rotulo="Assinante"
                valor={r.assinanteNome ? `${r.assinanteNome}${r.assinanteCargo ? `, ${r.assinanteCargo}` : ""}` : "Assinado com certificado digital, fora deste sistema"}
              />
              <Linha rotulo="Código" valor={r.codigo} mono />
              <Linha rotulo="Impressão digital do conteúdo (SHA-256)" valor={r.hash} mono />
            </dl>
          </section>
        )}
      </div>
    </main>
  );
}
