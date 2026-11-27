import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EsqueletoNumeros } from "@/components/licitacao/numeros";
import { ChipsSecoes, IndiceSecoes } from "@/components/licitacao/navegacao-secoes";
import { EsqueletoTopo, esqueletoDaSecao } from "./esqueletos";
import {
  aquecer,
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
 * o topo e os números primeiro (só dependem dos dados gerais do PNCP e de poucas leituras do banco),
 * as partes pesadas (itens, arquivos, ficha, caixa, concorrentes) em paralelo.
 * Resumo, sinais, texto, nota, semelhantes e concorrentes chegam recolhidos.
 * Os esqueletos vêm de `esqueletos.tsx`, os mesmos do loading.tsx: nada pula quando o conteúdo chega.
 */
export default async function LicitacaoPage({ params }: Props) {
  await connection();
  const chave = await params;
  if (!/^\d{14}$/.test(chave.cnpj) || !/^\d{4}$/.test(chave.ano) || !/^\d{1,9}$/.test(chave.sequencial)) notFound();
  const sessao = await sessaoDoPedido();
  aquecer(chave, sessao);

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
          <Suspense fallback={esqueletoDaSecao("datas")}>
            <SecaoDatas chave={chave} />
          </Suspense>
          <Suspense fallback={esqueletoDaSecao("preco-sugerido")}>
            <SecaoPreco chave={chave} />
          </Suspense>
          <Suspense fallback={esqueletoDaSecao("caixa")}>
            <SecaoCaixa chave={chave} />
          </Suspense>
          <Suspense fallback={esqueletoDaSecao("ficha")}>
            <SecaoFicha chave={chave} />
          </Suspense>
          <Suspense fallback={esqueletoDaSecao("itens")}>
            <SecaoItens chave={chave} />
          </Suspense>
          <Suspense fallback={esqueletoDaSecao("arquivos")}>
            <SecaoArquivos chave={chave} />
          </Suspense>
          <Suspense fallback={esqueletoDaSecao("acervo")}>
            <SecaoAcervo chave={chave} />
          </Suspense>
          <Suspense fallback={esqueletoDaSecao("concorrentes")}>
            <SecaoConcorrentes chave={chave} />
          </Suspense>
          <Suspense fallback={esqueletoDaSecao("semelhantes")}>
            <SecaoSemelhantes chave={chave} />
          </Suspense>
          <Suspense fallback={esqueletoDaSecao("resumo")}>
            <SecaoResumo chave={chave} />
          </Suspense>
          <Suspense fallback={esqueletoDaSecao("sinais")}>
            <SecaoSinais chave={chave} />
          </Suspense>
          <Suspense fallback={esqueletoDaSecao("texto")}>
            <SecaoTexto chave={chave} />
          </Suspense>
          <Suspense fallback={esqueletoDaSecao("nota")}>
            <SecaoNota chave={chave} />
          </Suspense>
        </div>
        <IndiceSecoes />
      </div>
    </div>
  );
}
