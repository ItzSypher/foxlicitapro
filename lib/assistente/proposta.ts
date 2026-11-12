import "server-only";
import { after } from "next/server";
import { casarCnaes } from "@/core/cnae-keywords";
import { buscarDetalheCompra } from "@/core/pncp/detalhe";
import { montarDadosIniciais, referenciasDoDetalhe, textoChaveCompra, totalProposta, tituloPadrao } from "@/core/proposta";
import { frentePredominante, sugerirModelo } from "@/core/proposta-modelos";
import type { ChaveCompra, DetalheCompra } from "@/core/types-detalhe";
import type { AnaliseAssistente, Sessao } from "@/core/types-equipe";
import { criarProposta, propostaRecenteDoAssistente } from "@/db/propostas";
import { avisarPropostaEmRevisao } from "@/lib/avisos";
import { ErroAssistente, assistenteDisponivel, gerarJson, nomeDoModelo, type ParteEntrada } from "@/lib/gemini";
import {
  ESQUEMA_JSON_ANALISE,
  aplicarSugestoes,
  escolherArquivoPrincipal,
  esquemaSaidaAnalise,
  parecePdf,
  type SaidaAnalise,
} from "./analise";
import { SISTEMA_PROPOSTA, textoPedidoProposta } from "./prompt";

export type ResultadoMontagem = { ok: true; propostaId: string } | { ok: false; erro: string };

/** Proposta do assistente criada há menos que isso para a mesma compra é devolvida em vez de duplicada. */
const JANELA_DUPLICIDADE_MIN = 10;
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const TIMEOUT_DOWNLOAD_MS = 25_000;
const MAX_TOKENS_ANALISE = 16_000;

/** Gerações em andamento nesta instância, por compra: cliques repetidos recebem a mesma resposta. */
const emAndamento = new Map<string, Promise<ResultadoMontagem>>();

/** Lê o corpo até o limite; passou dele, cancela a leitura e devolve null. */
async function lerComLimite(resposta: Response, limite: number): Promise<Uint8Array | null> {
  if (!resposta.body) return null;
  const leitor = resposta.body.getReader();
  const pedacos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.length;
    if (total > limite) {
      await leitor.cancel().catch(() => undefined);
      return null;
    }
    pedacos.push(value);
  }
  const inteiro = new Uint8Array(total);
  let posicao = 0;
  for (const p of pedacos) {
    inteiro.set(p, posicao);
    posicao += p.length;
  }
  return inteiro;
}

/** Baixa o PDF principal em base64; null quando é grande demais, não é PDF ou a baixa falha. */
async function baixarPdfPrincipal(detalhe: DetalheCompra): Promise<string | null> {
  const arquivo = escolherArquivoPrincipal(detalhe.arquivos);
  if (!arquivo || !arquivo.url.startsWith("https://")) return null;
  try {
    const resposta = await fetch(arquivo.url, { signal: AbortSignal.timeout(TIMEOUT_DOWNLOAD_MS), cache: "no-store" });
    if (!resposta.ok) return null;
    const declarado = Number(resposta.headers.get("content-length"));
    if (Number.isFinite(declarado) && declarado > MAX_PDF_BYTES) return null;
    const bytes = await lerComLimite(resposta, MAX_PDF_BYTES);
    if (bytes === null || !parecePdf(bytes)) return null;
    return Buffer.from(bytes).toString("base64");
  } catch {
    return null;
  }
}

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
