import "server-only";
import { diaDeSaoPaulo } from "@/core/avisos";
import { recomendar } from "@/core/recomendacao";
import {
  alertasDeEtapa,
  alertasDePrazo,
  alertasDeRadar,
  alertasSemResponsavel,
  dentroDoHorario,
  horaDeSaoPaulo,
  textoResumoManha,
  janelaAberta,
  type AlertaWa,
  type ItemAlerta,
  type OportunidadeAlta,
  type PessoaWa,
} from "@/core/whatsapp-alertas";
import { listarPessoasDeAviso } from "@/db/avisos";
import { lerEmpresa, listarIdsEmpresasAtivas } from "@/db/empresas";
import { listarPipeline } from "@/db/pipeline";
import { lerPreferencias } from "@/db/preferencias";
import {
  descartarVencidos,
  gravarConfig,
  idsDonos,
  lerConfig,
  limparEventos,
  listarMudancasDesde,
  listarVinculosAtivos,
} from "@/db/whatsapp";
import { linkAbsoluto } from "@/lib/email";
import { obterRadar } from "@/lib/radar-dados";
import { entregarAlertasWa, enviarParaPessoa } from "@/lib/whatsapp-envio";
import { garantirWebhook, zernioConfigurado } from "@/lib/zernio";

/**
 * Rotina de hora em hora dos alertas de WhatsApp (Zernio): prazos, radar, itens sem responsável, mudanças
 * de etapa e o resumo das 7h. Nunca lança por empresa e nunca devolve número, nome ou texto de mensagem.
 */

const MS_HORA = 3_600_000;
const HORA_RESUMO = 7;
const BASE_PADRAO = "https://licitapro.foxtisolutions.com.br";

export interface ResultadoAlertasWa {
  ativo: boolean;
  empresas: number;
  novos: number;
  enviados: number;
  resumos: number;
}

function mensagemDe(e: unknown): string {
  return e instanceof Error ? e.message : "falha";
}

function urlDoWebhook(): string {
  const definida = process.env.APP_URL?.trim();
  const base = (definida && definida !== "" ? definida : BASE_PADRAO).replace(/\/+$/, "");
  return `${base}/api/whatsapp/webhook`;
}

/** Registra o webhook no Zernio só quando a URL mudou desde o último registro. Devolve se está registrado. */
export async function garantirWebhookConfigurado(): Promise<boolean> {
  if (!zernioConfigurado()) return false;
  const segredo = process.env.ZERNIO_WEBHOOK_SECRET?.trim();
  if (!segredo) return false;
  const url = urlDoWebhook();
  try {
    if ((await lerConfig("webhook_url")) === url) return true;
    const r = await garantirWebhook(url, segredo);
    if (!r.ok) {
      console.error("[whatsapp] webhook:", r.erro ?? "falha");
      return false;
    }
    await gravarConfig("webhook_url", url);
    return true;
  } catch (e) {
    console.error("[whatsapp] webhook:", mensagemDe(e));
    return false;
  }
}

async function alertasDeRadarDaEmpresa(
  empresaId: string,
  pessoas: ReadonlyArray<PessoaWa>,
  idsNoPipeline: ReadonlySet<string>,
  agora: Date,
): Promise<AlertaWa[]> {
  const [perfil, preferencias] = await Promise.all([lerEmpresa(empresaId), lerPreferencias(empresaId)]);
  if (!perfil) return [];
  const [servicos, produtos] = await Promise.all([
    obterRadar("servicos", undefined, perfil),
    obterRadar("produtos", undefined, perfil),
  ]);
  const recomendadas = [
    ...recomendar(servicos.oportunidades, "servicos", agora, 12, preferencias, perfil),
    ...recomendar(produtos.oportunidades, "produtos", agora, 12, preferencias, perfil),
  ]
    .sort((a, b) => b.prioridade - a.prioridade)
    .map((r) => r.item);
  const oportunidades: OportunidadeAlta[] = recomendadas.map((o) => ({
    id: o.id,
    objeto: o.objeto,
    nota: o.score.total,
    dataEncerramento: o.dataEncerramento,
    link: linkAbsoluto(`/licitacao/${o.orgaoCnpj}/${o.anoCompra}/${o.sequencialCompra}`),
  }));
  return alertasDeRadar(oportunidades, pessoas, idsNoPipeline, agora);
}

async function alertasDeEtapaDaEmpresa(empresaId: string, pessoas: ReadonlyArray<PessoaWa>, agora: Date): Promise<AlertaWa[]> {
  const chave = `etapa_desde:${empresaId}`;
  const guardado = await lerConfig(chave);
  const lido = guardado === null ? null : new Date(guardado);
  const desde = lido !== null && !Number.isNaN(lido.getTime()) ? lido : new Date(agora.getTime() - MS_HORA);
  const [mudancas, donos] = await Promise.all([listarMudancasDesde(empresaId, desde), idsDonos(empresaId)]);
  await gravarConfig(chave, agora.toISOString());
  return alertasDeEtapa(mudancas, pessoas, donos);
}

/** Resumo das 7h: uma vez por dia por pessoa, só com a janela aberta. Devolve quantos foram enviados. */
async function enviarResumosDaManha(empresaId: string, itens: ReadonlyArray<ItemAlerta>, agora: Date): Promise<number> {
  const texto = textoResumoManha(itens, agora);
  if (texto === "") return 0;
  const dia = diaDeSaoPaulo(agora);
  let enviados = 0;
  for (const v of await listarVinculosAtivos(empresaId)) {
    try {
      const chave = `manha:${v.usuarioId}:${dia}`;
      if ((await lerConfig(chave)) !== null) continue;
      if (!janelaAberta(v.ultimaEntrada, agora)) continue;
      const ok = await enviarParaPessoa(v, texto, agora, {
        botoes: [{ titulo: "Continuar recebendo", payload: "continuar" }],
        critico: true,
      });
      if (!ok) continue;
      await gravarConfig(chave, agora.toISOString());
      enviados += 1;
    } catch (e) {
      console.error("[whatsapp] resumo:", mensagemDe(e));
    }
  }
  return enviados;
}

async function rodarEmpresa(empresaId: string, agora: Date): Promise<{ novos: number; enviados: number; resumos: number } | null> {
  const vinculos = await listarVinculosAtivos(empresaId);
  if (vinculos.length === 0) return null;
  const comVinculo = new Set(vinculos.map((v) => v.usuarioId));
  const pessoas: PessoaWa[] = (await listarPessoasDeAviso(empresaId)).map((p) => ({ id: p.id, ativa: comVinculo.has(p.id) }));
  const pipeline = await listarPipeline(empresaId).catch((e: unknown) => {
    console.error("[whatsapp] pipeline:", mensagemDe(e));
    return [];
  });
  const itens: ItemAlerta[] = pipeline.map((i) => ({
    id: i.id,
    etapa: i.etapa,
    objeto: i.item.objeto,
    dataEncerramento: i.item.dataEncerramento,
    responsavelId: i.responsavelId,
  }));

  const alertas: AlertaWa[] = [...alertasDePrazo(itens, pessoas, agora), ...alertasSemResponsavel(itens, pessoas, agora)];
  try {
    alertas.push(...(await alertasDeEtapaDaEmpresa(empresaId, pessoas, agora)));
  } catch (e) {
    console.error("[whatsapp] etapas:", mensagemDe(e));
  }
  try {
    alertas.push(...(await alertasDeRadarDaEmpresa(empresaId, pessoas, new Set(itens.map((i) => i.id)), agora)));
  } catch (e) {
    console.error("[whatsapp] radar:", mensagemDe(e));
  }

  const entrega = await entregarAlertasWa(empresaId, alertas, agora);
  let resumos = 0;
  if (horaDeSaoPaulo(agora) === HORA_RESUMO) {
    try {
      resumos = await enviarResumosDaManha(empresaId, itens, agora);
    } catch (e) {
      console.error("[whatsapp] resumo:", mensagemDe(e));
    }
  }
  return { novos: entrega.novos, enviados: entrega.enviados + resumos, resumos };
}

export async function executarAlertasWa(agora: Date): Promise<ResultadoAlertasWa> {
  const resultado: ResultadoAlertasWa = { ativo: true, empresas: 0, novos: 0, enviados: 0, resumos: 0 };
  if (!zernioConfigurado()) return { ...resultado, ativo: false };

  await garantirWebhookConfigurado();
  try {
    await descartarVencidos(agora);
    await limparEventos(agora);
  } catch (e) {
    console.error("[whatsapp] limpeza:", mensagemDe(e));
  }
  if (!dentroDoHorario(agora)) return resultado;

  const ids = await listarIdsEmpresasAtivas().catch((): string[] => []);
  for (const empresaId of ids) {
    try {
      const r = await rodarEmpresa(empresaId, agora);
      if (r === null) continue;
      resultado.empresas += 1;
      resultado.novos += r.novos;
      resultado.enviados += r.enviados;
      resultado.resumos += r.resumos;
    } catch (e) {
      console.error("[whatsapp] empresa:", mensagemDe(e));
    }
  }
  return resultado;
}
