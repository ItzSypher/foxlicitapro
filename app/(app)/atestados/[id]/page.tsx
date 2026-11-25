import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AcoesAtestado } from "@/components/atestados/acoes";
import { AnexarPdf } from "@/components/atestados/anexar-pdf";
import { FormularioAtestado, type ValoresAtestado } from "@/components/atestados/formulario";
import { formatarCnpj } from "@/core/brasilapi";
import { formatarDataHoraBrasilia } from "@/core/datas-edital";
import { ROTULO_STATUS, podeEditar, urlVerificacao } from "@/core/atestados";
import { temPermissao } from "@/core/permissoes";
import { lerAtestado } from "@/db/atestados";
import { lerEmpresa } from "@/db/empresas";
import { baseDoApp, linkParaEnvio } from "@/lib/atestados-url";
import { assistenteDisponivel } from "@/lib/gemini";
import { exigirSessao } from "@/lib/sessao";

export const metadata = { title: "Atestado · FoxLicita Pro" };

function Evidencia({ rotulo, valor, mono = false }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className={mono ? "font-mono text-[13px] break-all text-ink" : "text-sm break-words text-ink"}>{valor}</dd>
    </div>
  );
}

export default async function AtestadoPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const sessao = await exigirSessao();
  const { id } = await params;
  const atestado = await lerAtestado(sessao.empresaId, id);
  if (!atestado) notFound();
  const empresa = await lerEmpresa(sessao.empresaId);
  const pode = temPermissao(sessao, "editar_propostas");
  const editavel = pode && podeEditar(atestado.status);

  const inicial: ValoresAtestado = {
    clienteNome: atestado.clienteNome,
    clienteCnpj: atestado.clienteCnpj ? formatarCnpj(atestado.clienteCnpj) : "",
    clienteEndereco: atestado.clienteEndereco ?? "",
    responsavelNome: atestado.responsavelNome ?? "",
    responsavelCargo: atestado.responsavelCargo ?? "",
    responsavelContato: atestado.responsavelContato ?? "",
    objeto: atestado.objeto,
    areas: atestado.areas.join(", "),
    periodoInicio: atestado.periodoInicio ?? "",
    periodoFim: atestado.periodoFim ?? "",
    valor: atestado.valor === null ? "" : String(atestado.valor).replace(".", ","),
    texto: atestado.texto,
  };

  return (
    <div className="mx-auto flex w-full max-w-[640px] min-w-0 flex-col gap-5">
      <header className="flex min-w-0 flex-col gap-1">
        <Link href="/atestados" className="text-[13px] text-muted-foreground underline-offset-4 hover:underline">
          Atestados
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight break-words text-ink">{atestado.clienteNome}</h1>
        <p className="text-sm text-muted-foreground">{ROTULO_STATUS[atestado.status]}</p>
      </header>

      <AcoesAtestado
        id={atestado.id}
        status={atestado.status}
        linkInicial={linkParaEnvio(atestado, empresa?.nomeFantasia ?? empresa?.razaoSocial ?? "nossa empresa")}
        podeEditar={pode}
        mostrarVer={false}
      />

      {atestado.status === "assinado" && atestado.codigo && atestado.assinadoEm ? (
        <section aria-labelledby="titulo-assinatura" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <h2 id="titulo-assinatura" className="text-base font-semibold text-ink">
            Registro da assinatura
          </h2>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Evidencia rotulo="Assinado em" valor={formatarDataHoraBrasilia(atestado.assinadoEm) ?? atestado.assinadoEm} />
            <Evidencia
              rotulo="Assinante"
              valor={atestado.assinanteNome ? `${atestado.assinanteNome}, ${atestado.assinanteCargo ?? ""}` : "Assinado fora do sistema (PDF anexado)"}
            />
            <Evidencia rotulo="Código" valor={atestado.codigo} mono />
            {atestado.assinaturaIp ? <Evidencia rotulo="Endereço de rede (IP)" valor={atestado.assinaturaIp} /> : null}
            {atestado.assinaturaAgente ? <Evidencia rotulo="Navegador" valor={atestado.assinaturaAgente} /> : null}
          </dl>
          {atestado.conteudoHash ? <Evidencia rotulo="SHA-256 do conteúdo" valor={atestado.conteudoHash} mono /> : null}
          <p className="text-[13px] break-all text-muted-foreground">
            Verificação pública: {urlVerificacao(baseDoApp(), atestado.codigo)}
          </p>
          {atestado.temArquivoAssinado ? (
            <a
              href={`/atestados/${atestado.id}/arquivo`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand underline underline-offset-4"
            >
              Abrir o PDF assinado
            </a>
          ) : null}
        </section>
      ) : null}

      {editavel || atestado.status === "assinado" ? null : (
        <p className="text-sm text-muted-foreground">
          {atestado.status === "cancelado" ? "Atestado cancelado." : "Você pode consultar, mas não editar atestados."}
        </p>
      )}

      {atestado.status === "assinado" ? (
        pode ? (
          <section aria-label="PDF assinado fora do sistema" className="rounded-xl border border-border bg-surface p-4">
            <AnexarPdf id={atestado.id} temArquivo={atestado.temArquivoAssinado} />
          </section>
        ) : null
      ) : (
        <>
          <FormularioAtestado
            key={`${atestado.id}-${atestado.criadoEm}-${atestado.status}`}
            id={atestado.id}
            inicial={inicial}
            emissora={{ razaoSocial: empresa?.razaoSocial ?? "", cnpj: empresa?.cnpj ?? "" }}
            podeEditar={editavel}
            podeAssistente={assistenteDisponivel() && temPermissao(sessao, "usar_assistente")}
          />
          {atestado.status !== "cancelado" && pode ? (
            <section aria-label="PDF assinado fora do sistema" className="rounded-xl border border-border bg-surface p-4">
              <AnexarPdf id={atestado.id} temArquivo={atestado.temArquivoAssinado} />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
