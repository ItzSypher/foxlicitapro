import "server-only";
import { diaDeSaoPaulo } from "@/core/avisos";
import {
  botoesDoAlerta,
  dentroDoHorario,
  janelaAberta,
  mesDeSaoPaulo,
  textoDoResumo,
  type AlertaWa,
  type TipoAlertaWa,
} from "@/core/whatsapp-alertas";
import {
  descartarVencidos,
  enfileirarAlertas,
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
 * Mensagem livre só com a janela de 24 h aberta; fechada, o alerta fica na fila e vai num resumo
 * quando a pessoa voltar a escrever. Template pago só para prazo crítico, desligado por padrão.
 * Nunca lança: falha vira log curto (sem chave, sem número).
 */

/** Mensagens livres por mês antes de segurar o que não é crítico (a Meta não cobra as primeiras 1.000 por número). */
function limiteMensal(): number {
  const valor = Number(process.env.WA_LIMITE_MENSAL ?? "900");
  return Number.isFinite(valor) && valor > 0 ? valor : 900;
}

const CRITICOS: ReadonlySet<TipoAlertaWa> = new Set(["prazo2", "prazo24"]);
/** Mais que isso de alertas novos para a mesma pessoa numa rodada vira um resumo só. */
const MAX_AVULSOS = 3;

function chaveContador(agora: Date): string {
  return `envios:${mesDeSaoPaulo(agora)}`;
}

/** Envia uma mensagem livre se a janela estiver aberta e o limite do mês permitir. Conta o envio. */
export async function enviarParaPessoa(
  v: VinculoWa,
  texto: string,
  agora: Date,
  opcoes: { botoes?: ReadonlyArray<BotaoZernio>; critico?: boolean; resposta?: boolean } = {},
): Promise<boolean> {
  if (!zernioConfigurado() || v.conversaId === null || !janelaAberta(v.ultimaEntrada, agora)) return false;
  try {
    // Resposta a quem acabou de escrever passa sempre; alerta não crítico respeita o limite do mês.
    if (!opcoes.resposta && !opcoes.critico) {
      const usados = await somarContador(chaveContador(agora), 0);
      if (usados >= limiteMensal()) return false;
    }
    const r = await enviarTexto(v.conversaId, texto, opcoes.botoes);
    if (!r.ok) {
      console.error("[whatsapp] envio:", r.erro ?? "falha");
      return false;
    }
    await somarContador(chaveContador(agora), 1);
    return true;
  } catch (e) {
    console.error("[whatsapp] envio:", e instanceof Error ? e.message : "falha");
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

/**
 * Grava os alertas (sem repetir chave por pessoa) e manda os novos de quem está com a janela aberta,
 * dentro do horário. O resto fica pendente na fila.
 */
export async function entregarAlertasWa(empresaId: string, alertas: ReadonlyArray<AlertaWa>, agora: Date = new Date()): Promise<{ novos: number; enviados: number }> {
  const resultado = { novos: 0, enviados: 0 };
  if (alertas.length === 0) return resultado;
  try {
    const novos = await enfileirarAlertas(empresaId, alertas);
    resultado.novos = novos.length;
    if (novos.length === 0 || !zernioConfigurado()) return resultado;

    const porPessoa = new Map<string, AlertaWa[]>();
    for (const a of novos) porPessoa.set(a.usuarioId, [...(porPessoa.get(a.usuarioId) ?? []), a]);

    for (const [usuarioId, lista] of porPessoa) {
      try {
        const v = await lerVinculoPorUsuario(usuarioId);
        if (!v || !v.avisoWhatsapp || v.conversaId === null) continue;
        if (!janelaAberta(v.ultimaEntrada, agora)) {
          const critico = lista.find((a) => CRITICOS.has(a.tipo));
          if (critico && (await talvezTemplate(v, critico, agora))) resultado.enviados += 1;
          continue;
        }
        if (!dentroDoHorario(agora)) continue;
        if (lista.length > MAX_AVULSOS) {
          const pendentes = await listarPendentes(usuarioId, agora);
          if (pendentes.length > 0 && (await enviarParaPessoa(v, textoDoResumo(pendentes), agora))) {
            await marcarEnviados(pendentes.map((p) => p.id), agora);
            resultado.enviados += 1;
          }
          continue;
        }
        const pendentes = await listarPendentes(usuarioId, agora);
        for (const a of lista) {
          const linha = pendentes.find((p) => p.tipo === a.tipo && p.texto === a.texto && p.itemId === a.itemId);
          if (!linha) continue;
          const botoes = botoesDoAlerta(a.tipo, a.itemId);
          if (await enviarParaPessoa(v, a.texto, agora, { botoes, critico: CRITICOS.has(a.tipo) })) {
            await marcarEnviados([linha.id], agora);
            resultado.enviados += 1;
          }
        }
      } catch (e) {
        console.error("[whatsapp] alertas:", e instanceof Error ? e.message : "falha");
      }
    }
  } catch (e) {
    console.error("[whatsapp] alertas:", e instanceof Error ? e.message : "falha");
  }
  return resultado;
}

/** F4: a pessoa voltou a escrever; manda num resumo só o que ficou na fila. Devolve se enviou. */
export async function enviarFila(v: VinculoWa, agora: Date = new Date()): Promise<boolean> {
  try {
    await descartarVencidos(agora);
    const pendentes = await listarPendentes(v.usuarioId, agora);
    if (pendentes.length === 0) return false;
    const enviado = await enviarParaPessoa(v, textoDoResumo(pendentes), agora, { resposta: true });
    if (enviado) await marcarEnviados(pendentes.map((p) => p.id), agora);
    return enviado;
  } catch (e) {
    console.error("[whatsapp] fila:", e instanceof Error ? e.message : "falha");
    return false;
  }
}
