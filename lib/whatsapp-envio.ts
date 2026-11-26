import "server-only";
import { diaDeSaoPaulo } from "@/core/avisos";
import {
  aceitaAlerta,
  botoesDoAlerta,
  dentroDoHorario,
  janelaAberta,
  mesDeSaoPaulo,
  MODELO_ANDAMENTO_15H,
  MODELO_RESUMO_7H,
  textoDoResumo,
  type AlertaWa,
  type TipoAlertaWa,
} from "@/core/whatsapp-alertas";
import {
  descartarVencidos,
  enfileirarAlertas,
  lerResponsavelPadrao,
  lerVinculoPorUsuario,
  listarPendentes,
  marcarEnviados,
  marcarTemplateEnviado,
  somarContador,
  type VinculoWa,
} from "@/db/whatsapp";
import { enviarTemplate, enviarTexto, zernioConfigurado, type BotaoZernio } from "@/lib/zernio";

/**
 * Envio dos alertas de WhatsApp pelo Zernio, sempre em conversa individual.
 * Na hora só sai o prazo urgente (24 h e 2 h), e só com a janela de 24 h aberta. Aviso fica na fila
 * para o resumo das 7h. Template pago só para prazo crítico, desligado por padrão.
 * Nunca lança: falha vira log curto (sem chave, sem número).
 */

function limiteDaVariavel(nome: string, padrao: number): number {
  const valor = Number(process.env[nome] ?? String(padrao));
  return Number.isFinite(valor) && valor > 0 ? valor : padrao;
}

/**
 * Teto duro de mensagens livres por mês, contando tudo (alertas e respostas): passou, nada mais sai.
 * Fica abaixo das 1.000 que a Meta não cobra por número, com folga para o atendimento.
 */
function limiteMensal(): number {
  return limiteDaVariavel("WA_LIMITE_MENSAL", 900);
}

/**
 * Teto de alertas por mês (prazos urgentes e resumos). Respostas a quem escreveu não entram aqui.
 * Duas pessoas com um resumo por dia dão uns 60; o resto é folga para os prazos urgentes.
 */
function limiteAlertas(): number {
  return limiteDaVariavel("WA_LIMITE_ALERTAS", 150);
}

const CRITICOS: ReadonlySet<TipoAlertaWa> = new Set(["prazo2", "prazo24"]);
/** Mais que isso de alertas novos para a mesma pessoa numa rodada vira um resumo só. */
const MAX_AVULSOS = 3;

function chaveContador(agora: Date): string {
  return `envios:${mesDeSaoPaulo(agora)}`;
}

/**
 * Texto livre com a janela fechada como mensagem utilitária da Meta. Só quem pede (`utilidade`) usa, e a Meta nem sempre entrega:
 * os resumos das 7h e das 15h não dependem mais disso (usam os modelos). `WA_ENVIO_UTILIDADE=false` desliga.
 */
function utilidadeLigada(): boolean {
  return (process.env.WA_ENVIO_UTILIDADE ?? "").trim().toLowerCase() !== "false";
}

function chaveAlertas(agora: Date): string {
  return `alertas:${mesDeSaoPaulo(agora)}`;
}

/**
 * Envia uma mensagem livre se a janela estiver aberta e os tetos do mês permitirem. Conta o envio.
 * `resposta`: resposta a quem acabou de escrever (só o teto duro vale). Sem ela, é alerta e conta nos dois tetos.
 * `critico` não fura teto nenhum: com o teto batido, o alerta fica na fila.
 */
export async function enviarParaPessoa(
  v: VinculoWa,
  texto: string,
  agora: Date,
  opcoes: { botoes?: ReadonlyArray<BotaoZernio>; critico?: boolean; resposta?: boolean; utilidade?: boolean } = {},
): Promise<boolean> {
  if (!zernioConfigurado() || v.conversaId === null) return false;
  const aberta = janelaAberta(v.ultimaEntrada, agora);
  // Janela fechada: só passa como mensagem utilitária (cobrada), e só quando quem chama pediu e ela não foi desligada.
  const comoUtilidade = !aberta && opcoes.utilidade === true && utilidadeLigada();
  if (!aberta && !comoUtilidade) return false;
  try {
    const ehAlerta = !opcoes.resposta;
    if ((await somarContador(chaveContador(agora), 0)) >= limiteMensal()) return false;
    if (ehAlerta && (await somarContador(chaveAlertas(agora), 0)) >= limiteAlertas()) return false;
    const r = await enviarTexto(v.conversaId, texto, opcoes.botoes, { utilidade: comoUtilidade });
    if (!r.ok) {
      console.error("[whatsapp] envio:", r.erro ?? "falha");
      return false;
    }
    await somarContador(chaveContador(agora), 1);
    if (ehAlerta) await somarContador(chaveAlertas(agora), 1);
    return true;
  } catch (e) {
    console.error("[whatsapp] envio:", e instanceof Error ? e.message : "falha");
    return false;
  }
}

/** `WA_TEMPLATES_RESUMO=true` liga os modelos aprovados do resumo das 7h e do andamento das 15h (janela fechada). */
export function modelosResumoLigados(): boolean {
  return (process.env.WA_TEMPLATES_RESUMO ?? "").trim().toLowerCase() === "true";
}

export type ModeloDoDia = "manha" | "tarde";

/** Nome do modelo do dia: o padrão fixo ou o que a variável de ambiente definir. */
export function nomeDoModelo(modelo: ModeloDoDia): string {
  const definido = (modelo === "manha" ? process.env.WA_TEMPLATE_RESUMO_7H : process.env.WA_TEMPLATE_ANDAMENTO_15H)?.trim();
  if (definido) return definido;
  return modelo === "manha" ? MODELO_RESUMO_7H : MODELO_ANDAMENTO_15H;
}

/**
 * Modelo aprovado do resumo (7h) ou do andamento (15h) para quem está com a janela fechada. Abre a conversa pelo número,
 * conta nos tetos como alerta. `parametros`: nome e a linha curta, já limpos. Devolve se saiu. Nunca lança.
 */
export async function enviarModeloParaPessoa(
  v: VinculoWa,
  modelo: ModeloDoDia,
  parametros: ReadonlyArray<string>,
  agora: Date,
): Promise<boolean> {
  if (!zernioConfigurado() || v.whatsapp === null) return false;
  try {
    if ((await somarContador(chaveContador(agora), 0)) >= limiteMensal()) return false;
    if ((await somarContador(chaveAlertas(agora), 0)) >= limiteAlertas()) return false;
    const idioma = process.env.WA_TEMPLATE_IDIOMA?.trim() || "pt_BR";
    const r = await enviarTemplate(v.whatsapp, nomeDoModelo(modelo), idioma, parametros);
    if (!r.ok) {
      console.error("[whatsapp] modelo:", r.erro ?? "falha");
      return false;
    }
    await somarContador(chaveContador(agora), 1);
    await somarContador(chaveAlertas(agora), 1);
    return true;
  } catch (e) {
    console.error("[whatsapp] modelo:", e instanceof Error ? e.message : "falha");
    return false;
  }
}

function templateAtivo(): { nome: string; idioma: string } | null {
  if (process.env.WA_TEMPLATE_ATIVO !== "true") return null;
  const nome = process.env.WA_TEMPLATE_NOME?.trim();
  if (!nome) return null;
  return { nome, idioma: process.env.WA_TEMPLATE_IDIOMA?.trim() || "pt_BR" };
}

/** F7: template utility pago, no máximo um por dia por pessoa e só para prazo crítico com a janela fechada. */
async function talvezTemplate(v: VinculoWa, alerta: AlertaWa, agora: Date): Promise<boolean> {
  const template = templateAtivo();
  if (!template || !CRITICOS.has(alerta.tipo) || v.whatsapp === null) return false;
  const hoje = diaDeSaoPaulo(agora);
  if (v.ultimoTemplate === hoje) return false;
  const r = await enviarTemplate(v.whatsapp, template.nome, template.idioma, [alerta.texto.replace(/\s+/g, " ").slice(0, 900)]);
  if (!r.ok) {
    console.error("[whatsapp] template:", r.erro ?? "falha");
    return false;
  }
  await marcarTemplateEnviado(v.usuarioId, hoje);
  return true;
}

async function nomeDoPadrao(empresaId: string): Promise<string | null> {
  try {
    return (await lerResponsavelPadrao(empresaId))?.nome ?? null;
  } catch (e) {
    console.error("[whatsapp] responsável padrão:", e instanceof Error ? e.message : "falha");
    return null;
  }
}

/** Manda os prazos urgentes: um a um com botões, ou num resumo só quando são muitos. Devolve quantas mensagens saíram. */
async function enviarUrgentes(
  v: VinculoWa,
  urgentes: ReadonlyArray<AlertaWa>,
  agora: Date,
  responsavelPadrao: () => Promise<string | null>,
  semBotoes: boolean,
): Promise<number> {
  const pendentes = (await listarPendentes(v.usuarioId, agora)).filter((p) => CRITICOS.has(p.tipo));
  if (urgentes.length > MAX_AVULSOS) {
    if (pendentes.length > 0 && (await enviarParaPessoa(v, textoDoResumo(pendentes), agora, { critico: true }))) {
      await marcarEnviados(pendentes.map((p) => p.id), agora);
      return 1;
    }
    return 0;
  }
  let enviados = 0;
  for (const a of urgentes) {
    const linha = pendentes.find((p) => p.tipo === a.tipo && p.texto === a.texto && p.itemId === a.itemId);
    if (!linha) continue;
    const botoes = semBotoes ? [] : botoesDoAlerta(a.tipo, a.itemId, a.itemId === null ? null : await responsavelPadrao());
    if (await enviarParaPessoa(v, a.texto, agora, { botoes, critico: true })) {
      await marcarEnviados([linha.id], agora);
      enviados += 1;
    }
  }
  return enviados;
}

/**
 * Grava na fila só o que cada pessoa escolheu receber (sem repetir chave por pessoa). Prazo urgente sai
 * na hora para quem está com a janela aberta, dentro do horário; aviso espera o resumo das 7h.
 * `semBotoes`: alertas de uma empresa que não é a da pessoa (gestor de várias); os botões agem na empresa própria.
 */
export async function entregarAlertasWa(
  empresaId: string,
  alertas: ReadonlyArray<AlertaWa>,
  agora: Date = new Date(),
  opcoes: { semBotoes?: boolean } = {},
): Promise<{ novos: number; enviados: number }> {
  const resultado = { novos: 0, enviados: 0 };
  if (alertas.length === 0) return resultado;
  let padrao: Promise<string | null> | null = null;
  const responsavelPadrao = () => {
    padrao ??= nomeDoPadrao(empresaId);
    return padrao;
  };
  try {
    const porPessoa = new Map<string, AlertaWa[]>();
    for (const a of alertas) porPessoa.set(a.usuarioId, [...(porPessoa.get(a.usuarioId) ?? []), a]);

    for (const [usuarioId, lista] of porPessoa) {
      try {
        const v = await lerVinculoPorUsuario(usuarioId);
        if (!v) continue;
        const aceitos = lista.filter((a) => aceitaAlerta(v.escolhas, a.tipo));
        if (aceitos.length === 0) continue;
        const novos = await enfileirarAlertas(empresaId, aceitos);
        resultado.novos += novos.length;
        if (!zernioConfigurado() || !v.avisoWhatsapp || v.conversaId === null) continue;
        const urgentes = novos.filter((a) => CRITICOS.has(a.tipo));
        if (urgentes.length === 0) continue;
        if (!janelaAberta(v.ultimaEntrada, agora)) {
          const primeiro = urgentes[0];
          if (primeiro && (await talvezTemplate(v, primeiro, agora))) resultado.enviados += 1;
          continue;
        }
        if (!dentroDoHorario(agora)) continue;
        resultado.enviados += await enviarUrgentes(v, urgentes, agora, responsavelPadrao, opcoes.semBotoes === true);
      } catch (e) {
        console.error("[whatsapp] alertas:", e instanceof Error ? e.message : "falha");
      }
    }
  } catch (e) {
    console.error("[whatsapp] alertas:", e instanceof Error ? e.message : "falha");
  }
  return resultado;
}

/**
 * A pessoa voltou a escrever: manda só o prazo urgente que ficou na fila e ainda vale (dentro do horário).
 * Aviso e o resto continuam esperando o resumo das 7h. Devolve se enviou.
 */
export async function enviarFila(v: VinculoWa, agora: Date = new Date()): Promise<boolean> {
  try {
    if (!dentroDoHorario(agora)) return false;
    await descartarVencidos(agora);
    const urgentes = (await listarPendentes(v.usuarioId, agora)).filter((p) => CRITICOS.has(p.tipo));
    if (urgentes.length === 0) return false;
    const unico = urgentes.length === 1 ? urgentes[0] : undefined;
    if (unico) {
      const botoes = botoesDoAlerta(unico.tipo, unico.itemId, unico.itemId === null ? null : await nomeDoPadrao(v.empresaId));
      const enviado = await enviarParaPessoa(v, unico.texto, agora, { botoes, critico: true });
      if (enviado) await marcarEnviados([unico.id], agora);
      return enviado;
    }
    const enviado = await enviarParaPessoa(v, textoDoResumo(urgentes), agora, { critico: true });
    if (enviado) await marcarEnviados(urgentes.map((p) => p.id), agora);
    return enviado;
  } catch (e) {
    console.error("[whatsapp] fila:", e instanceof Error ? e.message : "falha");
    return false;
  }
}
