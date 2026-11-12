import Image from "next/image";
import { EMITENTE, enderecoCompleto } from "@/core/proposta-emitente";
import { obterModelo, type ModeloId } from "@/core/proposta-modelos";
import { dataPorExtenso, totalItemCentavos, totalProposta, valorPorExtenso } from "@/core/proposta";
import type { DadosProposta } from "@/core/types-detalhe";
import { formatarMoeda } from "@/lib/formato";

const quantidadeFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

function quantidadeTexto(n: number): string {
  return quantidadeFmt.format(n);
}

function Condicao({ rotulo, valor }: { rotulo: string; valor: string }) {
  if (valor.trim() === "") return null;
  return (
    <div className="grid grid-cols-[34mm_1fr] gap-x-3">
      <dt className="font-semibold">{rotulo}</dt>
      <dd className="whitespace-pre-line">{valor}</dd>
    </div>
  );
}

/**
 * Documento da proposta: A4, margens de 20 mm, preto no branco em qualquer tema.
 * Usado na prévia, na impressão e na página pública. Largura fixa de 210 mm.
 */
export function DocumentoProposta({ dados, modeloId }: { dados: DadosProposta; modeloId: ModeloId }) {
  const modelo = obterModelo(modeloId);
  const totalCentavos = totalProposta(dados);
  const total = totalCentavos / 100;
  const referencia: Array<[string, string]> = [
    ["Compra", dados.numeroCompra],
    ["Processo", dados.processo],
    ["Objeto", dados.objeto],
  ];

  return (
    <article
      className="doc-folha box-border w-[210mm] min-h-[297mm] bg-white p-[20mm] font-sans text-[10.5pt] leading-[1.4] text-black shadow-lg [print-color-adjust:exact]"
      style={{ colorScheme: "light" }}
    >
      <div className="flex items-center gap-4 border-b border-black pb-3">
        <Image src="/raposa.svg" alt="" width={249} height={254} unoptimized className="h-[14mm] w-auto shrink-0" />
        <div className="min-w-0 text-[9pt] leading-snug">
          <p className="text-[11pt] font-bold">{EMITENTE.razaoSocial}</p>
          <p>CNPJ {EMITENTE.cnpj}</p>
          <p>{enderecoCompleto()}</p>
          <p>
            {EMITENTE.telefone} · {EMITENTE.email}
          </p>
        </div>
      </div>

      <h1 className="mt-6 text-center text-[14pt] font-bold tracking-wide">PROPOSTA COMERCIAL</h1>

      <section className="mt-5">
        <p>À</p>
        <p className="font-bold">{dados.orgao}</p>
        {dados.unidade.trim() !== "" && <p>{dados.unidade}</p>}
      </section>

      <dl className="mt-4 flex flex-col gap-0.5">
        {referencia.map(([rotulo, valor]) =>
          valor.trim() === "" ? null : (
            <div key={rotulo} className="grid grid-cols-[24mm_1fr] gap-x-3">
              <dt className="font-semibold">{rotulo}</dt>
              <dd>{valor}</dd>
            </div>
          ),
        )}
      </dl>

      <p className="mt-4 text-justify">{modelo.textos.abertura}</p>

      <table className="mt-4 w-full table-fixed border-collapse text-[9pt]">
        <colgroup>
          <col className="w-[9mm]" />
          <col />
          <col className="w-[28mm]" />
          <col className="w-[10mm]" />
          <col className="w-[13mm]" />
          <col className="w-[22mm]" />
          <col className="w-[24mm]" />
        </colgroup>
        <thead className="table-header-group">
          <tr className="bg-[#e8e8e8] text-left">
            <th className="border border-black px-1.5 py-1 font-semibold">Item</th>
            <th className="border border-black px-1.5 py-1 font-semibold">Descrição</th>
            <th className="border border-black px-1.5 py-1 font-semibold">Marca/modelo</th>
            <th className="border border-black px-1.5 py-1 font-semibold">Un.</th>
            <th className="border border-black px-1.5 py-1 text-right font-semibold">Qtd.</th>
            <th className="border border-black px-1.5 py-1 text-right font-semibold">Unitário</th>
            <th className="border border-black px-1.5 py-1 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {dados.itens.map((item) => (
            <tr key={item.numero} className="break-inside-avoid align-top">
              <td className="border border-black px-1.5 py-1">{item.numero}</td>
              <td className="border border-black px-1.5 py-1 break-words">{item.descricao}</td>
              <td className="border border-black px-1.5 py-1 break-words">{item.marcaModelo}</td>
              <td className="border border-black px-1.5 py-1">{item.unidade}</td>
              <td className="border border-black px-1.5 py-1 text-right tabular-nums">{quantidadeTexto(item.quantidade)}</td>
              <td className="border border-black px-1.5 py-1 text-right tabular-nums">{formatarMoeda(item.valorUnitario)}</td>
              <td className="border border-black px-1.5 py-1 text-right tabular-nums">
                {formatarMoeda(totalItemCentavos(item) / 100)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 break-inside-avoid text-right">
        <p className="text-[11pt] font-bold tabular-nums">Valor total: {formatarMoeda(total)}</p>
        <p className="text-[9.5pt]">({valorPorExtenso(total)})</p>
      </div>

      <section className="mt-5 break-inside-avoid">
        <h2 className="mb-1 text-[10.5pt] font-bold">Condições da proposta</h2>
        <dl className="flex flex-col gap-0.5">
          <Condicao rotulo="Validade" valor={`${dados.validadeDias} dias, contados da data desta proposta`} />
          <Condicao rotulo="Prazo de entrega" valor={dados.prazoEntrega} />
          <Condicao rotulo="Local de entrega" valor={dados.localEntrega} />
          <Condicao rotulo="Pagamento" valor={dados.pagamento} />
          <Condicao rotulo="Garantia" valor={dados.garantia} />
          <Condicao rotulo="Observações" valor={dados.observacoes} />
        </dl>
      </section>

      <section className="mt-5">
        <h2 className="mb-1 text-[10.5pt] font-bold">Declarações</h2>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-justify">
          {modelo.textos.declaracoes.map((texto) => (
            <li key={texto} className="break-inside-avoid">
              {texto}
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-5 text-justify">{modelo.textos.fechamento}</p>

      <div className="mt-6 break-inside-avoid">
        <p>
          {EMITENTE.cidade}, {dataPorExtenso(dados.data)}.
        </p>
        <div className="mt-14 w-[90mm] border-t border-black pt-1 text-[9.5pt] leading-snug">
          <p className="font-bold">{EMITENTE.responsavel}</p>
          <p>{EMITENTE.razaoSocial}</p>
          <p>CNPJ {EMITENTE.cnpj}</p>
        </div>
      </div>
    </article>
  );
}
