import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AvisoFalha } from "@/components/licitacao/aviso-falha";
import { ArquivosCompra } from "@/components/licitacao/arquivos-compra";
import { BarraAcoes } from "@/components/licitacao/barra-acoes";
import { CabecalhoLicitacao } from "@/components/licitacao/cabecalho";
import { gerarSinais, linhaIdentificacao, montarOportunidade } from "@/components/licitacao/dominio";
import { DatasEdital } from "@/components/licitacao/datas-edital";
import { FichaEditalSecao } from "@/components/licitacao/ficha-edital";
import { ItensCompra } from "@/components/licitacao/itens-compra";
import { ChipsSecoes, IndiceSecoes } from "@/components/licitacao/navegacao-secoes";
import { NotaCriterios } from "@/components/licitacao/nota-criterios";
import { Resumo } from "@/components/licitacao/resumo";
import { Sinais } from "@/components/licitacao/sinais";
import { TextoEdital } from "@/components/licitacao/texto-edital";
import { buscarDetalheCompra } from "@/core/pncp/detalhe";
import { resumirObjeto } from "@/core/objeto";
import { calcularScore } from "@/core/score";
import type { FichaSalva } from "@/core/ficha";
import type { OportunidadeComScore } from "@/core/types";
import { lerFicha } from "@/db/fichas";
import { idsNoPipeline } from "@/db/pipeline";
import { COOKIE_FRENTE, lerFrente } from "@/lib/frente";
import { assistenteDisponivel } from "@/lib/gemini";
import { temPermissao } from "@/core/permissoes";
import { lerSessao } from "@/lib/sessao";

/** A montagem da proposta pelo assistente (server action desta rota) pode levar mais de 1 minuto. */
export const maxDuration = 300;

interface Props {
  params: Promise<{ cnpj: string; ano: string; sequencial: string }>;
}

/** Instante do pedido; o cliente parte dele para evitar divergência na hidratação. */
function momento(): number {
  return Date.now();
}

export default async function LicitacaoPage({ params }: Props) {
  await connection();
  const { cnpj, ano, sequencial } = await params;
  if (!/^\d{14}$/.test(cnpj) || !/^\d{4}$/.test(ano) || !/^\d{1,9}$/.test(sequencial)) notFound();

  const sessao = await lerSessao();
  const podeEditarPropostas = sessao !== null && temPermissao(sessao, "editar_propostas");
  const podeLerEdital = sessao !== null && temPermissao(sessao, "usar_assistente");
  const podeConfirmarFicha = podeEditarPropostas || (sessao !== null && temPermissao(sessao, "revisao_juridica"));

  const jar = await cookies();
  const frente = lerFrente(jar.get(COOKIE_FRENTE)?.value);

  const [detalhe, salvos] = await Promise.all([
    buscarDetalheCompra({ cnpj, ano: Number(ano), sequencial: Number(sequencial) }),
    idsNoPipeline().catch((): Set<string> => new Set()),
  ]);
  if (detalhe === null) notFound();
  const ficha = await lerFicha(detalhe.numeroControle).catch((): FichaSalva | null => null);

  const agora = momento();
  const base = montarOportunidade(detalhe);
  const score = base ? calcularScore(base, frente, new Date(agora)) : null;
  const oportunidade: OportunidadeComScore | null = base && score ? { ...base, score } : null;
  const sinais = gerarSinais(detalhe, frente, agora);

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-20 lg:pb-0">
      <CabecalhoLicitacao
        titulo={resumirObjeto(detalhe.objeto) || "Contratação sem objeto informado"}
        identificacao={linhaIdentificacao(detalhe)}
        score={score}
        valorEstimado={detalhe.valorEstimado}
        dataEncerramento={detalhe.dataEncerramento}
        agoraInicial={agora}
      />

      <BarraAcoes
        chave={detalhe.chave}
        numeroControle={detalhe.numeroControle}
        linkPncp={detalhe.linkPncp}
        linkOrigem={detalhe.linkOrigem}
        oportunidade={oportunidade}
        salvo={salvos.has(detalhe.numeroControle)}
        podeCriarProposta={podeEditarPropostas}
        podeUsarAssistente={podeEditarPropostas && podeLerEdital}
      />

      <ChipsSecoes />

      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_160px] xl:gap-10">
        <div className="flex min-w-0 flex-col gap-8">
          <DatasEdital datas={detalhe} agoraInicial={agora} />
          <FichaEditalSecao compra={`${cnpj}-${ano}-${sequencial}`} inicial={ficha}
            assistenteAtivo={assistenteDisponivel()}
            podeLer={podeLerEdital}
            podeConfirmar={podeConfirmarFicha}
          />
          <Resumo d={detalhe} />
          <Sinais sinais={sinais} />
          <ItensCompra
            itens={detalhe.itens}
            totalItens={detalhe.totalItens}
            linkPncp={detalhe.linkPncp}
            aviso={detalhe.falhas.includes("itens") ? <AvisoFalha texto="Os itens não carregaram agora." /> : null}
          />
          <ArquivosCompra
            arquivos={detalhe.arquivos}
            aviso={detalhe.falhas.includes("arquivos") ? <AvisoFalha texto="Os arquivos não carregaram agora." /> : null}
          />
          <TextoEdital objeto={detalhe.objeto} informacaoComplementar={detalhe.informacaoComplementar} />
          <NotaCriterios score={score} />
        </div>
        <IndiceSecoes />
      </div>
    </div>
  );
}
