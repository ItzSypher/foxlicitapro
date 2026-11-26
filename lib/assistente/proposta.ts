import "server-only";
import { after } from "next/server";
import { casarCnaes } from "@/core/cnae-keywords";
import type { PerfilEmpresa } from "@/core/perfil";
import { buscarDetalheCompra } from "@/core/pncp/detalhe";
import { montarDadosIniciais, referenciasDoDetalhe, textoChaveCompra, totalProposta, tituloPadrao } from "@/core/proposta";
import { frentePredominante, sugerirModelo } from "@/core/proposta-modelos";
import { aplicarCustosDeReferencia, custosDeReferencia } from "@/core/proposta-custo";
import type { PrecoFornecedor } from "@/core/fornecedores";
import type { ChaveCompra, DadosProposta, DetalheCompra } from "@/core/types-detalhe";
import type { AnaliseAssistente, Sessao } from "@/core/types-equipe";
import { mensagemLimiteAtingido, podeMontar } from "@/core/limite-diario";
import { resumirCotacoesDoItem } from "@/db/cotacoes";
import { listarPrecosRecentes } from "@/db/fornecedores";
import { criarProposta, propostaRecenteDoAssistente } from "@/db/propostas";
import { formatarMoeda } from "@/lib/formato";
import { avisarPropostaEmRevisao } from "@/lib/avisos";
import { ErroAssistente, assistenteDisponivel, gerarJson, nomeDoModelo, type ParteEntrada } from "@/lib/gemini";
import {
  ESQUEMA_JSON_ANALISE,
  aplicarSugestoes,
  esquemaSaidaAnalise,
  type SaidaAnalise,
  type SugestaoItem,
} from "./analise";
import { restantesHoje } from "./cota";
import { baixarPdfPrincipal } from "./edital-pdf";
import { perfilDaEmpresa } from "@/lib/empresa-atual";
import { sistemaProposta, textoPedidoProposta } from "./prompt";

export type ResultadoMontagem = { ok: true; propostaId: string } | { ok: false; erro: string };

/** Proposta do assistente criada há menos que isso para a mesma compra é devolvida em vez de duplicada. */
const JANELA_DUPLICIDADE_MIN = 10;
const MAX_TOKENS_ANALISE = 16_000;

/** Gerações em andamento nesta instância, por compra: cliques repetidos recebem a mesma resposta. */
const emAndamento = new Map<string, Promise<ResultadoMontagem>>();

function frenteProvavel(detalhe: DetalheCompra, perfil: PerfilEmpresa) {
  const casados = casarCnaes(detalhe.objeto, perfil);
  return frentePredominante(detalhe, casados.servicos.length > casados.produtos.length ? "servicos" : "produtos");
}

/** Acrescenta à observação de cada item de onde veio o custo, ou que falta custo (a análise é lida pela equipe). */
function notasDeCusto(sugestoes: SugestaoItem[], dados: DadosProposta): SugestaoItem[] {
  return sugestoes.map((s) => {
    const item = dados.itens.find((i) => i.numero === s.numero);
    if (!item) return s;
    const nota =
      item.fonteCusto !== undefined && item.custoUnitario !== undefined
        ? `Custo unitário de ${formatarMoeda(item.custoUnitario)} preenchido pelo sistema: ${item.fonteCusto}.`
        : "Falta custo: cote com fornecedores.";
    return { ...s, observacao: `${s.observacao.trim()} ${nota}`.trim() };
  });
}

async function executar(chave: ChaveCompra, sessao: Sessao): Promise<ResultadoMontagem> {
  if (!assistenteDisponivel()) return { ok: false, erro: "O assistente ainda não está ativado." };

  let detalhe: DetalheCompra | null;
  try {
    detalhe = await buscarDetalheCompra(chave);
  } catch {
    return { ok: false, erro: "Não foi possível ler os dados da licitação agora. Tente de novo." };
  }
  if (detalhe === null) return { ok: false, erro: "Esta licitação não foi encontrada." };

  const compraId = detalhe.numeroControle;
  const recente = await propostaRecenteDoAssistente(sessao.empresaId, compraId, JANELA_DUPLICIDADE_MIN).catch(() => null);
  if (recente !== null) return { ok: true, propostaId: recente };

  try {
    const cota = await restantesHoje(sessao.usuarioId);
    if (!podeMontar(cota) && !cota.ilimitada) return { ok: false, erro: mensagemLimiteAtingido(cota.limite) };
  } catch {
    return { ok: false, erro: "Não foi possível conferir o limite diário agora. Tente de novo." };
  }

  let perfil: PerfilEmpresa;
  try {
    perfil = await perfilDaEmpresa(sessao.empresaId);
  } catch {
    return { ok: false, erro: "Não foi possível ler o perfil da empresa agora. Tente de novo." };
  }

  const pdf = await baixarPdfPrincipal(detalhe);
  const modeloSugerido = sugerirModelo(detalhe, frenteProvavel(detalhe, perfil));
  const partes: ParteEntrada[] = [];
  if (pdf !== null) partes.push({ tipo: "pdf", base64: pdf });
  partes.push({ tipo: "texto", texto: textoPedidoProposta(detalhe, modeloSugerido, pdf !== null, perfil) });

  let saida: SaidaAnalise;
  try {
    saida = await gerarJson({
      sistema: sistemaProposta(perfil),
      partes,
      esquema: esquemaSaidaAnalise(detalhe.itens.map((i) => i.numero)),
      esquemaJson: ESQUEMA_JSON_ANALISE,
      maxTokens: MAX_TOKENS_ANALISE,
    });
  } catch (e) {
    if (e instanceof ErroAssistente) return { ok: false, erro: e.message };
    console.error("[assistente] falha inesperada na análise:", e instanceof Error ? e.name : "erro");
    return { ok: false, erro: "Não foi possível montar a proposta agora. Tente de novo." };
  }

  const agora = new Date();
  const base = montarDadosIniciais(detalhe, saida.modeloId, agora);
  const aplicado = aplicarSugestoes(base, saida.sugestoesPorItem, referenciasDoDetalhe(detalhe));
  // Custo só de referência do sistema (cotação salva ou preço de fornecedor); sem referência o item fica sem custo.
  const custos = custosDeReferencia(
    aplicado.dados.itens,
    await resumirCotacoesDoItem(sessao.empresaId, compraId).catch((): null => null),
    await listarPrecosRecentes(sessao.empresaId).catch((): PrecoFornecedor[] => []),
  );
  const dadosComCusto = aplicarCustosDeReferencia(aplicado.dados, custos);
  const analise: AnaliseAssistente = {
    ...saida,
    sugestoesPorItem: notasDeCusto(aplicado.sugestoes, dadosComCusto),
    geradoEm: agora.toISOString(),
    modelo: nomeDoModelo(),
  };
  const titulo = tituloPadrao(dadosComCusto);

  try {
    const id = await criarProposta(sessao.empresaId, {
      compraId,
      modelo: saida.modeloId,
      titulo,
      dados: dadosComCusto,
      totalCentavos: totalProposta(dadosComCusto),
      criadoPor: sessao.usuarioId,
      autor: "assistente",
      status: "em_revisao",
      analise,
    });
    after(() => avisarPropostaEmRevisao({ empresaId: sessao.empresaId, id, titulo, autorId: sessao.usuarioId, autorNome: sessao.nome }));
    return { ok: true, propostaId: id };
  } catch {
    return { ok: false, erro: "A análise ficou pronta, mas não foi possível salvar a proposta. Tente de novo." };
  }
}

/**
 * Lê a licitação (e o edital em PDF, se couber), pede a análise ao assistente e cria a proposta
 * já em revisão. Nunca lança: o resultado carrega a mensagem de erro em português.
 */
export function montarPropostaComAssistente(chave: ChaveCompra, sessao: Sessao): Promise<ResultadoMontagem> {
  const id = textoChaveCompra(chave);
  const andamento = emAndamento.get(id);
  if (andamento) return andamento;
  const execucao = executar(chave, sessao).finally(() => {
    emAndamento.delete(id);
  });
  emAndamento.set(id, execucao);
  return execucao;
}
