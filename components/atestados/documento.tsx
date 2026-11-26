import { dataPorExtenso } from "@/core/proposta";
import { formatarCnpj } from "@/core/brasilapi";
import { paragrafosDoTexto } from "@/core/atestados";
import { formatarDataHoraBrasilia } from "@/core/datas-edital";
import type { Emitente } from "@/core/proposta-emitente";

const diaBrasilia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

export interface DadosDocumentoAtestado {
  texto: string;
  clienteNome: string;
  clienteCnpj: string | null;
  clienteEndereco: string | null;
  /** Quem deve assinar pelo cliente, quando a empresa já sabe */
  responsavelNome: string | null;
  responsavelCargo: string | null;
}

export interface AssinaturaDocumento {
  /** Data URL da assinatura; null no PDF assinado fora */
  imagem: string | null;
  nome: string | null;
  cargo: string | null;
  assinadoEm: string;
  codigo: string;
  urlVerificacao: string;
}

/**
 * Documento do atestado: A4, margens de 20 mm, preto no branco em qualquer tema.
 * Cabeçalho com os dados do cliente que atesta, sem logo; o cliente assina embaixo.
 * Usado na prévia, na página pública, na impressão e no PDF.
 */
export function DocumentoAtestado({
  dados,
  emitente,
  assinatura,
}: {
  dados: DadosDocumentoAtestado;
  emitente: Emitente;
  assinatura: AssinaturaDocumento | null;
}) {
  const nomeAssinante = assinatura?.nome ?? dados.responsavelNome;
  const cargoAssinante = assinatura?.cargo ?? dados.responsavelCargo;
  const dataLocal = assinatura ? dataPorExtenso(diaBrasilia.format(new Date(assinatura.assinadoEm))) : "";
  const quando = assinatura ? formatarDataHoraBrasilia(assinatura.assinadoEm) : null;

  return (
    <article
      className="doc-folha box-border w-[210mm] min-h-[297mm] bg-white p-[20mm] font-sans text-[11pt] leading-[1.5] text-black shadow-lg [print-color-adjust:exact]"
      style={{ colorScheme: "light" }}
    >
      {/* Sem logo: quem atesta é o cliente, então o cabeçalho é dele. A empresa atestada aparece no texto. */}
      <div className="border-b border-black pb-3 text-[9pt] leading-snug">
        <p className="text-[11pt] font-bold">{dados.clienteNome}</p>
        {dados.clienteCnpj ? <p>CNPJ {formatarCnpj(dados.clienteCnpj)}</p> : null}
        {dados.clienteEndereco ? <p>{dados.clienteEndereco}</p> : null}
      </div>

      <h1 className="doc-titulo mt-8 text-center text-[14pt] font-bold tracking-wide">ATESTADO DE CAPACIDADE TÉCNICA</h1>

      <section className="mt-8 flex flex-col gap-3">
        {paragrafosDoTexto(dados.texto).map((p, i) => (
          <p key={`${i}-${p.slice(0, 16)}`} className="whitespace-pre-line text-justify indent-[12mm]">
            {p}
          </p>
        ))}
      </section>

      <div className="doc-bloco mt-10 break-inside-avoid">
        <p>{dataLocal !== "" ? `${emitente.cidade !== "" ? `${emitente.cidade}, ` : ""}${dataLocal}.` : "Local e data: ______________________________"}</p>
        {assinatura?.imagem ? (
          // data URL gravada no banco: next/image não se aplica a esse tipo de origem
          // eslint-disable-next-line @next/next/no-img-element
          <img src={assinatura.imagem} alt="Assinatura" className="mt-6 block h-[18mm] w-[90mm] object-contain object-left" />
        ) : (
          <div className="mt-16" />
        )}
        <div className="-mt-1 w-[100mm] border-t border-black pt-1 text-[10pt] leading-snug">
          {nomeAssinante ? <p className="font-bold">{nomeAssinante}</p> : <p>Nome e assinatura do responsável</p>}
          {cargoAssinante ? <p>{cargoAssinante}</p> : null}
          <p>{dados.clienteNome}</p>
          {dados.clienteCnpj ? <p>CNPJ {formatarCnpj(dados.clienteCnpj)}</p> : null}
          {dados.clienteEndereco ? <p>{dados.clienteEndereco}</p> : null}
        </div>
      </div>

      {assinatura ? (
        <p className="doc-bloco mt-8 break-inside-avoid border-t border-black pt-2 text-[8.5pt] leading-snug">
          Assinado eletronicamente em {quando ?? assinatura.assinadoEm} · Código {assinatura.codigo} · Verifique em{" "}
          {assinatura.urlVerificacao}
        </p>
      ) : null}
    </article>
  );
}
