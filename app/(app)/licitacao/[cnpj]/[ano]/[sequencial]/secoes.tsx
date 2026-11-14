import { cache } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AvisoFalha } from "@/components/licitacao/aviso-falha";
import { ArquivosCompra } from "@/components/licitacao/arquivos-compra";
import { BarraAcoes } from "@/components/licitacao/barra-acoes";
import { CabecalhoLicitacao } from "@/components/licitacao/cabecalho";
import { gerarSinais, linhaIdentificacao, montarOportunidade } from "@/components/licitacao/dominio";
import { DatasEdital } from "@/components/licitacao/datas-edital";
import { Concorrentes } from "@/components/licitacao/concorrentes";
import { FichaEditalSecao } from "@/components/licitacao/ficha-edital";
import { PagamentoCaixa } from "@/components/licitacao/pagamento-caixa";
import { ItensCompra } from "@/components/licitacao/itens-compra";
import { NotaCriterios } from "@/components/licitacao/nota-criterios";
import { Resumo } from "@/components/licitacao/resumo";
import { Sinais } from "@/components/licitacao/sinais";
import { TextoEdital } from "@/components/licitacao/texto-edital";
import { Skeleton } from "@/components/ui/skeleton";
import { buscarDetalheCompra } from "@/core/pncp/detalhe";
import { resumirObjeto } from "@/core/objeto";
import { calcularCapitalGiro } from "@/core/capital-giro";
import { montarResultado, type ResultadoConcorrentes } from "@/core/concorrentes";
import { calcularScore } from "@/core/score";
import type { FichaSalva } from "@/core/ficha";
import type { OportunidadeComScore } from "@/core/types";
import { lerAmostrasEmCache, lerBuscaRecente } from "@/db/concorrentes";
import { listarCotacoes } from "@/db/cotacoes";
import { lerFicha } from "@/db/fichas";
import { lerPreferencias } from "@/db/preferencias";
import { idsNoPipeline } from "@/db/pipeline";
import { COOKIE_FRENTE, lerFrente } from "@/lib/frente";
import { assistenteDisponivel } from "@/lib/gemini";
import { temPermissao } from "@/core/permissoes";
import { exigirSessao } from "@/lib/sessao";
import { perfilAtual } from "@/lib/empresa-atual";

/** Chave da compra na URL; cada seção recebe só isso e busca o que precisa. */
export interface ChaveUrl {
  cnpj: string;
  ano: string;
  sequencial: string;
}

/** Instante do pedido; o cliente parte dele para evitar divergência na hidratação. */
function momento(): number {
  return Date.now();
}

/*
 * Cada carregador abaixo é memorizado por pedido (`cache` do React): as seções rodam em paralelo,
 * pedem a mesma coisa e o PNCP e o banco só são consultados uma vez.
 */
export const sessaoDoPedido = cache(() => exigirSessao());
const perfilDoPedido = cache(() => perfilAtual());
const frenteDoPedido = cache(async () => lerFrente((await cookies()).get(COOKIE_FRENTE)?.value));
const agoraDoPedido = cache(() => momento());

const detalheDoPedido = cache(async (cnpj: string, ano: string, sequencial: string) => {
  const detalhe = await buscarDetalheCompra({ cnpj, ano: Number(ano), sequencial: Number(sequencial) });
  if (detalhe === null) notFound();
  return detalhe;
});

const salvosDoPedido = cache(async (empresaId: string) =>
  idsNoPipeline(empresaId).catch((): Set<string> => new Set()),
);

/** Detalhe do PNCP mais o que depende dele no banco (ficha, cotação, limites) e a nota. */
const dadosDoPedido = cache(async (cnpj: string, ano: string, sequencial: string) => {
  const sessao = await sessaoDoPedido();
  const [detalhe, perfil, frente] = await Promise.all([
    detalheDoPedido(cnpj, ano, sequencial),
    perfilDoPedido(),
    frenteDoPedido(),
  ]);
  const [ficha, cotacoes, preferencias] = await Promise.all([
    lerFicha(detalhe.numeroControle).catch((): FichaSalva | null => null),
    listarCotacoes(sessao.empresaId, detalhe.numeroControle, 1).catch(() => []),
    lerPreferencias(sessao.empresaId),
  ]);
  const limites = { capitalMaximo: preferencias.capitalMaximo, diasMaximosParado: preferencias.diasMaximosParado };
  const cotacao = cotacoes[0] ?? null;
  const custoCotado = cotacao ? cotacao.entrada.custo + cotacao.entrada.frete + cotacao.entrada.extras : null;
  const prazos = ficha
    ? {
        prazoEntregaDias: ficha.ficha.prazoEntregaDias.valor,
        prazoPagamentoDias: ficha.ficha.prazoPagamentoDias.valor,
        medicaoMensal: ficha.ficha.medicaoMensal.valor,
        pagamentoAntecipado: ficha.ficha.pagamentoAntecipado.valor,
      }
    : null;
  const giro = prazos ? calcularCapitalGiro(prazos) : null;
  const agora = agoraDoPedido();
  const base = montarOportunidade(detalhe);
  const score = base
    ? calcularScore(
        base,
        frente,
        new Date(agora),
        {
          limites,
          custoTotal: custoCotado,
          diasParado: giro?.dias ?? null,
          pagamentoAntecipado: prazos?.pagamentoAntecipado ?? null,
        },
        perfil,
      )
    : null;
  const oportunidade: OportunidadeComScore | null = base && score ? { ...base, score } : null;
  return { sessao, detalhe, perfil, frente, ficha, cotacao, custoCotado, prazos, limites, score, oportunidade, agora };
});

const concorrentesDoPedido = cache(async (cnpj: string, ano: string, sequencial: string) => {
  const detalhe = await detalheDoPedido(cnpj, ano, sequencial);
  const [amostras, busca] = await Promise.all([
    lerAmostrasEmCache().catch(() => []),
    lerBuscaRecente(detalhe.numeroControle).catch(() => null),
  ]);
  const resultado: ResultadoConcorrentes | null =
    busca !== null ? montarResultado(amostras, detalhe.objeto, detalhe.uf, detalhe.numeroControle, detalhe.valorEstimado) : null;
  return { detalhe, resultado, buscadoEm: busca?.buscadoEm ?? null };
});

/** Dispara a leitura do PNCP e do banco já na página, antes de qualquer seção pedir. */
export function aquecer({ cnpj, ano, sequencial }: ChaveUrl): void {
  void dadosDoPedido(cnpj, ano, sequencial).catch(() => undefined);
  void concorrentesDoPedido(cnpj, ano, sequencial).catch(() => undefined);
}

function chaveCompra(c: ChaveUrl): string {
  return `${c.cnpj}-${c.ano}-${c.sequencial}`;
}

export async function TopoLicitacao({ chave }: { chave: ChaveUrl }) {
  const d = await dadosDoPedido(chave.cnpj, chave.ano, chave.sequencial);
  const salvos = await salvosDoPedido(d.sessao.empresaId);
  const podeEditarPropostas = temPermissao(d.sessao, "editar_propostas");
  const podeLerEdital = temPermissao(d.sessao, "usar_assistente");
  return (
    <>
      <CabecalhoLicitacao
        titulo={resumirObjeto(d.detalhe.objeto) || "Contratação sem objeto informado"}
        identificacao={linhaIdentificacao(d.detalhe)}
        score={d.score}
        valorEstimado={d.detalhe.valorEstimado}
        dataEncerramento={d.detalhe.dataEncerramento}
        agoraInicial={d.agora}
      />
      <BarraAcoes
        chave={d.detalhe.chave}
        numeroControle={d.detalhe.numeroControle}
        linkPncp={d.detalhe.linkPncp}
        linkOrigem={d.detalhe.linkOrigem}
        oportunidade={d.oportunidade}
        salvo={salvos.has(d.detalhe.numeroControle)}
        podeCriarProposta={podeEditarPropostas}
        podeUsarAssistente={podeEditarPropostas && podeLerEdital}
      />
    </>
  );
}

export async function SecaoDatas({ chave }: { chave: ChaveUrl }) {
  const detalhe = await detalheDoPedido(chave.cnpj, chave.ano, chave.sequencial);
  return <DatasEdital datas={detalhe} agoraInicial={agoraDoPedido()} />;
}

export async function SecaoFicha({ chave }: { chave: ChaveUrl }) {
  const d = await dadosDoPedido(chave.cnpj, chave.ano, chave.sequencial);
  const podeEditarPropostas = temPermissao(d.sessao, "editar_propostas");
  return (
    <FichaEditalSecao
      compra={chaveCompra(chave)}
      inicial={d.ficha}
      assistenteAtivo={assistenteDisponivel()}
      podeLer={temPermissao(d.sessao, "usar_assistente")}
      podeConfirmar={podeEditarPropostas || temPermissao(d.sessao, "revisao_juridica")}
    />
  );
}

export async function SecaoCaixa({ chave }: { chave: ChaveUrl }) {
  const d = await dadosDoPedido(chave.cnpj, chave.ano, chave.sequencial);
  return (
    <PagamentoCaixa
      numeroControle={d.detalhe.numeroControle}
      custoCotado={d.custoCotado}
      origemCusto={
        d.cotacao
          ? `cotação salva em ${new Date(d.cotacao.criadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
          : null
      }
      prazos={d.prazos}
      valorEstimado={d.detalhe.valorEstimado}
      limites={d.limites}
      agoraInicial={d.agora}
    />
  );
}

export async function SecaoConcorrentes({ chave }: { chave: ChaveUrl }) {
  const [c, sessao] = await Promise.all([
    concorrentesDoPedido(chave.cnpj, chave.ano, chave.sequencial),
    sessaoDoPedido(),
  ]);
  return (
    <Concorrentes
      compra={chaveCompra(chave)}
      inicial={c.resultado}
      buscadoEmInicial={c.buscadoEm}
      valorEstimado={c.detalhe.valorEstimado}
      podeBuscar={temPermissao(sessao, "editar_propostas")}
    />
  );
}

export async function SecaoResumo({ chave }: { chave: ChaveUrl }) {
  const detalhe = await detalheDoPedido(chave.cnpj, chave.ano, chave.sequencial);
  return <Resumo d={detalhe} />;
}

export async function SecaoSinais({ chave }: { chave: ChaveUrl }) {
  const d = await dadosDoPedido(chave.cnpj, chave.ano, chave.sequencial);
  return <Sinais sinais={gerarSinais(d.detalhe, d.frente, d.agora, d.perfil)} />;
}

export async function SecaoItens({ chave }: { chave: ChaveUrl }) {
  const detalhe = await detalheDoPedido(chave.cnpj, chave.ano, chave.sequencial);
  return (
    <ItensCompra
      itens={detalhe.itens}
      totalItens={detalhe.totalItens}
      linkPncp={detalhe.linkPncp}
      aviso={detalhe.falhas.includes("itens") ? <AvisoFalha texto="Os itens não carregaram agora." /> : null}
    />
  );
}

export async function SecaoArquivos({ chave }: { chave: ChaveUrl }) {
  const detalhe = await detalheDoPedido(chave.cnpj, chave.ano, chave.sequencial);
  return (
    <ArquivosCompra
      arquivos={detalhe.arquivos}
      aviso={detalhe.falhas.includes("arquivos") ? <AvisoFalha texto="Os arquivos não carregaram agora." /> : null}
    />
  );
}

export async function SecaoTexto({ chave }: { chave: ChaveUrl }) {
  const detalhe = await detalheDoPedido(chave.cnpj, chave.ano, chave.sequencial);
  return <TextoEdital objeto={detalhe.objeto} informacaoComplementar={detalhe.informacaoComplementar} />;
}

export async function SecaoNota({ chave }: { chave: ChaveUrl }) {
  const d = await dadosDoPedido(chave.cnpj, chave.ano, chave.sequencial);
  return <NotaCriterios score={d.score} />;
}

/* ---------- esqueletos: mesma forma da seção que vai ocupar o lugar ---------- */

export function EsqueletoTopo() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <Skeleton className="h-11 w-20" />
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-6 w-full max-w-xl" />
        <Skeleton className="h-6 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <div className="grid gap-4 rounded-card border border-border bg-surface p-4 md:grid-cols-3 md:gap-0 md:p-0">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 md:p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-32" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-11 w-40" />
        <Skeleton className="h-11 w-36" />
      </div>
    </div>
  );
}

export function EsqueletoSecao({ id, titulo, linhas = 3 }: { id: string; titulo: string; linhas?: number }) {
  return (
    <section id={id} aria-label={`${titulo} (carregando)`} aria-busy="true" className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-ink">{titulo}</h2>
      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
        {Array.from({ length: linhas }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </section>
  );
}
