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
import { PrecoSugeridoDetalhe } from "@/components/preco/preco-sugerido-detalhe";
import { SeloVeredito } from "@/components/preco/selo-veredito";
import { Colapsavel } from "@/components/licitacao/colapsavel";
import { FichaEditalSecao } from "@/components/licitacao/ficha-edital";
import { NumerosLicitacao } from "@/components/licitacao/numeros";
import { ItensCompra } from "@/components/licitacao/itens-compra";
import { NotaCriterios } from "@/components/licitacao/nota-criterios";
import { Resumo } from "@/components/licitacao/resumo";
import { Sinais } from "@/components/licitacao/sinais";
import { TextoEdital } from "@/components/licitacao/texto-edital";
import { numeroControleDaChave } from "@/core/pncp/detalhe";
import type { ChaveCompra } from "@/core/types-detalhe";
import { complementoEmCache, detalheGeralEmCache } from "@/lib/detalhe-em-cache";
import { criarFila, type DaFila } from "@/lib/limite-concorrencia";
import type { Sessao } from "@/core/types-equipe";
import type { CotacaoSalva } from "@/db/cotacoes";
import { resumirObjeto } from "@/core/objeto";
import { calcularCapitalGiro } from "@/core/capital-giro";
import { caminhoDoDinheiro, type OportunidadeCaixa } from "@/core/caminho-dinheiro";
import { COMISSAO_AO_MARCAR, comissaoDoItem, contaLucro, type ContaLucro } from "@/core/lucro";
import type { DadosSoftware } from "@/core/campos-software";
import { ehDesenvolvimento } from "@/core/custo-software";
import { montarResultado, type AmostraConcorrente, type ResultadoConcorrentes } from "@/core/concorrentes";
import type { ResumoCotacoes } from "@/core/cotacoes-resumo";
import type { PrecoFornecedor } from "@/core/fornecedores";
import { precoSugeridoDoItem, type PrecoSugerido } from "@/core/preco-sugerido";
import { formatarMoeda } from "@/lib/formato";
import { calcularScore } from "@/core/score";
import type { FichaSalva } from "@/core/ficha";
import { acharSemelhantes } from "@/core/semelhantes";
import type { OportunidadeComScore, RespostaRadar } from "@/core/types";
import { Semelhantes } from "@/components/licitacao/semelhantes";
import { CaminhoDinheiro } from "@/components/licitacao/caminho-dinheiro";
import { SugestoesAcervo } from "@/components/acervo/sugestoes-acervo";
import { obterRadar } from "@/lib/radar-dados";
import { lerAmostrasEmCache, lerBuscaRecente } from "@/db/concorrentes";
import { lerCotacoesDoItem } from "@/db/cotacoes";
import { listarPrecosRecentes } from "@/db/fornecedores";
import { lerComissaoPadrao } from "@/db/empresas";
import { lerFicha } from "@/db/fichas";
import { lerPreferencias } from "@/db/preferencias";
import { lerSoftwareDoItem, situacaoNoPipeline } from "@/db/pipeline";
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
 *
 * Banco: o pool de produção tem poucas conexões por instância, então todas as consultas do pedido passam por
 * uma fila de 2 ao mesmo tempo, na ordem em que são pedidas (o que o topo e os números precisam vem primeiro).
 * O PNCP: o topo e os números só esperam os dados gerais (uma chamada, em cache de dados por alguns minutos);
 * itens e arquivos vêm à parte, para as seções deles.
 */
export const sessaoDoPedido = cache(() => exigirSessao());
const filaDoBanco = cache(() => criarFila(2));
const noBanco: DaFila = (tarefa) => filaDoBanco()(tarefa);
const perfilDoPedido = cache(() => noBanco(() => perfilAtual()));
const frenteDoPedido = cache(async () => lerFrente((await cookies()).get(COOKIE_FRENTE)?.value));
const agoraDoPedido = cache(() => momento());

function chaveDeCompra(cnpj: string, ano: string, sequencial: string): ChaveCompra {
  return { cnpj, ano: Number(ano), sequencial: Number(sequencial) };
}

const detalheDoPedido = cache(async (cnpj: string, ano: string, sequencial: string) => {
  const c = chaveDeCompra(cnpj, ano, sequencial);
  const detalhe = await detalheGeralEmCache(c.cnpj, c.ano, c.sequencial);
  if (detalhe === null) notFound();
  return detalhe;
});

/** Itens e arquivos: só começam depois dos dados gerais (no máximo 2 chamadas ao PNCP ao mesmo tempo, e nenhuma se a compra não existe). */
const complementoDoPedido = cache(async (cnpj: string, ano: string, sequencial: string) => {
  await detalheDoPedido(cnpj, ano, sequencial);
  const c = chaveDeCompra(cnpj, ano, sequencial);
  return complementoEmCache(c.cnpj, c.ano, c.sequencial);
});

/*
 * Leituras do banco que só precisam do número de controle. Ele é calculado da própria URL, então começam
 * junto com a chamada ao PNCP em vez de esperar por ela; se o PNCP trouxer outro número, a leitura se repete com ele.
 */
const preferenciasDoPedido = cache((empresaId: string) => noBanco(() => lerPreferencias(empresaId)));
const fichaDoPedido = cache((numero: string) => noBanco(() => lerFicha(numero).catch((): FichaSalva | null => null)));
const cotacoesDoPedido = cache((empresaId: string, numero: string) =>
  noBanco(() =>
    lerCotacoesDoItem(empresaId, numero).catch((): { ultima: CotacaoSalva | null; resumo: ResumoCotacoes | null } => ({
      ultima: null,
      resumo: null,
    })),
  ),
);
const pipelineDoPedido = cache((empresaId: string, numero: string) =>
  noBanco(() =>
    situacaoNoPipeline(empresaId, numero).catch((): { salvo: boolean; travado: string | null } => ({
      salvo: false,
      travado: null,
    })),
  ),
);
const amostrasDoPedido = cache(() => noBanco(() => lerAmostrasEmCache().catch((): AmostraConcorrente[] => [])));
const buscaDoPedido = cache((numero: string) => noBanco(() => lerBuscaRecente(numero).catch(() => null)));
/** Percentual que aparece ao marcar "Tem comissão" (só o dono usa). */
const comissaoPadraoDoPedido = cache((empresaId: string) =>
  noBanco(() => lerComissaoPadrao(empresaId).catch(() => COMISSAO_AO_MARCAR)),
);
/** Terceirização e comissão do próprio item do pipeline; null se a licitação não está no pipeline. */
const softwareDoPedido = cache((empresaId: string, numero: string) =>
  noBanco(() => lerSoftwareDoItem(empresaId, numero).catch((): DadosSoftware | null => null)),
);

function numeroEsperado({ cnpj, ano, sequencial }: ChaveUrl): string {
  const c = chaveDeCompra(cnpj, ano, sequencial);
  return numeroControleDaChave(c);
}

/** Detalhe do PNCP mais o que depende dele no banco (ficha, cotação, limites) e a nota. */
const dadosDoPedido = cache(async (cnpj: string, ano: string, sequencial: string) => {
  const sessao = await sessaoDoPedido();
  const [detalhe, perfil, frente, preferencias] = await Promise.all([
    detalheDoPedido(cnpj, ano, sequencial),
    perfilDoPedido(),
    frenteDoPedido(),
    preferenciasDoPedido(sessao.empresaId),
  ]);
  const [ficha, cotacoes] = await Promise.all([
    fichaDoPedido(detalhe.numeroControle),
    cotacoesDoPedido(sessao.empresaId, detalhe.numeroControle),
  ]);
  const resumoCotacoes = cotacoes.resumo;
  const limites = { capitalMaximo: preferencias.capitalMaximo, diasMaximosParado: preferencias.diasMaximosParado };
  const cotacao = cotacoes.ultima;
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
  return { sessao, detalhe, perfil, frente, ficha, cotacao, resumoCotacoes, custoCotado, prazos, limites, score, oportunidade, agora };
});

const concorrentesDoPedido = cache(async (cnpj: string, ano: string, sequencial: string) => {
  const detalhe = await detalheDoPedido(cnpj, ano, sequencial);
  const [amostras, busca] = await Promise.all([amostrasDoPedido(), buscaDoPedido(detalhe.numeroControle)]);
  const resultado: ResultadoConcorrentes | null =
    busca !== null ? montarResultado(amostras, detalhe.objeto, detalhe.uf, detalhe.numeroControle, detalhe.valorEstimado) : null;
  return { detalhe, resultado, amostras, buscadoEm: busca?.buscadoEm ?? null };
});

/** Preço sugerido por regras (piso, alvo e teto) a partir das cotações do item e das amostras de concorrentes já gravadas. */
const precoDoPedido = cache(async (cnpj: string, ano: string, sequencial: string): Promise<PrecoSugerido> => {
  const [d, c] = await Promise.all([dadosDoPedido(cnpj, ano, sequencial), concorrentesDoPedido(cnpj, ano, sequencial)]);
  const precosFornecedor =
    d.resumoCotacoes === null
      ? await noBanco(() => listarPrecosRecentes(d.sessao.empresaId).catch((): PrecoFornecedor[] => []))
      : [];
  return precoSugeridoDoItem(
    {
      id: d.detalhe.numeroControle,
      objeto: d.detalhe.objeto,
      uf: d.detalhe.uf,
      valorEstimado: d.detalhe.valorEstimado,
      frente: d.score?.frenteCasada ?? null,
      cnaes: d.score?.cnaesCasados ?? [],
    },
    d.perfil.porte,
    d.resumoCotacoes,
    c.amostras,
    precosFornecedor,
    resumirObjeto(d.detalhe.objeto),
  );
});

/**
 * Dispara a leitura do PNCP e do banco já na página, antes de qualquer seção pedir.
 * A ordem importa (a fila do banco atende na ordem): primeiro o que o topo precisa, depois o que os números precisam.
 */
export function aquecer(chave: ChaveUrl, sessao: Sessao): void {
  const { cnpj, ano, sequencial } = chave;
  const numero = numeroEsperado(chave);
  const empresaId = sessao.empresaId;
  void detalheDoPedido(cnpj, ano, sequencial).catch(() => undefined);
  void perfilDoPedido().catch(() => undefined);
  void preferenciasDoPedido(empresaId).catch(() => undefined);
  void fichaDoPedido(numero);
  void cotacoesDoPedido(empresaId, numero);
  void pipelineDoPedido(empresaId, numero);
  void amostrasDoPedido();
  void buscaDoPedido(numero);
  void softwareDoPedido(empresaId, numero);
  void dadosDoPedido(cnpj, ano, sequencial).catch(() => undefined);
  void concorrentesDoPedido(cnpj, ano, sequencial).catch(() => undefined);
  void complementoDoPedido(cnpj, ano, sequencial).catch(() => undefined);
}

/** Resolve quando o preço (o que os números esperam) já saiu: seções secundárias entram na fila do banco depois dele. */
async function depoisDosNumeros(chave: ChaveUrl): Promise<void> {
  await precoDoPedido(chave.cnpj, chave.ano, chave.sequencial).then(
    () => undefined,
    () => undefined,
  );
}

function chaveCompra(c: ChaveUrl): string {
  return `${c.cnpj}-${c.ano}-${c.sequencial}`;
}

export async function TopoLicitacao({ chave }: { chave: ChaveUrl }) {
  const d = await dadosDoPedido(chave.cnpj, chave.ano, chave.sequencial);
  const noPipeline = await pipelineDoPedido(d.sessao.empresaId, d.detalhe.numeroControle);
  const podeEditarPropostas = temPermissao(d.sessao, "editar_propostas");
  const podeLerEdital = temPermissao(d.sessao, "usar_assistente");
  return (
    <>
      <CabecalhoLicitacao
        titulo={resumirObjeto(d.detalhe.objeto) || "Contratação sem objeto informado"}
        identificacao={linhaIdentificacao(d.detalhe)}
        score={d.score}
        dataEncerramento={d.detalhe.dataEncerramento}
        agoraInicial={d.agora}
      />
      <BarraAcoes
        chave={d.detalhe.chave}
        numeroControle={d.detalhe.numeroControle}
        linkPncp={d.detalhe.linkPncp}
        linkOrigem={d.detalhe.linkOrigem}
        oportunidade={d.oportunidade}
        salvo={noPipeline.salvo}
        travado={noPipeline.travado}
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

/** O que o caixa e o lucro precisam da compra: objeto, valor e, quando há, a frente do score. */
function oportunidadeDoCaixa(d: Awaited<ReturnType<typeof dadosDoPedido>>): OportunidadeCaixa {
  return { objeto: d.detalhe.objeto, valorEstimado: d.detalhe.valorEstimado, ...(d.score ? { score: d.score } : {}) };
}

/**
 * Os números do topo: valor, preço alvo, caixa e prazo para todos; a conta de lucro e a comissão só para o dono.
 * A comissão é a do próprio item do pipeline (sem marcar, ou fora do pipeline, é 0).
 * Receita é o preço alvo ou, sem ele, o valor estimado; o custo é o da cotação salva ou uma estimativa pelo tipo do objeto.
 */
export async function SecaoNumeros({ chave }: { chave: ChaveUrl }) {
  const [d, preco] = await Promise.all([
    dadosDoPedido(chave.cnpj, chave.ano, chave.sequencial),
    precoDoPedido(chave.cnpj, chave.ano, chave.sequencial),
  ]);
  const oportunidade = oportunidadeDoCaixa(d);
  const caminho = caminhoDoDinheiro(d.ficha?.ficha ?? null, oportunidade);
  const receita = preco.sugerido ?? d.detalhe.valorEstimado;
  const ehDono = d.sessao.papel === "dono";
  const doItem = await softwareDoPedido(d.sessao.empresaId, d.detalhe.numeroControle);
  let lucro: ContaLucro | null = null;
  if (ehDono && receita !== null) {
    lucro = contaLucro({ receita, custo: d.custoCotado, comissaoPercentual: comissaoDoItem(doItem?.comissaoPercentual), oportunidade });
  }
  const desenvolvimento = ehDesenvolvimento(d.detalhe.objeto);
  const comissaoPadrao = ehDono && desenvolvimento ? await comissaoPadraoDoPedido(d.sessao.empresaId) : COMISSAO_AO_MARCAR;
  return (
    <NumerosLicitacao
      valorEstimado={d.detalhe.valorEstimado}
      precoAlvo={preco.sugerido}
      caixa={{ valor: caminho.caixaNecessario.valor, nivel: caminho.caixaNecessario.nivel }}
      diasSemReceber={caminho.diasSemReceber}
      lucro={lucro}
      receitaDe={preco.sugerido === null ? "estimado" : "alvo"}
      linkCalculadora={`/calculadora?item=${encodeURIComponent(d.detalhe.numeroControle)}`}
      software={
        desenvolvimento
          ? {
              compra: chaveCompra(chave),
              salvo: doItem !== null,
              ehDono,
              bruto: receita,
              valorReferencia: d.detalhe.valorEstimado,
              comissaoPadrao,
              inicial: doItem ?? { terceirizavel: null, devCusto: null, devParcelas: null, contratoMeses: null, comissaoPercentual: null },
            }
          : null
      }
    />
  );
}

export async function SecaoCaixa({ chave }: { chave: ChaveUrl }) {
  const d = await dadosDoPedido(chave.cnpj, chave.ano, chave.sequencial);
  return <CaminhoDinheiro ficha={d.ficha?.ficha ?? null} oportunidade={oportunidadeDoCaixa(d)} />;
}

/** Preço sugerido por regras (piso, alvo e teto) a partir das cotações do item e das amostras de concorrentes já gravadas. */
export async function SecaoPreco({ chave }: { chave: ChaveUrl }) {
  const preco = await precoDoPedido(chave.cnpj, chave.ano, chave.sequencial);
  return (
    <Colapsavel
      id="preco-sugerido"
      titulo="Preço sugerido"
      aberta
      resumo={preco.sugerido === null ? undefined : formatarMoeda(preco.sugerido)}
      selos={<SeloVeredito veredito={preco.veredito} />}
    >
      <PrecoSugeridoDetalhe preco={preco} />
    </Colapsavel>
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
  const [d, complemento] = await Promise.all([
    dadosDoPedido(chave.cnpj, chave.ano, chave.sequencial),
    complementoDoPedido(chave.cnpj, chave.ano, chave.sequencial),
  ]);
  return <Sinais sinais={gerarSinais({ ...d.detalhe, ...complemento }, d.frente, d.agora, d.perfil)} />;
}

export async function SecaoItens({ chave }: { chave: ChaveUrl }) {
  const [detalhe, complemento] = await Promise.all([
    detalheDoPedido(chave.cnpj, chave.ano, chave.sequencial),
    complementoDoPedido(chave.cnpj, chave.ano, chave.sequencial),
  ]);
  return (
    <ItensCompra
      itens={complemento.itens}
      totalItens={complemento.totalItens}
      linkPncp={detalhe.linkPncp}
      aviso={complemento.falhas.includes("itens") ? <AvisoFalha texto="Os itens não carregaram agora." /> : null}
    />
  );
}

export async function SecaoArquivos({ chave }: { chave: ChaveUrl }) {
  const complemento = await complementoDoPedido(chave.cnpj, chave.ano, chave.sequencial);
  return (
    <ArquivosCompra
      arquivos={complemento.arquivos}
      aviso={complemento.falhas.includes("arquivos") ? <AvisoFalha texto="Os arquivos não carregaram agora." /> : null}
    />
  );
}

export async function SecaoTexto({ chave }: { chave: ChaveUrl }) {
  const detalhe = await detalheDoPedido(chave.cnpj, chave.ano, chave.sequencial);
  return <TextoEdital objeto={detalhe.objeto} informacaoComplementar={detalhe.informacaoComplementar} />;
}

/** Até 5 compras abertas do Radar com objeto parecido; só lê o cache, sem coleta nova. */
export async function SecaoSemelhantes({ chave }: { chave: ChaveUrl }) {
  const d = await dadosDoPedido(chave.cnpj, chave.ano, chave.sequencial);
  await depoisDosNumeros(chave);
  const radar = await noBanco(() => obterRadar(d.score?.frenteCasada ?? d.frente, d.limites, d.perfil)).catch(
    (): RespostaRadar | null => null,
  );
  const achadas = radar
    ? acharSemelhantes({ id: d.detalhe.numeroControle, objeto: d.detalhe.objeto, orgaoCnpj: chave.cnpj }, radar.oportunidades)
    : [];
  return <Semelhantes itens={achadas} />;
}

/** O que do acervo da empresa serve para esta licitação (atestados, notas, contratos, certidões). */
export async function SecaoAcervo({ chave }: { chave: ChaveUrl }) {
  const d = await dadosDoPedido(chave.cnpj, chave.ano, chave.sequencial);
  await depoisDosNumeros(chave);
  return <SugestoesAcervo empresaId={d.sessao.empresaId} objeto={d.detalhe.objeto} />;
}

export async function SecaoNota({ chave }: { chave: ChaveUrl }) {
  const d = await dadosDoPedido(chave.cnpj, chave.ano, chave.sequencial);
  return <NotaCriterios score={d.score} />;
}
