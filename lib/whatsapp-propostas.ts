import "server-only";
import { diaDeSaoPaulo } from "@/core/avisos";
import { resumirObjeto } from "@/core/objeto";
import { ehPapel, normalizarPermissoes, podeAgirNaRevisao, temPermissao, type Permissao } from "@/core/permissoes";
import type { Proposta } from "@/db/propostas";
import type { Sessao } from "@/core/types-equipe";
import {
  chavePropostasDoDia,
  dentroDoHorario,
  escolherPropostasDoDia,
  payloadDoBotao,
  textoAvisoAoDono,
  textoRascunhoPronto,
  type ItemAlerta,
} from "@/core/whatsapp-alertas";
import { estaAprovada } from "@/core/revisao";
import type { ItemPipeline } from "@/components/pipeline/tipos";
import { lerProposta, listarPropostas, propostaRecenteDoAssistente } from "@/db/propostas";
import { listarPipeline } from "@/db/pipeline";
import { lerConfig, listarVinculosDaEmpresa, type VinculoWa } from "@/db/whatsapp";
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

/** Avisa o dono com o link se ele tem WhatsApp e a janela aberta; senão o movimento aparece no resumo dele. Nunca lança. */
async function avisarDono(v: VinculoWa, acao: "gerou" | "aprovou", proposta: Proposta, agora: Date): Promise<void> {
  try {
    if (!dentroDoHorario(agora)) return;
    const vinculos = await listarVinculosDaEmpresa(v.empresaId);
    const dono = vinculos.find((x) => x.papel === "dono" && x.usuarioId !== v.usuarioId && x.avisoWhatsapp && x.conversaId !== null);
    if (!dono) return;
    const texto = textoAvisoAoDono({
      nome: v.nome,
      acao,
      objeto: objetoDaProposta(proposta),
      total: proposta.total,
      link: linkAbsoluto(`/propostas/${proposta.id}`),
    });
    await enviarParaPessoa(dono, texto, agora);
  } catch (e) {
    console.error("[whatsapp] aviso ao dono:", e instanceof Error ? e.name : "erro");
  }
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
  if (!reaproveitado) await avisarDono(v, "gerou", proposta, agora);
  return podeAprovar
    ? { texto, botoes: [{ titulo: "Aprovar", payload: payloadDoBotao({ tipo: "aprovar", propostaId: proposta.id }) }] }
    : { texto };
}

/** Botão "Aprovar": aprova pela mesma função da tela de propostas e avisa o dono. */
export async function aprovarPropostaPeloWhatsapp(v: VinculoWa, propostaId: string, agora: Date): Promise<RespostaWa> {
  const sessao = sessaoDe(v);
  if (sessao === null || !podeAgirNaRevisao(sessao, "aprovar")) return { texto: "Seu perfil não pode aprovar propostas." };
  const r = await executarAcaoRevisao(sessao, propostaId, "aprovar");
  if (!r.ok) return { texto: `⚠️ ${r.mensagem}` };
  const proposta = await lerProposta(v.empresaId, propostaId);
  if (proposta === null) return { texto: "✅ Proposta aprovada." };
  await avisarDono(v, "aprovou", proposta, agora);
  return { texto: `✅ Proposta aprovada: ${objetoDaProposta(proposta)}\n${linkAbsoluto(`/propostas/${proposta.id}`)}` };
}
