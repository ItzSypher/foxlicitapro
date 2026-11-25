import { connection } from "next/server";
import { notFound } from "next/navigation";
import { DocumentoAtestado } from "@/components/atestados/documento";
import { BarraImprimir } from "@/components/propostas/barra-imprimir";
import { PreviaEscalada } from "@/components/propostas/previa-escalada";
import { urlVerificacao } from "@/core/atestados";
import { emitenteDoPerfil } from "@/core/proposta-emitente";
import { lerAssinaturaDoAtestado, lerAtestado } from "@/db/atestados";
import { baseDoApp } from "@/lib/atestados-url";
import { perfilAtual } from "@/lib/empresa-atual";
import { exigirSessao } from "@/lib/sessao";

export const metadata = { title: "Atestado de capacidade técnica" };

export default async function ImprimirAtestadoPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const sessao = await exigirSessao();
  const atestado = await lerAtestado(sessao.empresaId, id);
  if (!atestado || atestado.status === "cancelado") notFound();
  const perfil = await perfilAtual();
  const assinado = atestado.status === "assinado" && atestado.codigo !== null && atestado.assinadoEm !== null;
  const imagem = assinado ? await lerAssinaturaDoAtestado(sessao.empresaId, id) : null;

  return (
    <div className="flex flex-col gap-4">
      <BarraImprimir voltarPara={`/atestados/${atestado.id}`} rotuloVoltar="Voltar ao atestado" />
      <PreviaEscalada>
        <DocumentoAtestado
          dados={{
            texto: atestado.texto,
            clienteNome: atestado.clienteNome,
            clienteCnpj: atestado.clienteCnpj,
            clienteEndereco: atestado.clienteEndereco,
            responsavelNome: atestado.responsavelNome,
            responsavelCargo: atestado.responsavelCargo,
          }}
          emitente={emitenteDoPerfil({ ...perfil, assinatura: null })}
          assinatura={
            assinado && atestado.codigo !== null && atestado.assinadoEm !== null
              ? {
                  imagem,
                  nome: atestado.assinanteNome,
                  cargo: atestado.assinanteCargo,
                  assinadoEm: atestado.assinadoEm,
                  codigo: atestado.codigo,
                  urlVerificacao: urlVerificacao(baseDoApp(), atestado.codigo),
                }
              : null
          }
        />
      </PreviaEscalada>
    </div>
  );
}
