import "server-only";
import type { ItemPipeline } from "@/components/pipeline/tipos";
import type { AmostraConcorrente } from "@/core/concorrentes";
import type { FichaSalva } from "@/core/ficha";
import type { Fornecedor, PrecoFornecedor } from "@/core/fornecedores";
import { buscarDetalheCompra } from "@/core/pncp/detalhe";
import { podeMontar } from "@/core/limite-diario";
import type { PerfilEmpresa } from "@/core/perfil";
import type { DetalheCompra } from "@/core/types-detalhe";
import type { Sessao } from "@/core/types-equipe";
import type { DocumentoAcervo } from "@/core/acervo";
import type { DadosSoftware } from "@/core/campos-software";
import { listarAcervo } from "@/db/acervo";
import { listarAtestados } from "@/db/atestados";
import { lerAmostrasEmCache } from "@/db/concorrentes";
import { lerUltimaAnalise, salvarAnalise } from "@/db/conselheiro";
import { lerFicha } from "@/db/fichas";
import { lerComissaoDoItemPipeline } from "@/db/fluxo-caixa";
import { listarFornecedores, listarPrecosRecentes } from "@/db/fornecedores";
import { lerSoftwareDoItem, listarPipeline } from "@/db/pipeline";
import { lerPreferencias } from "@/db/preferencias";
import { perfilDaEmpresa } from "@/lib/empresa-atual";
import { ErroAssistente, assistenteDisponivel, gerarJson, nomeDoModelo } from "@/lib/gemini";
import { analisesRestantesHoje, mensagemLimiteAnalises } from "./cota";
import { montarContexto, type AtestadoParaContexto } from "./contexto";
import { ESQUEMA_JSON_CONSELHEIRO, SaidaConselheiroSchema, type AnaliseSalva, type SaidaConselheiro } from "./esquema";
import { precoDoItemPipeline } from "./preco";
import { MAX_TOKENS_CONSELHEIRO, TEMPERATURA_CONSELHEIRO, sistemaConselheiro, textoPedidoConselheiro } from "./prompt";
import { refinarSaida } from "./refinar";

export type ResultadoAnalise = { ok: true; analise: AnaliseSalva } | { ok: false; erro: string };

export const MENSAGEM_SEM_CHAVE = "Conselheiro indisponível: falta configurar a chave do assistente.";

/** Os itens da compra são um complemento: se o PNCP demorar, a análise segue sem eles. */
const ESPERA_DETALHE_MS = 10_000;

/** Análises em andamento nesta instância, por item: cliques repetidos recebem a mesma resposta. */
const emAndamento = new Map<string, Promise<ResultadoAnalise>>();

async function detalheSePossivel(i: ItemPipeline): Promise<DetalheCompra | null> {
  const busca = buscarDetalheCompra({ cnpj: i.item.orgaoCnpj, ano: i.item.anoCompra, sequencial: i.item.sequencialCompra }).catch(
    (): DetalheCompra | null => null,
  );
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const espera = new Promise<null>((resolver) => {
    relogio = setTimeout(() => resolver(null), ESPERA_DETALHE_MS);
  });
  try {
    return await Promise.race([busca, espera]);
  } finally {
    clearTimeout(relogio);
  }
}

async function executar(itemId: string, sessao: Sessao): Promise<ResultadoAnalise> {
  if (!assistenteDisponivel()) return { ok: false, erro: MENSAGEM_SEM_CHAVE };

  let itens: ItemPipeline[];
  try {
    itens = await listarPipeline(sessao.empresaId);
  } catch {
    return { ok: false, erro: "Não foi possível ler o Pipeline agora. Tente de novo." };
  }
  const doPipeline = itens.find((i) => i.id === itemId);
  if (!doPipeline) return { ok: false, erro: "Este item não está mais no Pipeline." };

  try {
    const cota = await analisesRestantesHoje(sessao.usuarioId);
    if (!podeMontar(cota) && !cota.ilimitada) return { ok: false, erro: mensagemLimiteAnalises(cota.limite) };
  } catch {
    return { ok: false, erro: "Não foi possível conferir o limite diário agora. Tente de novo." };
  }

  let dados: {
    perfil: PerfilEmpresa;
    excecoes: string[];
    fornecedores: Fornecedor[];
    amostras: AmostraConcorrente[];
    precos: PrecoFornecedor[];
  };
  try {
    const [perfil, preferencias, fornecedores, amostras, precos] = await Promise.all([
      perfilDaEmpresa(sessao.empresaId),
      lerPreferencias(sessao.empresaId),
      listarFornecedores(sessao.empresaId).catch((): Fornecedor[] => []),
      lerAmostrasEmCache().catch((): AmostraConcorrente[] => []),
      listarPrecosRecentes(sessao.empresaId).catch((): PrecoFornecedor[] => []),
    ]);
    dados = { perfil, excecoes: preferencias.excecoesPregao, fornecedores, amostras, precos };
  } catch {
    return { ok: false, erro: "Não foi possível ler o perfil da empresa agora. Tente de novo." };
  }

  // Complementos: se algum falhar, o bloco correspondente some em vez de derrubar a análise.
  const [ficha, detalhe, software, acervo, atestados] = await Promise.all([
    lerFicha(doPipeline.item.id).catch((): FichaSalva | null => null),
    detalheSePossivel(doPipeline),
    lerSoftwareDoItem(sessao.empresaId, doPipeline.id).catch((): DadosSoftware | null => null),
    listarAcervo(sessao.empresaId).catch((): DocumentoAcervo[] | null => null),
    listarAtestados(sessao.empresaId).catch((): AtestadoParaContexto[] | null => null),
  ]);

  const preco = precoDoItemPipeline(doPipeline, dados.perfil.porte, dados.amostras, dados.precos);
  const contexto = montarContexto({
    item: doPipeline.item,
    perfil: dados.perfil,
    preco,
    cotacoes: doPipeline.cotacoes,
    ficha: ficha?.ficha ?? null,
    itensCompra: detalhe?.itens ?? null,
    totalItensCompra: detalhe?.totalItens ?? 0,
    fornecedores: dados.fornecedores,
    excecoesPregao: dados.excecoes,
    comissaoPercentual: await lerComissaoDoItemPipeline(sessao.empresaId, doPipeline.id).catch(() => 0),
    software,
    acervo,
    atestados,
  });

  let bruta: SaidaConselheiro;
  try {
    bruta = await gerarJson({
      sistema: sistemaConselheiro(dados.perfil),
      partes: [{ tipo: "texto", texto: textoPedidoConselheiro(contexto) }],
      esquema: SaidaConselheiroSchema,
      esquemaJson: ESQUEMA_JSON_CONSELHEIRO,
      maxTokens: MAX_TOKENS_CONSELHEIRO,
      temperatura: TEMPERATURA_CONSELHEIRO,
    });
  } catch (e) {
    if (e instanceof ErroAssistente) return { ok: false, erro: e.message };
    console.error("[conselheiro] falha inesperada na análise:", e instanceof Error ? e.name : "erro");
    return { ok: false, erro: "Não foi possível consultar o conselheiro agora. Tente de novo." };
  }

  const resultado = refinarSaida(bruta, contexto);
  const modelo = nomeDoModelo();
  try {
    await salvarAnalise(sessao.empresaId, { itemId: doPipeline.id, criadoPor: sessao.usuarioId, modelo, resultado });
  } catch (e) {
    console.error("[conselheiro] não salvou a análise:", e instanceof Error ? e.name : "erro");
    return { ok: false, erro: "A análise ficou pronta, mas não foi possível salvar. Tente de novo." };
  }
  const salva = await lerUltimaAnalise(sessao.empresaId, doPipeline.id).catch((): AnaliseSalva | null => null);
  return {
    ok: true,
    analise: salva ?? {
      id: "",
      itemId: doPipeline.id,
      criadoEm: new Date().toISOString(),
      criadoPorNome: sessao.nome,
      modelo,
      resultado,
    },
  };
}

/**
 * Pede a análise do item do Pipeline ao assistente e a grava. Confere chave, limite diário e se o item existe.
 * Nunca lança: o resultado carrega a mensagem de erro em português.
 */
export function analisarItemDoPipeline(itemId: string, sessao: Sessao): Promise<ResultadoAnalise> {
  const id = `${sessao.empresaId}:${itemId}`;
  const andamento = emAndamento.get(id);
  if (andamento) return andamento;
  const execucao = executar(itemId, sessao).finally(() => {
    emAndamento.delete(id);
  });
  emAndamento.set(id, execucao);
  return execucao;
}
