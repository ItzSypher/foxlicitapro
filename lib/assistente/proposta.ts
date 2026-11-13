import "server-only";
import { after } from "next/server";
import { casarCnaes } from "@/core/cnae-keywords";
import { buscarDetalheCompra } from "@/core/pncp/detalhe";
import { montarDadosIniciais, referenciasDoDetalhe, textoChaveCompra, totalProposta, tituloPadrao } from "@/core/proposta";
import { frentePredominante, sugerirModelo } from "@/core/proposta-modelos";
import type { ChaveCompra, DetalheCompra } from "@/core/types-detalhe";
import type { AnaliseAssistente, Sessao } from "@/core/types-equipe";
import { mensagemLimiteAtingido, podeMontar } from "@/core/limite-diario";
import { criarProposta, propostaRecenteDoAssistente } from "@/db/propostas";
import { avisarPropostaEmRevisao } from "@/lib/avisos";
import { ErroAssistente, assistenteDisponivel, gerarJson, nomeDoModelo, type ParteEntrada } from "@/lib/gemini";
import {
  ESQUEMA_JSON_ANALISE,
  aplicarSugestoes,
  esquemaSaidaAnalise,
  type SaidaAnalise,
} from "./analise";
import { restantesHoje } from "./cota";
import { baixarPdfPrincipal } from "./edital-pdf";
import { SISTEMA_PROPOSTA, textoPedidoProposta } from "./prompt";

export type ResultadoMontagem = { ok: true; propostaId: string } | { ok: false; erro: string };

/** Proposta do assistente criada há menos que isso para a mesma compra é devolvida em vez de duplicada. */
const JANELA_DUPLICIDADE_MIN = 10;
const MAX_TOKENS_ANALISE = 16_000;

/** Gerações em andamento nesta instância, por compra: cliques repetidos recebem a mesma resposta. */
const emAndamento = new Map<string, Promise<ResultadoMontagem>>();

function frenteProvavel(detalhe: DetalheCompra) {
  const casados = casarCnaes(detalhe.objeto);
  return frentePredominante(detalhe, casados.servicos.length > casados.produtos.length ? "servicos" : "produtos");
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
  const recente = await propostaRecenteDoAssistente(compraId, JANELA_DUPLICIDADE_MIN).catch(() => null);
  if (recente !== null) return { ok: true, propostaId: recente };

  try {
    const cota = await restantesHoje(sessao.usuarioId);
    if (!podeMontar(cota) && !cota.ilimitada) return { ok: false, erro: mensagemLimiteAtingido(cota.limite) };
  } catch {
    return { ok: false, erro: "Não foi possível conferir o limite diário agora. Tente de novo." };
  }

  const pdf = await baixarPdfPrincipal(detalhe);
  const modeloSugerido = sugerirModelo(detalhe, frenteProvavel(detalhe));
  const partes: ParteEntrada[] = [];
  if (pdf !== null) partes.push({ tipo: "pdf", base64: pdf });
  partes.push({ tipo: "texto", texto: textoPedidoProposta(detalhe, modeloSugerido, pdf !== null) });

  let saida: SaidaAnalise;
  try {
    saida = await gerarJson({
      sistema: SISTEMA_PROPOSTA,
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
  const analise: AnaliseAssistente = {
    ...saida,
    sugestoesPorItem: aplicado.sugestoes,
    geradoEm: agora.toISOString(),
    modelo: nomeDoModelo(),
  };
  const titulo = tituloPadrao(aplicado.dados);

  try {
    const id = await criarProposta({
      compraId,
      modelo: saida.modeloId,
      titulo,
      dados: aplicado.dados,
      totalCentavos: totalProposta(aplicado.dados),
      criadoPor: sessao.usuarioId,
      autor: "assistente",
      status: "em_revisao",
      analise,
    });
    after(() => avisarPropostaEmRevisao({ id, titulo, autorId: sessao.usuarioId, autorNome: sessao.nome }));
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
