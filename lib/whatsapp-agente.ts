import "server-only";
import { textoRestante } from "@/core/avisos";
import { resumirObjeto } from "@/core/objeto";
import { ehPapel, normalizarPermissoes, temPermissao, type Permissao } from "@/core/permissoes";
import {
  lerComando,
  lerPayload,
  type AcaoBotao,
  type MensagemRecebida,
} from "@/core/whatsapp-alertas";
import { ETAPAS_ATIVAS, ROTULO_ETAPA, type ItemPipeline } from "@/components/pipeline/tipos";
import { ErroRevisaoJuridica, definirResponsavel, listarPipeline, moverItem } from "@/db/pipeline";
import {
  apagarPendencia,
  ativarPorCodigo,
  definirAvisoWhatsapp,
  gravarPendencia,
  lerPendencia,
  lerResponsavelPadrao,
  lerVinculoPorNumero,
  registrarEntrada,
  type VinculoWa,
} from "@/db/whatsapp";
import { lerLinksPncp } from "@/core/link-pncp";
import { adicionarChave } from "@/lib/adicionar-pelo-link";
import { montarSistemaDoChat } from "@/lib/assistente/contexto";
import { linkAbsoluto } from "@/lib/email";
import { registrarMensagem } from "@/lib/assistente/limite";
import { interpretarRota } from "@/lib/assistente/rota";
import { lerFrente } from "@/lib/frente";
import { assistenteDisponivel, gerarTexto } from "@/lib/gemini";
import { enviarAndamentoCompleto, enviarResumoAtrasado, enviarResumoCompleto } from "@/lib/whatsapp-alertas-cron";
import { enviarFila, enviarParaPessoa } from "@/lib/whatsapp-envio";
import {
  abrirPropostaPeloWhatsapp,
  aprovarPropostaPeloWhatsapp,
  gerarPropostaPeloWhatsapp,
  listarPropostasPeloWhatsapp,
} from "@/lib/whatsapp-propostas";
import { enviarTexto, mostrarDigitando } from "@/lib/zernio";

/**
 * Conversa de WhatsApp com a equipe: comandos, botões dos alertas e texto livre para o assistente.
 * Nunca lança e nunca registra texto de mensagem nem número: o log leva só um código curto.
 */

const NUMERO_PADRAO = "5521969418669";
const VALIDADE_PENDENCIA_MS = 10 * 60_000;
const DIA_MS = 24 * 3_600_000;
const MAX_OBJETO = 80;
const MAX_LINHAS_PRAZOS = 8;
const MAX_PROXIMOS = 3;
const MAX_LINKS_WHATSAPP = 5;
const BOTOES_CONFIRMA = [
  { titulo: "Sim", payload: "sim" },
  { titulo: "Não", payload: "nao" },
];

const COMANDOS_LOCAIS = "Comandos: *pipeline*, *prazos*, *resumo*, *andamento*, *analisar <link>*, *gerar N*.";
const AVISO_OCUPADO = "O assistente está ocupado; tente a pergunta de novo em alguns minutos.";

const INSTRUCAO_WHATSAPP =
  "Você responde pelo WhatsApp. No máximo 4 linhas curtas, sem tabelas nem títulos. " +
  "Nunca diga que alterou o pipeline. Se a pessoa pedir para participar, atribuir ao responsável padrão ou descartar um item, " +
  "identifique o item pelo id do contexto e termine com uma linha exatamente `ACAO: part <id>` (ou atr/desc).";

const LINHA_ACAO = /^[ \t`]*ACAO:[^\n]*$/gim;
const ACAO_VALIDA = /^[ \t`]*ACAO:[ \t]*(part|atr|desc)[ \t]+([^\s`]+)[ \t`]*$/im;

function numeroDaConta(): string {
  const valor = process.env.ZERNIO_WHATSAPP_NUMERO?.replace(/\D/g, "");
  return valor ? valor : NUMERO_PADRAO;
}

function objetoCurto(item: ItemPipeline): string {
  const texto = resumirObjeto(item.item.objeto);
  return texto.length <= MAX_OBJETO ? texto : `${texto.slice(0, MAX_OBJETO - 1).trimEnd()}…`;
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? "";
}

function permitido(v: VinculoWa, permissao: Permissao): boolean {
  if (!ehPapel(v.papel)) return false;
  return temPermissao({ papel: v.papel, permissoes: normalizarPermissoes(v.permissoes) }, permissao);
}

function emJogo(itens: ReadonlyArray<ItemPipeline>): ItemPipeline[] {
  return itens.filter((i) => ETAPAS_ATIVAS.includes(i.etapa));
}

function comPrazo(itens: ReadonlyArray<ItemPipeline>, agora: Date): Array<{ item: ItemPipeline; restanteMs: number }> {
  return emJogo(itens)
    .map((item) => ({ item, restanteMs: new Date(item.item.dataEncerramento).getTime() - agora.getTime() }))
    .filter((x) => Number.isFinite(x.restanteMs) && x.restanteMs > 0)
    .sort((a, b) => a.restanteMs - b.restanteMs);
}

function textoPipeline(itens: ReadonlyArray<ItemPipeline>, agora: Date): string {
  const vivos = emJogo(itens);
  if (vivos.length === 0) return "Seu pipeline está vazio.";
  const linhas = ["*Pipeline*"];
  for (const etapa of ETAPAS_ATIVAS) {
    const total = vivos.filter((i) => i.etapa === etapa).length;
    if (total > 0) linhas.push(`• ${ROTULO_ETAPA[etapa]}: ${total}`);
  }
  const proximos = comPrazo(vivos, agora).slice(0, MAX_PROXIMOS);
  if (proximos.length > 0) {
    linhas.push("", "*Fecham primeiro*");
    for (const p of proximos) linhas.push(`• ${objetoCurto(p.item)} — em ${textoRestante(p.restanteMs)}`);
  }
  return linhas.join("\n");
}

function textoPrazos(itens: ReadonlyArray<ItemPipeline>, agora: Date): string {
  const proximos = comPrazo(itens, agora).filter((p) => p.restanteMs <= 7 * DIA_MS);
  if (proximos.length === 0) return "Nenhum prazo nos próximos 7 dias.";
  const linhas = proximos.slice(0, MAX_LINHAS_PRAZOS).map((p) => `• ${objetoCurto(p.item)} — em ${textoRestante(p.restanteMs)}`);
  const resto = proximos.length - linhas.length;
  return [`*Prazos dos próximos 7 dias*`, ...linhas, ...(resto > 0 ? [`+${resto}`] : [])].join("\n");
}

/** Resposta que não depende do modelo: os prazos do Pipeline e os comandos (com o aviso de assistente ocupado, se for o caso). */
async function respostaLocal(v: VinculoWa, agora: Date, assistenteOcupado: boolean): Promise<string> {
  try {
    const prazos = textoPrazos(await listarPipeline(v.empresaId), agora);
    return [prazos, COMANDOS_LOCAIS, ...(assistenteOcupado ? [AVISO_OCUPADO] : [])].join("\n\n");
  } catch {
    return assistenteOcupado ? `${COMANDOS_LOCAIS}\n\n${AVISO_OCUPADO}` : COMANDOS_LOCAIS;
  }
}

/** Executa participar, atribuir ou descartar. Devolve o texto da resposta. */
async function executarAcao(v: VinculoWa, acao: AcaoBotao): Promise<string> {
  if (acao.tipo !== "participar" && acao.tipo !== "atribuir" && acao.tipo !== "descartar") {
    return "Não entendi essa ação.";
  }
  if (!permitido(v, "mover_pipeline")) return "Seu perfil não pode mexer no pipeline.";
  const itens = await listarPipeline(v.empresaId);
  const item = itens.find((i) => i.id === acao.itemId);
  if (!item) return "Não encontrei esse item no pipeline.";
  const objeto = objetoCurto(item);
  try {
    if (acao.tipo === "participar") {
      if (item.etapa !== "radar") return `Esse item já está em ${ROTULO_ETAPA[item.etapa]}.`;
      await moverItem(v.empresaId, item.id, "analisando", undefined, v.usuarioId);
      return `✅ Feito: ${objeto} agora está em ${ROTULO_ETAPA.analisando}.`;
    }
    if (acao.tipo === "atribuir") {
      // Vai para o responsável padrão da empresa (tela Equipe); sem ele, para quem tocou o botão.
      const padrao = await lerResponsavelPadrao(v.empresaId);
      const alvo = padrao?.id ?? v.usuarioId;
      const r = await definirResponsavel(v.empresaId, item.id, alvo);
      if (!r.existe) return "Não encontrei esse item no pipeline.";
      if (alvo === v.usuarioId || padrao === null) return `✅ Feito: ${objeto} agora é seu.`;
      return `✅ Feito: ${objeto} agora está com ${primeiroNome(padrao.nome)}.`;
    }
    await moverItem(v.empresaId, item.id, "perdida", undefined, v.usuarioId);
    return `✅ Feito: ${objeto} foi descartado.`;
  } catch (e) {
    if (e instanceof ErroRevisaoJuridica) return e.message;
    throw e;
  }
}

const COMO_ANALISAR =
  "Para pôr uma licitação no Pipeline, mande *analisar* e o link dela no PNCP.\n" +
  "Pode mandar vários, um por linha. Exemplo:\n" +
  "analisar https://pncp.gov.br/app/editais/00000000000000/2025/123";

/**
 * "analisar <link>": põe cada licitação no Pipeline da empresa da pessoa e responde com título, etapa e o link do sistema.
 * A empresa é a do cadastro: a escolha de empresa do painel fica num cookie do navegador e não chega ao WhatsApp.
 */
async function analisarLinks(v: VinculoWa, texto: string): Promise<string> {
  if (!permitido(v, "mover_pipeline")) return "Seu perfil não pode mexer no pipeline.";
  const chaves = lerLinksPncp(texto);
  if (chaves.length === 0) return `Não reconheci nenhum link do PNCP.\n${COMO_ANALISAR}`;
  try {
    await mostrarDigitando(v.conversaId ?? "");
  } catch {
    // o aviso de "digitando" é só cortesia
  }
  const blocos: string[] = [];
  for (const chave of chaves.slice(0, MAX_LINKS_WHATSAPP)) {
    const r = await adicionarChave(v.empresaId, v.usuarioId, chave);
    if (!r.ok) {
      blocos.push(`⚠️ ${chave.cnpj}/${chave.ano}/${chave.sequencial}\n${r.erro}`);
      continue;
    }
    const abertura = r.jaEstava ? "ℹ️ Já estava no Pipeline" : "✅ Adicionada ao Pipeline";
    blocos.push(`${abertura}\n${r.titulo}\nEtapa: ${r.rotuloEtapa}\n${linkAbsoluto(r.href)}`);
  }
  const resto = chaves.length - MAX_LINKS_WHATSAPP;
  if (resto > 0) blocos.push(`Passou de ${MAX_LINKS_WHATSAPP} links por mensagem. Mande os outros ${resto} de novo.`);
  return blocos.join("\n\n");
}

/** Pergunta livre ao assistente. Se a resposta pedir uma ação, guarda a pendência e pergunta "Confirma?". */
async function responderLivre(v: VinculoWa, texto: string, agora: Date): Promise<{ texto: string; botoes?: typeof BOTOES_CONFIRMA }> {
  if (!permitido(v, "usar_assistente")) return { texto: "Seu perfil não tem acesso ao assistente." };
  if (!assistenteDisponivel()) return { texto: "O assistente ainda não está ativado." };
  const limite = registrarMensagem(v.usuarioId);
  if (!limite.permitido) return { texto: "Você chegou ao limite de mensagens por hora. Tente de novo mais tarde." };
  try {
    await mostrarDigitando(v.conversaId ?? "");
    const sistema = `${await montarSistemaDoChat(interpretarRota("/pipeline"), lerFrente(undefined), agora, v.empresaId)}\n\n${INSTRUCAO_WHATSAPP}`;
    const bruta = await gerarTexto({ sistema, historico: [{ papel: "usuario", texto }], maxTokens: 512 });
    const pedida = ACAO_VALIDA.exec(bruta);
    const limpa = bruta.replace(LINHA_ACAO, "").trim();
    if (pedida?.[1] && pedida[2]) {
      const acao = lerPayload(`${pedida[1]}:${pedida[2]}`);
      if (acao && (acao.tipo === "participar" || acao.tipo === "atribuir" || acao.tipo === "descartar")) {
        const itens = await listarPipeline(v.empresaId);
        if (itens.some((i) => i.id === acao.itemId)) {
          await gravarPendencia(v.usuarioId, acao, new Date(agora.getTime() + VALIDADE_PENDENCIA_MS));
          return { texto: `${limpa}\n\nConfirma?`.trim(), botoes: BOTOES_CONFIRMA };
        }
      }
    }
    return { texto: limpa === "" ? await respostaLocal(v, agora, true) : limpa };
  } catch {
    return { texto: await respostaLocal(v, agora, true) };
  }
}

async function tratar(msg: MensagemRecebida, agora: Date): Promise<void> {
  if (msg.remetente === numeroDaConta()) return;

  const comando = lerComando(msg.texto);
  const acao = msg.payloadBotao ? lerPayload(msg.payloadBotao) : null;

  if (comando.tipo === "ativar") {
    const r = await ativarPorCodigo(comando.codigo, msg.remetente, msg.conversationId, agora);
    if (!r.ok) {
      await enviarTexto(
        msg.conversationId,
        r.motivo === "codigo"
          ? "Código inválido ou vencido. Gere outro na tela Alertas do painel."
          : "Este número já está ligado a outra pessoa da equipe.",
      );
      return;
    }
    const ligado: VinculoWa = { ...r.vinculo, conversaId: msg.conversationId, ultimaEntrada: agora };
    await enviarParaPessoa(
      ligado,
      `✅ Alertas ligados, ${primeiroNome(ligado.nome)}.\nComandos: *pipeline*, *prazos*, *parar*.`,
      agora,
      { resposta: true },
    );
    await enviarFila(ligado, agora);
    return;
  }

  const v = await lerVinculoPorNumero(msg.remetente);
  // O número é compartilhado com o atendimento (coexistência): quem não ligou os alertas não recebe resposta automática.
  if (v === null) {
    return;
  }

  // Quem escreve reabre a janela de 24 h.
  await registrarEntrada(v.usuarioId, msg.conversationId, agora);
  let atual: VinculoWa = { ...v, conversaId: msg.conversationId, ultimaEntrada: agora };
  const responder = (texto: string, botoes?: ReadonlyArray<{ titulo: string; payload: string }>) =>
    enviarParaPessoa(atual, texto, agora, { resposta: true, ...(botoes ? { botoes } : {}) });

  // "Ver resumo" / "Ver andamento": botão dos modelos (o toque pode chegar como payload ou como o texto do botão).
  const doBotao = msg.payloadBotao ? lerComando(msg.payloadBotao) : null;
  const pedeResumo = acao?.tipo === "ver_resumo" || comando.tipo === "ver_resumo" || doBotao?.tipo === "ver_resumo";
  const pedeAndamento = acao?.tipo === "ver_andamento" || comando.tipo === "ver_andamento" || doBotao?.tipo === "ver_andamento";

  const confirmar = acao?.tipo === "confirmar" || (acao === null && comando.tipo === "sim");
  const cancelar = acao?.tipo === "cancelar" || (acao === null && comando.tipo === "nao");
  const continuar = acao?.tipo === "continuar" || (acao === null && comando.tipo === "voltar");

  let resumoFeito = false;
  if (pedeResumo) {
    resumoFeito = true;
    if (!(await enviarResumoCompleto(atual, agora))) await responder("Hoje não tenho novidades para te mostrar. Mande *prazos* ou *pipeline* para ver o que está em andamento.");
  } else if (pedeAndamento) {
    resumoFeito = true;
    if (!(await enviarAndamentoCompleto(atual, agora))) await responder("Ainda não tenho andamento para te mostrar hoje. Mande *prazos* ou *pipeline* para ver o que está em andamento.");
  } else if (acao?.tipo === "gerar") {
    const r = await gerarPropostaPeloWhatsapp(atual, { itemId: acao.itemId }, agora);
    await responder(r.texto, r.botoes);
  } else if (acao?.tipo === "aprovar") {
    const r = await aprovarPropostaPeloWhatsapp(atual, acao.propostaId, agora);
    await responder(r.texto, r.botoes);
  } else if (acao === null && comando.tipo === "gerar") {
    const r = await gerarPropostaPeloWhatsapp(atual, { numero: comando.numero }, agora);
    await responder(r.texto, r.botoes);
  } else if (acao === null && comando.tipo === "propostas") {
    const r = await listarPropostasPeloWhatsapp(atual, agora);
    await responder(r.texto, r.botoes);
  } else if (acao === null && comando.tipo === "numero") {
    const r = await abrirPropostaPeloWhatsapp(atual, comando.numero, agora);
    await responder(r?.texto ?? "Mande *propostas* para ver a lista e responda o número da que quer abrir.", r?.botoes);
  } else if (acao === null && comando.tipo === "saudacao") {
    resumoFeito = true;
    if (!(await enviarResumoAtrasado(atual, agora))) await responder(await respostaLocal(atual, agora, false));
  } else if (acao && (acao.tipo === "participar" || acao.tipo === "atribuir" || acao.tipo === "descartar")) {
    await responder(await executarAcao(atual, acao));
  } else if (confirmar) {
    const pendente = await lerPendencia(atual.usuarioId, agora);
    if (pendente === null) {
      await responder("Não tenho nada esperando confirmação.");
    } else {
      await apagarPendencia(atual.usuarioId);
      await responder(await executarAcao(atual, pendente));
    }
  } else if (cancelar) {
    await apagarPendencia(atual.usuarioId);
    await responder("Ok, não mudei nada.");
  } else if (continuar) {
    if (!atual.avisoWhatsapp) {
      await definirAvisoWhatsapp(atual.usuarioId, true);
      atual = { ...atual, avisoWhatsapp: true };
    }
    await responder("Combinado, sigo te avisando por aqui.");
  } else if (comando.tipo === "parar") {
    await definirAvisoWhatsapp(atual.usuarioId, false);
    atual = { ...atual, avisoWhatsapp: false };
    await responder("Alertas pausados. Mande *voltar* quando quiser receber de novo.");
  } else if (comando.tipo === "pipeline") {
    await responder(textoPipeline(await listarPipeline(atual.empresaId), agora));
  } else if (comando.tipo === "prazos") {
    await responder(textoPrazos(await listarPipeline(atual.empresaId), agora));
  } else if (comando.tipo === "analisar") {
    await responder(await analisarLinks(atual, comando.texto));
  } else if (comando.tipo === "livre" && comando.texto !== "") {
    const r = await responderLivre(atual, comando.texto, agora);
    await responder(r.texto, r.botoes);
  }

  // Primeira mensagem do dia com o resumo das 7h pulado (janela fechada): o resumo do dia sai agora, uma vez só.
  if (!resumoFeito && comando.tipo !== "parar") await enviarResumoAtrasado(atual, agora);

  // Só o prazo urgente que ficou na fila sai agora; o resto espera o resumo das 7h.
  if (atual.avisoWhatsapp) await enviarFila(atual, agora);
}

/** Trata uma mensagem recebida. Nunca lança. */
export async function processarMensagem(msg: MensagemRecebida, agora: Date = new Date()): Promise<void> {
  try {
    await tratar(msg, agora);
  } catch (e) {
    console.error("[whatsapp] agente:", e instanceof Error ? e.name : "erro");
  }
}
