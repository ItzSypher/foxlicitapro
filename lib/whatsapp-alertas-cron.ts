import "server-only";
import { diaDeSaoPaulo } from "@/core/avisos";
import { casarCnaesComForca } from "@/core/cnae-keywords";
import { META_PADRAO, type MetaConfig } from "@/core/meta";
import { descricaoDoCnae, nomeExibicao, type PerfilEmpresa } from "@/core/perfil";
import { recomendar } from "@/core/recomendacao";
import { estaAprovada } from "@/core/revisao";
import type { OportunidadeComScore } from "@/core/types";
import {
  alertasDePrazo,
  botoesDoResumoManha,
  chavePropostasDoDia,
  dentroDoHorario,
  escolherPropostasDoDia,
  horaDeSaoPaulo,
  inicioDaSemana,
  juntarResumos,
  partesDoResumoManha,
  textoResumoManha,
  type AlertaWa,
  type BlocoResumo,
  type DadosResumoManha,
  type ItemAlerta,
  type MovimentoEquipe,
  type MovimentoProposta,
  type NovaDoRamo,
  type PessoaWa,
  type PropostaDoDia,
  type VencidasDaSemana,
} from "@/core/whatsapp-alertas";
import { listarPessoasDeAviso } from "@/db/avisos";
import { lerEmpresa, listarIdsEmpresasAtivas } from "@/db/empresas";
import { lerGanhosDaSemana, lerMetaDisputas } from "@/db/meta";
import { listarPipeline } from "@/db/pipeline";
import { listarMovimentosDePropostas, listarPropostas } from "@/db/propostas";
import { lerPreferencias } from "@/db/preferencias";
import { listarIdsEmpresasExtras } from "@/db/usuario-empresas";
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
  listarVinculosGestoresExtras,
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
const MAX_NOME_EMPRESA = 30;

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

/** Dados de uma empresa para o resumo das 7h. Cada parte só é lida quando alguém pede. */
interface ContextoResumo {
  empresaId: string;
  itens: ReadonlyArray<ItemAlerta>;
  novas: () => Promise<NovaDoRamo[]>;
  movimentos: () => Promise<MovimentoEquipe[]>;
  propostasHoje: () => Promise<PropostaDoDia[]>;
  propostasMovidas: () => Promise<MovimentoProposta[]>;
  disputasNaSemana: () => Promise<number>;
  vencidasNaSemana: () => Promise<VencidasDaSemana>;
  meta: () => Promise<MetaConfig>;
}

function contextoDaEmpresa(empresaId: string, itens: ReadonlyArray<ItemAlerta>, agora: Date): ContextoResumo {
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
  const propostasHoje = sobDemanda(async (): Promise<PropostaDoDia[]> => {
    try {
      const propostas = await listarPropostas(empresaId);
      const fechadas = new Set(
        propostas.flatMap((p) => (p.compraId !== null && (estaAprovada(p.status) || p.status === "enviada") ? [p.compraId] : [])),
      );
      return escolherPropostasDoDia(itens, fechadas, agora);
    } catch (e) {
      console.error("[whatsapp] propostas do dia:", mensagemDe(e));
      return [];
    }
  });
  const propostasMovidas = sobDemanda(
    (): Promise<MovimentoProposta[]> =>
      listarMovimentosDePropostas(empresaId, new Date(agora.getTime() - 24 * MS_HORA)).catch((e: unknown): MovimentoProposta[] => {
        console.error("[whatsapp] propostas movidas:", mensagemDe(e));
        return [];
      }),
  );
  const vencidasNaSemana = sobDemanda(async (): Promise<VencidasDaSemana> => {
    const g = await lerGanhosDaSemana(empresaId, agora);
    return { vencidas: g.vencidas, valor: g.valorVencidas, estimado: g.estimadoVencidas };
  });
  const meta = sobDemanda(() => lerMetaDisputas(empresaId));
  return { empresaId, itens, novas, movimentos, propostasHoje, propostasMovidas, disputasNaSemana, vencidasNaSemana, meta };
}

/** Leituras que valem para a rodada inteira: o nome curto e o contexto de cada empresa extra, lidos uma vez só. */
interface CacheRodada {
  nomes: Map<string, Promise<string | null>>;
  extras: Map<string, Promise<ContextoResumo | null>>;
}

function novoCache(): CacheRodada {
  return { nomes: new Map(), extras: new Map() };
}

/** Nome para o cabeçalho e o aviso de prazo: fantasia ou razão social, curto. Null se a empresa não existe. */
function nomeCurtoDaEmpresa(empresaId: string, cache: CacheRodada): Promise<string | null> {
  let nome = cache.nomes.get(empresaId);
  if (nome === undefined) {
    nome = lerEmpresa(empresaId)
      .then((perfil) => {
        if (!perfil) return null;
        const inteiro = nomeExibicao(perfil);
        return inteiro.length <= MAX_NOME_EMPRESA ? inteiro : `${inteiro.slice(0, MAX_NOME_EMPRESA - 1).trimEnd()}…`;
      })
      .catch((e: unknown) => {
        console.error("[whatsapp] empresa:", mensagemDe(e));
        return null;
      });
    cache.nomes.set(empresaId, nome);
  }
  return nome;
}

interface ItemDoPipeline {
  id: string;
  etapa: string;
  item: { objeto: string; dataEncerramento: string; valorEstimado?: number | null };
  responsavelId: string | null;
}

function itemDeAlerta(i: ItemDoPipeline): ItemAlerta {
  return {
    id: i.id,
    etapa: i.etapa,
    objeto: i.item.objeto,
    dataEncerramento: i.item.dataEncerramento,
    responsavelId: i.responsavelId,
    valor: i.item.valorEstimado ?? null,
  };
}

function contextoDaExtra(empresaId: string, agora: Date, cache: CacheRodada): Promise<ContextoResumo | null> {
  let contexto = cache.extras.get(empresaId);
  if (contexto === undefined) {
    contexto = (async () => {
      const pipeline = await listarPipeline(empresaId);
      return contextoDaEmpresa(empresaId, pipeline.map(itemDeAlerta), agora);
    })().catch((e: unknown) => {
      console.error("[whatsapp] pipeline:", mensagemDe(e));
      return null;
    });
    cache.extras.set(empresaId, contexto);
  }
  return contexto;
}

/** A tabela usuario_empresas ainda não existe (migration não aplicada): vale como "sem empresas extras". */
function semTabelaDeAcessos(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && e.code === "42P01";
}

/** Empresas ativas extras da pessoa, em ordem de nome. Sem a tabela, nenhuma. Outro erro sobe. */
async function empresasExtrasDaPessoa(
  usuarioId: string,
  propriaId: string,
  cache: CacheRodada,
): Promise<Array<{ id: string; nome: string }>> {
  let ids: string[];
  try {
    ids = await listarIdsEmpresasExtras(usuarioId);
  } catch (e) {
    if (semTabelaDeAcessos(e)) return [];
    throw e;
  }
  const achadas = await Promise.all(
    ids.filter((id) => id !== propriaId).map(async (id) => ({ id, nome: await nomeCurtoDaEmpresa(id, cache) })),
  );
  return achadas
    .filter((a): a is { id: string; nome: string } => a.nome !== null)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Gestores de outras empresas que acessam esta. Sem a tabela (ou com falha), nenhum: o cron segue como antes. */
async function gestoresExtrasDaEmpresa(empresaId: string): Promise<VinculoWa[]> {
  try {
    return await listarVinculosGestoresExtras(empresaId);
  } catch (e) {
    if (!semTabelaDeAcessos(e)) console.error("[whatsapp] gestores:", mensagemDe(e));
    return [];
  }
}

/** Novas do Radar que esta pessoa ainda não viu (a chave `radar:` só é gravada depois do envio). */
async function novasDaPessoa(ctx: ContextoResumo, v: VinculoWa): Promise<NovaDoRamo[]> {
  if (!v.escolhas.novas && !v.escolhas.grandes) return [];
  const todas = await ctx.novas();
  const jaVistas = await chavesRegistradas(v.usuarioId, todas.map((n) => chaveDaNova(n.id)));
  return todas.filter((n) => !jaVistas.has(chaveDaNova(n.id)));
}

async function dadosDoResumo(
  ctx: ContextoResumo,
  v: VinculoWa,
  novas: ReadonlyArray<NovaDoRamo>,
  pendencias: ReadonlyArray<string>,
  daPropriaEmpresa: boolean,
): Promise<DadosResumoManha> {
  const e = v.escolhas;
  return {
    usuarioId: v.usuarioId,
    nome: v.nome,
    escolhas: e,
    propostasHoje: daPropriaEmpresa && e.pendencias ? await ctx.propostasHoje() : [],
    propostasMovidas: e.movimentos ? await ctx.propostasMovidas() : [],
    novas,
    itens: ctx.itens,
    movimentos: e.movimentos || e.disputa ? await ctx.movimentos() : [],
    pendencias,
    disputasNaSemana: e.meta ? await ctx.disputasNaSemana() : 0,
    vencidasNaSemana: e.meta ? await ctx.vencidasNaSemana() : { vencidas: 0, valor: 0, estimado: false },
    meta: e.meta ? await ctx.meta() : META_PADRAO,
  };
}

function registroDeNovas(usuarioId: string, novas: ReadonlyArray<NovaDoRamo>, mostradas: ReadonlyArray<string>): AlertaWa[] {
  const vistas = new Set(mostradas);
  return novas
    .filter((n) => vistas.has(n.id))
    .map((n) => ({
      usuarioId,
      tipo: "radar",
      chave: chaveDaNova(n.id),
      texto: n.objeto.slice(0, 200),
      itemId: null,
      validade: null,
    }));
}

/**
 * Monta e envia o resumo do dia de uma pessoa. Devolve se saiu; nada a dizer ou envio recusado: não grava nada.
 * Quem é gestor de outras empresas recebe uma mensagem só, com um bloco por empresa.
 */
async function enviarResumoDaPessoa(
  empresaId: string,
  v: VinculoWa,
  propria: ContextoResumo,
  agora: Date,
  cache: CacheRodada,
): Promise<boolean> {
  const dia = diaDeSaoPaulo(agora);
  const e = v.escolhas;

  const suasNovas = await novasDaPessoa(propria, v);
  const pendentes = e.pendencias ? (await listarPendentes(v.usuarioId, agora)).filter((p) => p.tipo === "aviso") : [];
  const dadosProprios = await dadosDoResumo(propria, v, suasNovas, pendentes.map((p) => p.texto), true);
  const extras = await empresasExtrasDaPessoa(v.usuarioId, empresaId, cache);

  let texto: string;
  const registros: Array<{ empresaId: string; alertas: AlertaWa[] }> = [];
  if (extras.length === 0) {
    const resumo = textoResumoManha(dadosProprios, agora);
    texto = resumo.texto;
    registros.push({ empresaId, alertas: registroDeNovas(v.usuarioId, suasNovas, resumo.novasMostradas) });
  } else {
    const proprias = partesDoResumoManha(dadosProprios, agora);
    const nomeProprio = (await nomeCurtoDaEmpresa(empresaId, cache)) ?? "Sua empresa";
    const blocos: BlocoResumo[] = [{ empresa: nomeProprio, partes: proprias.partes }];
    registros.push({ empresaId, alertas: registroDeNovas(v.usuarioId, suasNovas, proprias.novasMostradas) });
    for (const extra of extras) {
      const ctx = await contextoDaExtra(extra.id, agora, cache);
      if (ctx === null) continue;
      const novasExtra = await novasDaPessoa(ctx, v);
      const partes = partesDoResumoManha(await dadosDoResumo(ctx, v, novasExtra, [], false), agora);
      blocos.push({ empresa: extra.nome, partes: partes.partes });
      registros.push({ empresaId: extra.id, alertas: registroDeNovas(v.usuarioId, novasExtra, partes.novasMostradas) });
    }
    texto = juntarResumos(v.nome, blocos);
  }
  if (texto === "") return false;
  const doDia = dadosProprios.propostasHoje;
  const botoes = doDia.length > 0 ? botoesDoResumoManha(doDia) : [{ titulo: "Continuar recebendo", payload: "continuar" }];
  const ok = await enviarParaPessoa(v, texto, agora, { botoes, critico: true, utilidade: true });
  if (!ok) return false;
  await gravarConfig(`manha:${v.usuarioId}:${dia}`, agora.toISOString());
  if (doDia.length > 0) await gravarConfig(chavePropostasDoDia(v.usuarioId, dia), JSON.stringify(doDia.map((p) => p.itemId)));
  for (const r of registros) await registrarEnviados(r.empresaId, r.alertas, agora);
  if (pendentes.length > 0) await marcarEnviados(pendentes.map((p) => p.id), agora);
  return true;
}

/** Resumo das 7h: uma vez por dia por pessoa; com a janela fechada vai como mensagem utilitária. Devolve quantos foram enviados. */
async function enviarResumosDaManha(
  empresaId: string,
  vinculos: ReadonlyArray<VinculoWa>,
  itens: ReadonlyArray<ItemAlerta>,
  agora: Date,
  cache: CacheRodada,
): Promise<number> {
  const dia = diaDeSaoPaulo(agora);
  const propria = contextoDaEmpresa(empresaId, itens, agora);

  let enviados = 0;
  for (const v of vinculos) {
    try {
      if ((await lerConfig(`manha:${v.usuarioId}:${dia}`)) !== null) continue;
      // Janela fechada não pula mais: o resumo sai como mensagem utilitária (enviarParaPessoa decide).
      if (await enviarResumoDaPessoa(empresaId, v, propria, agora, cache)) enviados += 1;
    } catch (e) {
      console.error("[whatsapp] resumo:", mensagemDe(e));
    }
  }
  return enviados;
}

/**
 * Resumo atrasado: o das 7h foi pulado porque a janela estava fechada. Na primeira mensagem da pessoa no mesmo dia
 * (até as 20h) ele sai, uma vez só. Devolve se enviou. Nunca lança.
 */
export async function enviarResumoAtrasado(v: VinculoWa, agora: Date): Promise<boolean> {
  try {
    if (!v.avisoWhatsapp || v.conversaId === null || !dentroDoHorario(agora) || !zernioConfigurado()) return false;
    const dia = diaDeSaoPaulo(agora);
    if ((await lerConfig(`manha:${v.usuarioId}:${dia}`)) !== null) return false;
    const chaveTentativa = `atrasado:${v.usuarioId}:${dia}`;
    if ((await lerConfig(chaveTentativa)) !== null) return false;
    await gravarConfig(chaveTentativa, agora.toISOString());
    const pipeline = await listarPipeline(v.empresaId);
    const propria = contextoDaEmpresa(v.empresaId, pipeline.map(itemDeAlerta), agora);
    return await enviarResumoDaPessoa(v.empresaId, v, propria, agora, novoCache());
  } catch (e) {
    console.error("[whatsapp] resumo atrasado:", mensagemDe(e));
    return false;
  }
}

async function rodarEmpresa(
  empresaId: string,
  agora: Date,
  cache: CacheRodada,
): Promise<{ novos: number; enviados: number; resumos: number } | null> {
  const vinculos = await listarVinculosAtivos(empresaId);
  const gestoresExtras = await gestoresExtrasDaEmpresa(empresaId);
  if (vinculos.length === 0 && gestoresExtras.length === 0) return null;
  const pessoas: PessoaWa[] = vinculos.map((v) => ({ id: v.usuarioId, ativa: true, prazos: v.escolhas.prazos }));
  const pipeline = await listarPipeline(empresaId).catch((e: unknown) => {
    console.error("[whatsapp] pipeline:", mensagemDe(e));
    return [];
  });
  const itens: ItemAlerta[] = pipeline.map(itemDeAlerta);

  const entrega = await entregarAlertasWa(empresaId, alertasDePrazo(itens, pessoas, agora), agora);
  let novos = entrega.novos;
  let enviados = entrega.enviados;

  if (gestoresExtras.length > 0) {
    // Prazo urgente dos itens desta empresa para quem a acessa de fora, com o nome dela no texto.
    // Item com responsável da própria equipe que já recebe prazo fica só com ele, como acontece com o gestor de casa.
    const nome = await nomeCurtoDaEmpresa(empresaId, cache);
    if (nome !== null) {
      const daEquipe = new Set(pessoas.filter((p) => p.prazos).map((p) => p.id));
      const itensDosGestores = itens.filter((i) => i.responsavelId === null || !daEquipe.has(i.responsavelId));
      const gestores: PessoaWa[] = gestoresExtras.map((v) => ({ id: v.usuarioId, ativa: true, prazos: v.escolhas.prazos }));
      const doGestor = await entregarAlertasWa(empresaId, alertasDePrazo(itensDosGestores, gestores, agora, nome), agora, { semBotoes: true });
      novos += doGestor.novos;
      enviados += doGestor.enviados;
    }
  }

  let resumos = 0;
  if (vinculos.length > 0 && horaDeSaoPaulo(agora) === HORA_RESUMO) {
    try {
      resumos = await enviarResumosDaManha(empresaId, vinculos, itens, agora, cache);
    } catch (e) {
      console.error("[whatsapp] resumo:", mensagemDe(e));
    }
  }
  return { novos, enviados: enviados + resumos, resumos };
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
  const cache = novoCache();
  for (const empresaId of ids) {
    try {
      const r = await rodarEmpresa(empresaId, agora, cache);
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
