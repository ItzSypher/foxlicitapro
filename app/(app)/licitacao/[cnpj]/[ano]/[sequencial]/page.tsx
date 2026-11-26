import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EsqueletoNumeros } from "@/components/licitacao/numeros";
import { ChipsSecoes, IndiceSecoes } from "@/components/licitacao/navegacao-secoes";
import {
  aquecer,
  EsqueletoRecolhida,
  EsqueletoSecao,
  EsqueletoTopo,
  SecaoAcervo,
  SecaoArquivos,
  SecaoCaixa,
  SecaoConcorrentes,
  SecaoDatas,
  SecaoFicha,
  SecaoItens,
  SecaoNota,
  SecaoNumeros,
  SecaoPreco,
  SecaoResumo,
  SecaoSemelhantes,
  SecaoSinais,
  SecaoTexto,
  sessaoDoPedido,
  TopoLicitacao,
} from "./secoes";

/** A montagem da proposta pelo assistente (server action desta rota) pode levar mais de 1 minuto. */
export const maxDuration = 300;

interface Props {
  params: Promise<{ cnpj: string; ano: string; sequencial: string }>;
}

/**
 * A página responde na hora e entrega cada seção quando ela fica pronta:
 * o topo e os números primeiro, as partes pesadas (itens, arquivos, ficha, caixa, concorrentes) em paralelo.
 * Resumo, sinais, texto, nota, semelhantes e concorrentes chegam recolhidos.
 */
export default async function LicitacaoPage({ params }: Props) {
  await connection();
  const chave = await params;
  if (!/^\d{14}$/.test(chave.cnpj) || !/^\d{4}$/.test(chave.ano) || !/^\d{1,9}$/.test(chave.sequencial)) notFound();
  await sessaoDoPedido();
  aquecer(chave);

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-20 lg:pb-0">
      <Suspense fallback={<EsqueletoTopo />}>
        <TopoLicitacao chave={chave} />
      </Suspense>

      <Suspense fallback={<EsqueletoNumeros />}>
        <SecaoNumeros chave={chave} />
      </Suspense>

      <ChipsSecoes />

      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_160px] xl:gap-10">
        <div className="flex min-w-0 flex-col gap-4">
          <Suspense fallback={<EsqueletoSecao id="datas" titulo="Datas" linhas={2} />}>
            <SecaoDatas chave={chave} />
          </Suspense>
          <Suspense fallback={<EsqueletoSecao id="preco-sugerido" titulo="Preço sugerido" linhas={3} />}>
            <SecaoPreco chave={chave} />
          </Suspense>
          <Suspense fallback={<EsqueletoSecao id="caixa" titulo="Caminho do dinheiro" linhas={4} />}>
            <SecaoCaixa chave={chave} />
          </Suspense>
          <Suspense fallback={<EsqueletoSecao id="ficha" titulo="Ficha do edital" linhas={4} />}>
            <SecaoFicha chave={chave} />
          </Suspense>
          <Suspense fallback={<EsqueletoSecao id="itens" titulo="Itens" linhas={5} />}>
            <SecaoItens chave={chave} />
          </Suspense>
          <Suspense fallback={<EsqueletoSecao id="arquivos" titulo="Arquivos" linhas={3} />}>
            <SecaoArquivos chave={chave} />
          </Suspense>
          <Suspense fallback={<EsqueletoSecao id="acervo" titulo="Do seu acervo" linhas={2} />}>
            <SecaoAcervo chave={chave} />
          </Suspense>
          <Suspense fallback={<EsqueletoRecolhida id="concorrentes" titulo="Concorrentes" />}>
            <SecaoConcorrentes chave={chave} />
          </Suspense>
          <Suspense fallback={<EsqueletoRecolhida id="semelhantes" titulo="Semelhantes" />}>
            <SecaoSemelhantes chave={chave} />
          </Suspense>
          <Suspense fallback={<EsqueletoRecolhida id="resumo" titulo="Resumo" />}>
            <SecaoResumo chave={chave} />
          </Suspense>
          <Suspense fallback={<EsqueletoRecolhida id="sinais" titulo="Sinais para o seu perfil" />}>
            <SecaoSinais chave={chave} />
          </Suspense>
          <Suspense fallback={<EsqueletoRecolhida id="texto" titulo="Texto do edital" />}>
            <SecaoTexto chave={chave} />
          </Suspense>
          <Suspense fallback={<EsqueletoRecolhida id="nota" titulo="Por que essa nota" />}>
            <SecaoNota chave={chave} />
          </Suspense>
        </div>
        <IndiceSecoes />
      </div>
    </div>
  );
}
