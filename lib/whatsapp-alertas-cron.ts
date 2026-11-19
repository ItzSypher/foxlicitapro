import "server-only";
import { diaDeSaoPaulo } from "@/core/avisos";
import { casarCnaesComForca } from "@/core/cnae-keywords";
import { descricaoDoCnae, type PerfilEmpresa } from "@/core/perfil";
import { recomendar } from "@/core/recomendacao";
import type { OportunidadeComScore } from "@/core/types";
import {
  alertasDePrazo,
  dentroDoHorario,
  horaDeSaoPaulo,
  inicioDaSemana,
  janelaAberta,
  textoResumoManha,
  type AlertaWa,
  type ItemAlerta,
  type MovimentoEquipe,
  type NovaDoRamo,
  type PessoaWa,
} from "@/core/whatsapp-alertas";
import { listarPessoasDeAviso } from "@/db/avisos";
import { lerEmpresa, listarIdsEmpresasAtivas } from "@/db/empresas";
import { listarPipeline } from "@/db/pipeline";
import { lerPreferencias } from "@/db/preferencias";
import {
  chavesRegistradas,
  descartarAvulsosAntigos,
  descartarVencidos,
  gravarConfig,
  lerConfig,
  limparEventos,
  listarMudancasDesde,
  listarPendentes,
  listarVinculosAtivos,
  marcarEnviados,
  registrarEnviados,
  type VinculoWa,
} from "@/db/whatsapp";
import { obterRadar } from "@/lib/radar-dados";
import { entregarAlertasWa, enviarParaPessoa } from "@/lib/whatsapp-envio";
import { garantirWebhook, zernioConfigurado } from "@/lib/zernio";

/**
 * Rotina de hora em hora dos alertas de WhatsApp (Zernio). Na hora só sai o prazo urgente (24 h e 2 h);
 * o resto vai no resumo das 7h, montado pelo perfil de cada pessoa. Nunca lança por empresa e nunca
 * devolve número, nome ou texto de mensagem.
 */

const MS_HORA = 3_600_000;
const HORA_RESUMO = 7;
const BASE_PADRAO = "https://licitapro.foxtisolutions.com.br";
const RECOMENDADAS_POR_FRENTE = 20;
const MAX_TERMOS_BATEU = 2;
const MAX_DESCRICAO_BATEU = 45;

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

/** "Equipamentos e suprimentos de informática: toner": o CNAE que casou e os termos; sem CNAE, o primeiro motivo. */
function oQueBateu(o: OportunidadeComScore, perfil: PerfilEmpresa, motivoReserva: string | undefined): string | null {
  const codigo = o.score.cnaesCasados[0];
  if (codigo !== undefined) {
    const casamentos = casarCnaesComForca(o.objeto, perfil);
    const casamento = [...casamentos.servicos, ...casamentos.produtos].find((c) => c.codigo === codigo);
    const descricao = descricaoDoCnae(perfil, codigo) ?? `CNAE ${codigo}`;
    const curta = descricao.length <= MAX_DESCRICAO_BATEU ? descricao : `${descricao.slice(0, MAX_DESCRICAO_BATEU - 1).trimEnd()}…`;
    const termos = casamento?.termos.slice(0, MAX_TERMOS_BATEU) ?? [];
    return termos.length > 0 ? `${curta}: ${termos.join(", ")}` : curta;
  }
  return motivoReserva ?? null;
}

/** Recomendadas do Radar, das duas frentes, fora do pipeline e ainda abertas, da mais indicada para a menos. */
async function novasDoRamo(empresaId: string, idsNoPipeline: ReadonlySet<string>, agora: Date): Promise<NovaDoRamo[]> {
  const [perfil, preferencias] = await Promise.all([lerEmpresa(empresaId), lerPreferencias(empresaId)]);
  if (!perfil) return [];
  const [servicos, produtos] = await Promise.all([
    obterRadar("servicos", undefined, perfil),
    obterRadar("produtos", undefined, perfil),
  ]);
  const recomendadas = [
    ...recomendar(servicos.oportunidades, "servicos", agora, RECOMENDADAS_POR_FRENTE, preferencias, perfil),
    ...recomendar(produtos.oportunidades, "produtos", agora, RECOMENDADAS_POR_FRENTE, preferencias, perfil),
  ].sort((a, b) => b.prioridade - a.prioridade);
  const vistos = new Set<string>();
  const novas: NovaDoRamo[] = [];
  for (const r of recomendadas) {
    const o = r.item;
    if (vistos.has(o.id) || idsNoPipeline.has(o.id)) continue;
    vistos.add(o.id);
    const fim = new Date(o.dataEncerramento).getTime();
    if (Number.isNaN(fim) || fim <= agora.getTime()) continue;
    novas.push({
      id: o.id,
      objeto: o.objeto,
      valor: o.valorEstimado,
      municipio: o.municipio,
      uf: o.uf,
      modalidade: o.modalidadeNome,
      dataEncerramento: o.dataEncerramento,
      bateu: oQueBateu(o, perfil, r.motivos[0]),
    });
  }
  return novas;
}

/** Carrega só quando alguém pede; as outras chamadas reaproveitam o mesmo resultado. */
function sobDemanda<T>(carregar: () => Promise<T>): () => Promise<T> {
  let promessa: Promise<T> | null = null;
  return () => {
    promessa ??= carregar();
    return promessa;
  };
}

/** Mesma chave dos antigos alertas de Radar: o que já foi avisado não volta. */
function chaveDaNova(id: string): string {
  return `radar:${id}`;
}

/** Resumo das 7h: uma vez por dia por pessoa, só com a janela aberta. Devolve quantos foram enviados. */
async function enviarResumosDaManha(
  empresaId: string,
  vinculos: ReadonlyArray<VinculoWa>,
  itens: ReadonlyArray<ItemAlerta>,
  agora: Date,
): Promise<number> {
  const dia = diaDeSaoPaulo(agora);
  const novas = sobDemanda(() =>
    novasDoRamo(empresaId, new Set(itens.map((i) => i.id)), agora).catch((e: unknown): NovaDoRamo[] => {
      console.error("[whatsapp] radar:", mensagemDe(e));
      return [];
    }),
  );
  const movimentos = sobDemanda(async (): Promise<MovimentoEquipe[]> => {
    const [mudancas, pessoas] = await Promise.all([
      listarMudancasDesde(empresaId, new Date(agora.getTime() - 24 * MS_HORA)),
      listarPessoasDeAviso(empresaId),
    ]);
    const nomes = new Map(pessoas.map((p) => [p.id, p.nome]));
    return mudancas.map((m) => ({
      itemId: m.itemId,
      objeto: m.objeto,
      de: m.de,
      para: m.para,
      porId: m.porId,
      porNome: m.porId === null ? null : (nomes.get(m.porId) ?? null),
    }));
  });
  const disputasNaSemana = sobDemanda(async () => {
    const mudancas = await listarMudancasDesde(empresaId, inicioDaSemana(agora));
    return new Set(mudancas.filter((m) => m.para === "disputa").map((m) => m.itemId)).size;
  });

  let enviados = 0;
  for (const v of vinculos) {
    try {
      const chave = `manha:${v.usuarioId}:${dia}`;
      if ((await lerConfig(chave)) !== null) continue;
      if (!janelaAberta(v.ultimaEntrada, agora)) continue;
      const e = v.escolhas;

      let suasNovas: NovaDoRamo[] = [];
      if (e.novas || e.grandes) {
        const todas = await novas();
        const jaVistas = await chavesRegistradas(v.usuarioId, todas.map((n) => chaveDaNova(n.id)));
        suasNovas = todas.filter((n) => !jaVistas.has(chaveDaNova(n.id)));
      }
      const pendentes = e.pendencias ? (await listarPendentes(v.usuarioId, agora)).filter((p) => p.tipo === "aviso") : [];

      const resumo = textoResumoManha(
        {
          usuarioId: v.usuarioId,
          nome: v.nome,
          escolhas: e,
          novas: suasNovas,
          itens,
          movimentos: e.movimentos || e.disputa ? await movimentos() : [],
          pendencias: pendentes.map((p) => p.texto),
          disputasNaSemana: e.meta ? await disputasNaSemana() : 0,
        },
        agora,
      );
      if (resumo.texto === "") continue;
      const ok = await enviarParaPessoa(v, resumo.texto, agora, {
        botoes: [{ titulo: "Continuar recebendo", payload: "continuar" }],
        critico: true,
      });
      if (!ok) continue;
      await gravarConfig(chave, agora.toISOString());
      const mostradas = new Set(resumo.novasMostradas);
      const registro: AlertaWa[] = suasNovas
        .filter((n) => mostradas.has(n.id))
        .map((n) => ({
          usuarioId: v.usuarioId,
          tipo: "radar",
          chave: chaveDaNova(n.id),
          texto: n.objeto.slice(0, 200),
          itemId: null,
          validade: null,
        }));
      await registrarEnviados(empresaId, registro, agora);
      if (pendentes.length > 0) await marcarEnviados(pendentes.map((p) => p.id), agora);
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
  const pessoas: PessoaWa[] = vinculos.map((v) => ({ id: v.usuarioId, ativa: true, prazos: v.escolhas.prazos }));
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

  const entrega = await entregarAlertasWa(empresaId, alertasDePrazo(itens, pessoas, agora), agora);
  let resumos = 0;
  if (horaDeSaoPaulo(agora) === HORA_RESUMO) {
    try {
      resumos = await enviarResumosDaManha(empresaId, vinculos, itens, agora);
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
    await descartarAvulsosAntigos();
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
