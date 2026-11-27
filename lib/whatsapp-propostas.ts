import "server-only";
import { diaDeSaoPaulo } from "@/core/avisos";
import { resumirObjeto } from "@/core/objeto";
import { ehPapel, normalizarPermissoes, podeAgirNaRevisao, temPermissao, type Permissao } from "@/core/permissoes";
import type { Proposta } from "@/db/propostas";
import type { Sessao } from "@/core/types-equipe";
import {
  chavePropostasDoDia,
  escolherPropostasDoDia,
  payloadDoBotao,
  textoAvisoAoDono,
  textoRascunhoPronto,
  type AcaoAvisoProposta,
  type CustoDaProposta,
  type ItemAlerta,
} from "@/core/whatsapp-alertas";
import { resultadoDaProposta } from "@/core/proposta-custo";
import { lerComissaoDoItemPipeline } from "@/db/fluxo-caixa";
import { estaAprovada } from "@/core/revisao";
import type { ItemPipeline } from "@/components/pipeline/tipos";
import { gerarTokenPublico, lerProposta, listarPropostas, propostaRecenteDoAssistente } from "@/db/propostas";
import { listarPipeline } from "@/db/pipeline";
import { gravarConfig, lerConfig, listarVinculosDaEmpresa, listarVinculosGestoresExtras, type VinculoWa } from "@/db/whatsapp";
import {
  chaveListaPropostas,
  escolherPropostasDaLista,
  lerListaGuardada,
  textoDetalheProposta,
  textoListaPropostas,
} from "@/core/whatsapp-propostas-lista";
import { montarPropostaComAssistente } from "@/lib/assistente/proposta";
import { linkAbsoluto } from "@/lib/email";
import { assistenteDisponivel } from "@/lib/gemini";
import { executarAcaoRevisao } from "@/lib/revisao-proposta";
import { enviarParaPessoa } from "@/lib/whatsapp-envio";
import { mostrarDigitando } from "@/lib/zernio";

/**
 * Proposta pelo WhatsApp: "gerar N" monta o rascunho com o assistente (reaproveita o de até 24 h), aprovar usa a mesma
 * função da tela e o dono recebe o aviso com o link. Nunca registra texto de mensagem nem número.
 */

const REUSO_RASCUNHO_MIN = 24 * 60;
const MAX_OBJETO = 120;

export interface RespostaWa {
  texto: string;
  botoes?: Array<{ titulo: string; payload: string }>;
}

function permitido(v: VinculoWa, permissao: Permissao): boolean {
  return ehPapel(v.papel) && temPermissao({ papel: v.papel, permissoes: normalizarPermissoes(v.permissoes) }, permissao);
}

function sessaoDe(v: VinculoWa): Sessao | null {
  if (!ehPapel(v.papel)) return null;
  return {
    usuarioId: v.usuarioId,
    nome: v.nome,
    papel: v.papel,
    empresaId: v.empresaId,
    empresaPropriaId: v.empresaId,
    superadmin: false,
    permissoes: normalizarPermissoes(v.permissoes),
  };
}

function itemDeAlerta(i: ItemPipeline): ItemAlerta {
  return {
    id: i.id,
    etapa: i.etapa,
    objeto: i.item.objeto,
    dataEncerramento: i.item.dataEncerramento,
    responsavelId: i.responsavelId,
    valor: i.item.valorEstimado,
  };
}

/** Os itens do dia na ordem do resumo: a lista guardada no envio das 7h ou, sem ela, a mesma regra recalculada agora. */
async function itensDoDia(v: VinculoWa, pipeline: ReadonlyArray<ItemPipeline>, agora: Date): Promise<string[]> {
  const dia = diaDeSaoPaulo(agora);
  const guardada = await lerConfig(chavePropostasDoDia(v.usuarioId, dia)).catch((): null => null);
  if (guardada !== null) {
    try {
      const lista: unknown = JSON.parse(guardada);
      if (Array.isArray(lista)) return lista.filter((x): x is string => typeof x === "string");
    } catch {
      // lista guardada ilegível: recalcula
    }
  }
  const propostas = await listarPropostas(v.empresaId);
  const fechadas = new Set(
    propostas.flatMap((p) => (p.compraId !== null && (estaAprovada(p.status) || p.status === "enviada") ? [p.compraId] : [])),
  );
  return escolherPropostasDoDia(pipeline.map(itemDeAlerta), fechadas, agora).map((p) => p.itemId);
}

function objetoDaProposta(p: Proposta): string {
  const texto = resumirObjeto(p.dados.objeto !== "" ? p.dados.objeto : p.titulo);
  return texto.length <= MAX_OBJETO ? texto : `${texto.slice(0, MAX_OBJETO - 1).trimEnd()}…`;
}

/** Quem agiu na proposta: basta identidade e empresa (vem da sessão da tela ou do vínculo do WhatsApp). */
export interface AutorAviso {
  empresaId: string;
  usuarioId: string;
  nome: string;
  papel: string;
}

/**
 * Avisa o outro lado com o link: ação de quem não é dono vai para o dono (com botão Aprovar quando subiu para revisão);
 * ação do dono vai para os gestores (os da empresa e os ligados pelo Admin). Com a janela de 24 h fechada sai como
 * mensagem utilitária. Vale a qualquer hora. Nunca lança.
 */
export async function avisarSobreProposta(autor: AutorAviso, acao: AcaoAvisoProposta, proposta: Proposta, agora: Date): Promise<void> {
  try {
    // Sem trava de horário: o aviso nasce de uma ação da pessoa (subiu, aprovou, enviou) e é esperado na hora.
    const paraDono = autor.papel !== "dono";
    const daEmpresa = await listarVinculosDaEmpresa(autor.empresaId);
    const extras = paraDono ? [] : await listarVinculosGestoresExtras(autor.empresaId).catch(() => []);
    const destinos = [...daEmpresa, ...extras].filter(
      (x) => x.usuarioId !== autor.usuarioId && x.avisoWhatsapp && x.conversaId !== null && (paraDono ? x.papel === "dono" : x.papel === "gestor"),
    );
    if (destinos.length === 0) return;
    const leitura = acao === "subiu" && paraDono ? await linkDeLeitura(autor.empresaId, proposta) : null;
    const custo = paraDono && (acao === "subiu" || acao === "gerou") ? await custoParaAviso(autor.empresaId, proposta) : null;
    const texto = textoAvisoAoDono({
      nome: autor.nome,
      acao,
      objeto: objetoDaProposta(proposta),
      total: proposta.total,
      link: linkAbsoluto(`/propostas/${proposta.id}`),
      leitura,
      custo,
    });
    const botoes =
      acao === "subiu" && paraDono ? [{ titulo: "Aprovar", payload: payloadDoBotao({ tipo: "aprovar", propostaId: proposta.id }) }] : undefined;
    const vistos = new Set<string>();
    for (const d of destinos) {
      if (vistos.has(d.usuarioId)) continue;
      vistos.add(d.usuarioId);
      await enviarParaPessoa(d, texto, agora, { botoes, utilidade: true });
    }
  } catch (e) {
    console.error("[whatsapp] aviso de proposta:", e instanceof Error ? e.name : "erro");
  }
}

/** Prejuízo (com a comissão do item do pipeline, 0 sem marcar) e itens sem custo da proposta; null se não der para calcular ou for externa. */
async function custoParaAviso(empresaId: string, proposta: Proposta): Promise<CustoDaProposta | null> {
  if (proposta.externa) return null;
  try {
    const comissao = await lerComissaoDoItemPipeline(empresaId, proposta.compraId).catch(() => 0);
    const r = resultadoDaProposta(proposta.dados, comissao);
    return { prejuizo: r.prejuizo, itensSemCusto: r.itensSemCusto };
  } catch {
    return null;
  }
}

const DIAS_LINK_LEITURA = 3;

/**
 * Link do documento que abre sem login (/p/<token>), para o dono ler antes de aprovar. Reaproveita o link público
 * ainda válido (o que já foi mandado ao órgão continua valendo); senão cria um de 3 dias, trocado ao gerar o link oficial.
 */
async function linkDeLeitura(empresaId: string, proposta: Proposta): Promise<string | null> {
  if (proposta.externa) return null;
  try {
    const valido = proposta.tokenPublico !== null && proposta.tokenExpira !== null && Date.parse(proposta.tokenExpira) > Date.now();
    const token = valido ? proposta.tokenPublico : (await gerarTokenPublico(empresaId, proposta.id, DIAS_LINK_LEITURA))?.token ?? null;
    return token ? linkAbsoluto(`/p/${token}`) : null;
  } catch {
    return null;
  }
}

/** Para as ações da tela: lê a proposta e avisa. Nunca lança (roda depois da resposta). */
export async function avisarPropostaDaTela(sessao: Sessao, propostaId: string, acao: AcaoAvisoProposta): Promise<void> {
  try {
    const proposta = await lerProposta(sessao.empresaId, propostaId);
    if (proposta === null) return;
    await avisarSobreProposta(
      { empresaId: sessao.empresaId, usuarioId: sessao.usuarioId, nome: sessao.nome, papel: sessao.papel },
      acao,
      proposta,
      new Date(),
    );
  } catch (e) {
    console.error("[whatsapp] aviso de proposta:", e instanceof Error ? e.name : "erro");
  }
}

function autorDoVinculo(v: VinculoWa): AutorAviso {
  return { empresaId: v.empresaId, usuarioId: v.usuarioId, nome: v.nome, papel: v.papel };
}

/** "gerar N" (número da lista do dia) ou botão "Gerar N" (id do item): monta o rascunho e responde com o link para revisar. */
export async function gerarPropostaPeloWhatsapp(
  v: VinculoWa,
  alvo: { numero: number | null } | { itemId: string },
  agora: Date,
): Promise<RespostaWa> {
  if (!permitido(v, "usar_assistente") || !permitido(v, "editar_propostas")) {
    return { texto: "Seu perfil não pode gerar propostas." };
  }
  if (!assistenteDisponivel()) return { texto: "O assistente ainda não está ativado." };
  const sessao = sessaoDe(v);
  if (sessao === null) return { texto: "Seu perfil não pode gerar propostas." };

  const pipeline = await listarPipeline(v.empresaId);
  let itemId: string | undefined;
  if ("itemId" in alvo) {
    itemId = alvo.itemId;
  } else {
    if (alvo.numero === null) return { texto: "Qual proposta? Mande *gerar 1*, *gerar 2*... conforme a lista do resumo." };
    itemId = (await itensDoDia(v, pipeline, agora))[alvo.numero - 1];
    if (itemId === undefined) return { texto: `Não achei a proposta ${alvo.numero} na lista de hoje. Mande *prazos* para ver o que fecha.` };
  }
  const item = pipeline.find((i) => i.id === itemId);
  if (!item) return { texto: "Não encontrei esse item no pipeline." };
  if (new Date(item.item.dataEncerramento).getTime() <= agora.getTime()) return { texto: "Essa licitação já fechou." };

  try {
    await mostrarDigitando(v.conversaId ?? "");
  } catch {
    // o aviso de "digitando" é só cortesia
  }

  let propostaId: string | null = null;
  let reaproveitado = false;
  const recente = await propostaRecenteDoAssistente(v.empresaId, item.id, REUSO_RASCUNHO_MIN).catch((): null => null);
  if (recente !== null) {
    const existente = await lerProposta(v.empresaId, recente);
    if (existente !== null && (existente.status === "em_revisao" || existente.status === "rascunho")) {
      propostaId = recente;
      reaproveitado = true;
    }
  }
  if (propostaId === null) {
    const r = await montarPropostaComAssistente(
      { cnpj: item.item.orgaoCnpj, ano: item.item.anoCompra, sequencial: item.item.sequencialCompra },
      sessao,
    );
    if (!r.ok) return { texto: `⚠️ ${r.erro}` };
    propostaId = r.propostaId;
  }

  const proposta = await lerProposta(v.empresaId, propostaId);
  if (proposta === null) return { texto: "O rascunho foi criado, mas não consegui abri-lo agora. Procure em Propostas no painel." };
  const podeAprovar = proposta.status === "em_revisao" && podeAgirNaRevisao(sessao, "aprovar");
  const texto = textoRascunhoPronto({
    objeto: objetoDaProposta(proposta),
    total: proposta.total,
    itens: proposta.dados.itens.length,
    link: linkAbsoluto(`/propostas/${proposta.id}`),
    reaproveitado,
    podeAprovar,
  });
  if (!reaproveitado) await avisarSobreProposta(autorDoVinculo(v), "gerou", proposta, agora);
  return podeAprovar
    ? { texto, botoes: [{ titulo: "Aprovar", payload: payloadDoBotao({ tipo: "aprovar", propostaId: proposta.id }) }] }
    : { texto };
}

/** Botão "Aprovar": aprova pela mesma função da tela de propostas e avisa o outro lado (dono ou gestores). */
export async function aprovarPropostaPeloWhatsapp(v: VinculoWa, propostaId: string, agora: Date): Promise<RespostaWa> {
  const sessao = sessaoDe(v);
  if (sessao === null || !podeAgirNaRevisao(sessao, "aprovar")) return { texto: "Seu perfil não pode aprovar propostas." };
  const r = await executarAcaoRevisao(sessao, propostaId, "aprovar");
  if (!r.ok) return { texto: `⚠️ ${r.mensagem}` };
  const proposta = await lerProposta(v.empresaId, propostaId);
  if (proposta === null) return { texto: "✅ Proposta aprovada." };
  await avisarSobreProposta(autorDoVinculo(v), "aprovou", proposta, agora);
  return { texto: `✅ Proposta aprovada: ${objetoDaProposta(proposta)}\n${linkAbsoluto(`/propostas/${proposta.id}`)}` };
}

/** "propostas": lista numerada das que pedem ação e guarda a ordem para a pessoa responder o número. */
export async function listarPropostasPeloWhatsapp(v: VinculoWa, agora: Date): Promise<RespostaWa> {
  if (!permitido(v, "editar_propostas") && !permitido(v, "aprovar_propostas")) return { texto: "Seu perfil não vê propostas." };
  const todas = await listarPropostas(v.empresaId);
  const lista = escolherPropostasDaLista(
    todas.map((p) => ({
      id: p.id,
      objeto: resumirObjeto(p.titulo.replace(/^(Nova )?[Pp]roposta · /, "")),
      total: p.total,
      status: p.status,
      atualizadoEm: p.atualizadoEm,
      criadoPorNome: p.criadoPorNome,
      externa: p.externa,
    })),
  );
  await gravarConfig(chaveListaPropostas(v.usuarioId), JSON.stringify({ ids: lista.map((p) => p.id), em: agora.toISOString() }));
  return { texto: textoListaPropostas(lista) };
}

/** Número respondido depois de "propostas": manda o detalhe com o link de leitura e, se couber, o botão Aprovar. */
export async function abrirPropostaPeloWhatsapp(v: VinculoWa, numero: number, agora: Date): Promise<RespostaWa | null> {
  const guardada = lerListaGuardada(await lerConfig(chaveListaPropostas(v.usuarioId)), agora);
  if (guardada === null) return null;
  const id = guardada.ids[numero - 1];
  if (id === undefined) return { texto: `A lista tem ${guardada.ids.length} propostas. Responda um número de 1 a ${guardada.ids.length}.` };
  const proposta = await lerProposta(v.empresaId, id);
  if (proposta === null) return { texto: "Essa proposta não existe mais. Mande *propostas* para ver a lista nova." };
  const sessao = sessaoDe(v);
  const podeAprovar = proposta.status === "em_revisao" && sessao !== null && podeAgirNaRevisao(sessao, "aprovar");
  const texto = textoDetalheProposta({
    objeto: objetoDaProposta(proposta),
    orgao: proposta.dados.orgao,
    total: proposta.total,
    itens: proposta.dados.itens.length,
    status: proposta.status,
    criadoPorNome: proposta.criadoPorNome,
    link: linkAbsoluto(`/propostas/${proposta.id}`),
    leitura: await linkDeLeitura(v.empresaId, proposta),
    podeAprovar,
  });
  return podeAprovar
    ? { texto, botoes: [{ titulo: "Aprovar", payload: payloadDoBotao({ tipo: "aprovar", propostaId: proposta.id }) }] }
    : { texto };
}
