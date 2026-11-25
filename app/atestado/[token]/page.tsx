import type { Metadata } from "next";
import { connection } from "next/server";
import { BotaoBaixar } from "@/components/propostas/botao-baixar";
import { PreviaEscalada } from "@/components/propostas/previa-escalada";
import { DocumentoAtestado } from "@/components/atestados/documento";
import { FormularioAssinatura } from "@/components/atestados/formulario-assinatura";
import { formatarCnpj } from "@/core/brasilapi";
import { paragrafosDoTexto, urlVerificacao } from "@/core/atestados";
import { emitenteDoPerfil, type Emitente } from "@/core/proposta-emitente";
import { lerEmpresa } from "@/db/empresas";
import { lerPorToken, type AtestadoPublico } from "@/db/atestados";
import { baseDoApp } from "@/lib/atestados-url";

export const metadata: Metadata = {
  title: "Atestado de capacidade técnica",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

function Aviso({ texto }: { texto: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#e5e5e5] px-6 text-center">
      <p className="max-w-sm text-base text-[#111]">{texto}</p>
    </main>
  );
}

export default async function AtestadoPublicoPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  let atestado: AtestadoPublico | null;
  let emitente: Emitente | null = null;
  try {
    atestado = await lerPorToken(token);
    // O timbre é da empresa que prestou o serviço, não de quem abre o link.
    const empresa = atestado ? await lerEmpresa(atestado.empresaId) : null;
    emitente = empresa ? emitenteDoPerfil({ ...empresa, assinatura: null }) : null;
  } catch {
    atestado = null;
  }

  if (!atestado || !emitente) return <Aviso texto="Este link não está mais disponível." />;
  if (atestado.expirado) return <Aviso texto="O prazo deste link terminou. Peça um novo link à empresa que enviou o atestado." />;

  const dados = {
    texto: atestado.texto,
    clienteNome: atestado.clienteNome,
    clienteCnpj: atestado.clienteCnpj,
    clienteEndereco: atestado.clienteEndereco,
    responsavelNome: atestado.responsavelNome,
    responsavelCargo: atestado.responsavelCargo,
  };

  if (atestado.status === "assinado" && atestado.codigo && atestado.assinadoEm) {
    return (
      <main className="min-h-dvh bg-[#e5e5e5] px-3 py-4 text-[#111] sm:px-6 sm:py-8 print:bg-white print:p-0">
        <div className="mx-auto flex w-full max-w-[794px] flex-col gap-4">
          <div className="nao-imprimir flex flex-col gap-3 rounded-xl border border-[#cfcfcf] bg-white p-4">
            <p className="text-base font-semibold">Atestado assinado. Obrigado!</p>
            <p className="text-sm text-[#444]">
              A assinatura foi registrada. Baixe o documento em PDF para guardar a sua cópia. Código de verificação:{" "}
              <strong>{atestado.codigo}</strong>.
            </p>
            <div>
              <BotaoBaixar />
            </div>
          </div>
          <PreviaEscalada>
            <DocumentoAtestado
              dados={dados}
              emitente={emitente}
              assinatura={{
                imagem: atestado.assinatura,
                nome: atestado.assinanteNome,
                cargo: atestado.assinanteCargo,
                assinadoEm: atestado.assinadoEm,
                codigo: atestado.codigo,
                urlVerificacao: urlVerificacao(baseDoApp(), atestado.codigo),
              }}
            />
          </PreviaEscalada>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#e5e5e5] px-3 py-4 text-[#111] sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
        <header className="flex flex-col gap-1">
          <p className="text-sm text-[#444]">{emitente.razaoSocial} pede a sua assinatura</p>
          <h1 className="text-[22px] leading-tight font-semibold">Atestado de capacidade técnica</h1>
          <p className="text-sm text-[#444]">Leia o texto abaixo e, estando de acordo, assine no final da página.</p>
        </header>

        <article className="flex flex-col gap-3 rounded-xl border border-[#cfcfcf] bg-white p-4 text-base leading-relaxed">
          <div className="border-b border-[#d9d9d9] pb-3 text-[13px] leading-snug text-[#444]">
            <p className="text-sm font-semibold text-[#111]">{emitente.razaoSocial}</p>
            <p>CNPJ {emitente.cnpj}</p>
          </div>
          {paragrafosDoTexto(atestado.texto).map((p, i) => (
            <p key={`${i}-${p.slice(0, 16)}`} className="whitespace-pre-line text-[#111]">
              {p}
            </p>
          ))}
          <div className="border-t border-[#d9d9d9] pt-3 text-sm text-[#444]">
            <p className="font-medium text-[#111]">{atestado.clienteNome}</p>
            {atestado.clienteCnpj ? <p>CNPJ {formatarCnpj(atestado.clienteCnpj)}</p> : null}
          </div>
        </article>

        <FormularioAssinatura token={token} nomeInicial={atestado.responsavelNome ?? ""} cargoInicial={atestado.responsavelCargo ?? ""} />
      </div>
    </main>
  );
}
