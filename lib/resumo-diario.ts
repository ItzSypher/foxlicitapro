import "server-only";
import { normalizarTexto, regexDoTermo, removerSetorDeSistemas } from "@/core/cnae-keywords";
import { resumirObjeto } from "@/core/objeto";
import { SISTEMA_QUE_NAO_E_TI, recomendar } from "@/core/recomendacao";
import type { PerfilEmpresa } from "@/core/perfil";
import type { Faixa, OportunidadeComScore } from "@/core/types";
import type { Preferencias } from "@/core/types-equipe";
import { sql } from "@/db/client";
import { lerEmpresa, listarIdsEmpresasAtivas } from "@/db/empresas";
import { lerPreferencias } from "@/db/preferencias";
import { listarPropostas } from "@/db/propostas";
import { listarUsuariosAtivos } from "@/db/usuarios";
import { enviarEmail, escaparHtml, linkAbsoluto, type ResultadoEmail } from "@/lib/email";
import { MS_HORA, formatarMoedaCurta, formatarRestanteCurto, plural } from "@/lib/formato";
import { obterRadar } from "@/lib/radar-dados";

/** Resumo diário por e-mail: software e sistemas, sugestões, prazos curtos e propostas paradas. */

const LOGO = "https://licitapro.foxtisolutions.com.br/raposa.svg";
const MAX_SOFTWARE = 8;
const MAX_SUGESTOES = 6;
const MAX_FECHAM = 5;
const JANELA_FECHAMENTO_MS = 48 * MS_HORA;
const MAX_OBJETO = 140;

export interface LinhaResumo {
  id: string;
  objeto: string;
  orgao: string;
  municipio: string;
  /** "R$ 37.713" ou "Sigiloso" */
  valor: string;
  /** "fecha em 2 d" */
  prazo: string;
  nota: number;
  faixa: Faixa;
  /** "boa", "atenção" ou "evitar" */
  palavraFaixa: string;
  link: string;
  nova: boolean;
  /** Encerramento em milissegundos, para ordenar */
  encerraEm: number;
}

export interface PropostaEspera {
  titulo: string;
  status: "em_revisao" | "devolvida";
}

export interface Resumo {
  /** ISO 8601 */
  geradoEm: string;
  assunto: string;
  software: LinhaResumo[];
  /** Quantas oportunidades de software existem, mesmo as que não couberam na lista */
  totalSoftware: number;
  sugestoes: LinhaResumo[];
  fecham: LinhaResumo[];
  propostas: { total: number; emRevisao: number; devolvidas: number; itens: PropostaEspera[] };
  /** Ids de tudo o que está listado, para marcar "Nova" no envio seguinte */
  ids: string[];
}

export interface EntradaResumo {
  agora: Date;
  servicos: ReadonlyArray<OportunidadeComScore>;
  produtos: ReadonlyArray<OportunidadeComScore>;
  preferencias: Pick<Preferencias, "termosPrioritarios" | "termosBloqueadosParaVoce">;
  propostas: ReadonlyArray<PropostaEspera>;
  /** Ids do envio anterior; null quando nunca houve envio (ninguém é marcado como nova) */
  idsAnteriores: ReadonlySet<string> | null;
  /** Perfil da empresa que recebe o resumo; sem ele, vale o perfil de origem (testes) */
  perfil?: PerfilEmpresa;
}

/* ---------- seleção (funções puras) ---------- */

const TERMO_DE_TI =
  /(?<![a-z0-9])(?:sistemas?|software|licenc\w*|aplicativ\w*|desenvolvimento|nuvem|plataforma|programa|ti|tic|tecnologia|informatica|suporte|redes?|cabeamento|computador\w*|notebook\w*|impress\w*|outsourcing)(?![a-z0-9])/;

const TERMOS_DE_SOFTWARE_PADRAO: ReadonlyArray<string> = ["sistema", "software"];

function compilar(termos: ReadonlyArray<string>): RegExp[] {
  const vistos = new Set<string>();
  const regexes: RegExp[] = [];
  for (const bruto of termos) {
    const termo = normalizarTexto(bruto);
    if (termo === "" || vistos.has(termo)) continue;
    vistos.add(termo);
    regexes.push(regexDoTermo(termo));
  }
  return regexes;
}

/** Dos termos prioritários, só os que falam de software, sistema ou TI. Sem nenhum, usa "sistema" e "software". */
export function termosDeSoftware(prioritarios: ReadonlyArray<string>): string[] {
  const doRamo = prioritarios.map(normalizarTexto).filter((t) => t !== "" && TERMO_DE_TI.test(t));
  return doRamo.length > 0 ? doRamo : [...TERMOS_DE_SOFTWARE_PADRAO];
}

export function estaBloqueada(objeto: string, termosBloqueados: ReadonlyArray<string>): boolean {
  const texto = normalizarTexto(objeto);
  return compilar(termosBloqueados).some((r) => r.test(texto));
}

/** "Sistema de registro de preços" e "diretoria de sistemas" não são software: saem do texto antes de procurar. */
export function falaDeSoftware(objeto: string, termosSoftware: ReadonlyArray<string>): boolean {
  const texto = removerSetorDeSistemas(normalizarTexto(objeto)).replace(SISTEMA_QUE_NAO_E_TI, " ");
  return compilar(termosSoftware).some((r) => r.test(texto));
}

function encerraEm(o: OportunidadeComScore): number {
  return Date.parse(o.dataEncerramento);
}

function estaAberta(o: OportunidadeComScore, agora: Date): boolean {
  return encerraEm(o) > agora.getTime();
}

/** Junta as duas frentes numa lista só; o mesmo id fica com a maior nota. */
export function unirFrentes(
  servicos: ReadonlyArray<OportunidadeComScore>,
  produtos: ReadonlyArray<OportunidadeComScore>,
): OportunidadeComScore[] {
  const mapa = new Map<string, OportunidadeComScore>();
  for (const o of [...servicos, ...produtos]) {
    const atual = mapa.get(o.id);
    if (!atual || o.score.total > atual.score.total) mapa.set(o.id, o);
  }
  return [...mapa.values()];
}

/** Software e sistemas: abertas, não bloqueadas, com termo prioritário de software/TI. Por nota e depois por prazo. */
export function selecionarSoftware(
  pool: ReadonlyArray<OportunidadeComScore>,
  preferencias: Pick<Preferencias, "termosPrioritarios" | "termosBloqueadosParaVoce">,
  agora: Date,
): OportunidadeComScore[] {
  const termos = termosDeSoftware(preferencias.termosPrioritarios);
  return pool
    .filter(
      (o) =>
        estaAberta(o, agora) &&
        !estaBloqueada(o.objeto, preferencias.termosBloqueadosParaVoce) &&
        falaDeSoftware(o.objeto, termos),
    )
    .sort((a, b) => b.score.total - a.score.total || encerraEm(a) - encerraEm(b));
}

const PALAVRA_FAIXA: Readonly<Record<Faixa, string>> = { go: "boa", atencao: "atenção", nogo: "evitar" };

function cortar(texto: string, max: number): string {
  return texto.length <= max ? texto : `${texto.slice(0, max - 1).trimEnd()}…`;
}

export function paraLinha(o: OportunidadeComScore, agora: Date, anteriores: ReadonlySet<string> | null): LinhaResumo {
  return {
    id: o.id,
    objeto: cortar(resumirObjeto(o.objeto), MAX_OBJETO),
    orgao: o.orgao,
    municipio: o.municipio,
    valor: o.valorEstimado === null ? "Sigiloso" : formatarMoedaCurta(o.valorEstimado),
    prazo: `fecha em ${formatarRestanteCurto(encerraEm(o) - agora.getTime())}`,
    nota: o.score.total,
    faixa: o.score.faixa,
    palavraFaixa: PALAVRA_FAIXA[o.score.faixa],
    link: linkAbsoluto(`/licitacao/${o.orgaoCnpj}/${o.anoCompra}/${o.sequencialCompra}`),
    nova: anteriores !== null && !anteriores.has(o.id),
    encerraEm: encerraEm(o),
  };
}

/** "Radar de hoje: 5 de software, 3 fecham em 48 h". Sem nada de software: "nada novo de software". */
export function montarAssunto(totalSoftware: number, totalFecham: number): string {
  const partes: string[] = [];
  if (totalSoftware > 0) partes.push(`${totalSoftware} de software`);
  else partes.push("nada novo de software");
  if (totalFecham > 0) partes.push(`${totalFecham} ${plural(totalFecham, "fecha", "fecham")} em 48 h`);
  return `Radar de hoje: ${partes.join(", ")}`;
}

export function montarResumoDeDados(entrada: EntradaResumo): Resumo {
  const { agora, preferencias, idsAnteriores } = entrada;
  const pool = unirFrentes(entrada.servicos, entrada.produtos);

  const todosSoftware = selecionarSoftware(pool, preferencias, agora);
  const softwareLista = todosSoftware.slice(0, MAX_SOFTWARE);
  const idsSoftware = new Set(softwareLista.map((o) => o.id));

  const sugeridas = [
    ...recomendar(entrada.servicos, "servicos", agora, 12, preferencias, entrada.perfil),
    ...recomendar(entrada.produtos, "produtos", agora, 12, preferencias, entrada.perfil),
  ]
    .filter((r) => !idsSoftware.has(r.item.id))
    .sort((a, b) => b.prioridade - a.prioridade || encerraEm(a.item) - encerraEm(b.item));
  const vistas = new Set<string>();
  const sugestoesLista: OportunidadeComScore[] = [];
  for (const r of sugeridas) {
    if (sugestoesLista.length >= MAX_SUGESTOES) break;
    if (vistas.has(r.item.id)) continue;
    vistas.add(r.item.id);
    sugestoesLista.push(r.item);
  }

  const listadas = new Map<string, OportunidadeComScore>();
  for (const o of [...softwareLista, ...sugestoesLista]) listadas.set(o.id, o);
  const candidatasFecham = new Map(listadas);
  // Só software/TI e as sugestões: o dono não quer prazo de item fora do foco no e-mail.
  for (const o of todosSoftware) candidatasFecham.set(o.id, o);
  const fechamLista = [...candidatasFecham.values()]
    .filter((o) => {
      const restante = encerraEm(o) - agora.getTime();
      return restante > 0 && restante <= JANELA_FECHAMENTO_MS;
    })
    .sort((a, b) => encerraEm(a) - encerraEm(b) || b.score.total - a.score.total)
    .slice(0, MAX_FECHAM);

  const emRevisao = entrada.propostas.filter((p) => p.status === "em_revisao").length;
  const devolvidas = entrada.propostas.filter((p) => p.status === "devolvida").length;

  const ids = [...new Set([...softwareLista, ...sugestoesLista, ...fechamLista].map((o) => o.id))];

  return {
    geradoEm: agora.toISOString(),
    assunto: montarAssunto(todosSoftware.length, fechamLista.length),
    software: softwareLista.map((o) => paraLinha(o, agora, idsAnteriores)),
    totalSoftware: todosSoftware.length,
    sugestoes: sugestoesLista.map((o) => paraLinha(o, agora, idsAnteriores)),
    fecham: fechamLista.map((o) => paraLinha(o, agora, idsAnteriores)),
    propostas: { total: emRevisao + devolvidas, emRevisao, devolvidas, itens: [...entrada.propostas] },
    ids,
  };
}

/* ---------- leitura e gravação ---------- */

async function lerIdsAnteriores(empresaId: string): Promise<Set<string> | null> {
  try {
    const linhas = await sql<{ ids: string[] }[]>`
      select ids from resumo_envios where empresa_id = ${empresaId} and ok order by enviado_em desc limit 1`;
    const linha = linhas[0];
    return linha ? new Set(linha.ids) : null;
  } catch {
    return null;
  }
}

async function lerPropostasEmEspera(empresaId: string): Promise<PropostaEspera[]> {
  try {
    const todas = await listarPropostas(empresaId);
    const espera: PropostaEspera[] = [];
    for (const p of todas) {
      if (p.status === "em_revisao" || p.status === "devolvida") espera.push({ titulo: p.titulo, status: p.status });
    }
    return espera;
  } catch {
    return [];
  }
}

/** Lê o Radar das duas frentes, as preferências, as propostas em espera e o último envio da empresa. Pode lançar se o Radar falhar. */
export async function montarResumo(empresaId: string, agora: Date = new Date()): Promise<Resumo> {
  const perfil = await lerEmpresa(empresaId);
  if (!perfil) throw new Error("Empresa não encontrada.");
  const [servicos, produtos, preferencias, propostas, idsAnteriores] = await Promise.all([
    obterRadar("servicos", undefined, perfil),
    obterRadar("produtos", undefined, perfil),
    lerPreferencias(empresaId),
    lerPropostasEmEspera(empresaId),
    lerIdsAnteriores(empresaId),
  ]);
  return montarResumoDeDados({
    agora,
    servicos: servicos.oportunidades,
    produtos: produtos.oportunidades,
    preferencias,
    propostas,
    idsAnteriores,
    perfil,
  });
}

/* ---------- renderização ---------- */

const diaDaSemana = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  weekday: "long",
  day: "numeric",
  month: "long",
});

function dataPorExtenso(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? "" : diaDaSemana.format(data);
}

function textoDaLinha(l: LinhaResumo): string[] {
  return [
    `${l.nova ? "[Nova] " : ""}${l.objeto}`,
    `${l.orgao} - ${l.municipio} | ${l.valor} | ${l.prazo} | nota ${l.nota} (${l.palavraFaixa})`,
    l.link,
  ];
}

function textoDaSecao(titulo: string, linhas: ReadonlyArray<LinhaResumo>): string[] {
  const saida = ["", titulo.toUpperCase()];
  linhas.forEach((l, i) => {
    const [primeira, ...resto] = textoDaLinha(l);
    saida.push("", `${i + 1}. ${primeira ?? ""}`, ...resto.map((r) => `   ${r}`));
  });
  return saida;
}

const NADA_DE_SOFTWARE = "Nada novo de software hoje.";

export function renderizarResumoTexto(resumo: Resumo): string {
  const saida: string[] = [resumo.assunto, dataPorExtenso(resumo.geradoEm)];

  if (resumo.software.length > 0) {
    const titulo =
      resumo.totalSoftware > resumo.software.length
        ? `Software e sistemas (${resumo.software.length} de ${resumo.totalSoftware})`
        : "Software e sistemas";
    saida.push(...textoDaSecao(titulo, resumo.software));
  } else {
    saida.push("", "SOFTWARE E SISTEMAS", "", NADA_DE_SOFTWARE);
  }
  if (resumo.fecham.length > 0) saida.push(...textoDaSecao("Fecham em até 48 h", resumo.fecham));
  if (resumo.sugestoes.length > 0) saida.push(...textoDaSecao("Sugestões para você", resumo.sugestoes));
  if (resumo.propostas.total > 0) {
    saida.push("", "PROPOSTAS ESPERANDO", "");
    if (resumo.propostas.emRevisao > 0) saida.push(`Em revisão: ${resumo.propostas.emRevisao}`);
    if (resumo.propostas.devolvidas > 0) saida.push(`Devolvidas: ${resumo.propostas.devolvidas}`);
    for (const p of resumo.propostas.itens) saida.push(`- ${p.titulo} (${p.status === "em_revisao" ? "em revisão" : "devolvida"})`);
  }
  saida.push("", `Abrir o Radar: ${linkAbsoluto("/radar")}`);
  return saida.join("\n");
}

const COR_TEXTO = "#111111";
const COR_SUAVE = "#5c5c5a";
const COR_LINHA = "#e4e4e2";

function htmlDaLinha(l: LinhaResumo): string {
  const nova = l.nova
    ? `<span style="display:inline-block;margin-right:6px;padding:1px 6px;border:1px solid ${COR_TEXTO};font-size:11px;font-weight:bold;color:${COR_TEXTO};">NOVA</span>`
    : "";
  return `<tr><td style="padding:12px 0;border-bottom:1px solid ${COR_LINHA};">
<div style="font-size:15px;line-height:1.4;color:${COR_TEXTO};">${nova}<a href="${escaparHtml(l.link)}" style="color:${COR_TEXTO};font-weight:bold;text-decoration:underline;">${escaparHtml(l.objeto)}</a></div>
<div style="margin-top:4px;font-size:13px;line-height:1.5;color:${COR_SUAVE};">${escaparHtml(l.orgao)} &middot; ${escaparHtml(l.municipio)}</div>
<div style="margin-top:2px;font-size:13px;line-height:1.5;color:${COR_TEXTO};">${escaparHtml(l.valor)} &middot; ${escaparHtml(l.prazo)} &middot; nota ${l.nota} (${escaparHtml(l.palavraFaixa)})</div>
</td></tr>`;
}

function htmlDaSecao(titulo: string, corpo: string): string {
  return `<tr><td style="padding-top:24px;">
<h2 style="margin:0;padding-bottom:6px;border-bottom:2px solid ${COR_TEXTO};font-size:16px;line-height:1.3;color:${COR_TEXTO};">${escaparHtml(titulo)}</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${corpo}</table>
</td></tr>`;
}

function htmlDePropostas(p: Resumo["propostas"]): string {
  const contagem = [
    p.emRevisao > 0 ? `${p.emRevisao} em revisão` : "",
    p.devolvidas > 0 ? `${p.devolvidas} ${plural(p.devolvidas, "devolvida", "devolvidas")}` : "",
  ]
    .filter((c) => c !== "")
    .join(", ");
  const itens = p.itens
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid ${COR_LINHA};font-size:14px;line-height:1.4;color:${COR_TEXTO};">${escaparHtml(i.titulo)} <span style="color:${COR_SUAVE};">(${i.status === "em_revisao" ? "em revisão" : "devolvida"})</span></td></tr>`,
    )
    .join("");
  return htmlDaSecao(
    "Propostas esperando",
    `<tr><td style="padding:10px 0 2px;font-size:14px;color:${COR_TEXTO};">${escaparHtml(contagem)}</td></tr>${itens}`,
  );
}

export function renderizarResumoHtml(resumo: Resumo): string {
  const secoes: string[] = [];
  if (resumo.software.length > 0) {
    const titulo =
      resumo.totalSoftware > resumo.software.length
        ? `Software e sistemas (${resumo.software.length} de ${resumo.totalSoftware})`
        : "Software e sistemas";
    secoes.push(htmlDaSecao(titulo, resumo.software.map(htmlDaLinha).join("")));
  } else {
    secoes.push(
      htmlDaSecao(
        "Software e sistemas",
        `<tr><td style="padding:12px 0;font-size:15px;line-height:1.4;color:${COR_TEXTO};">${NADA_DE_SOFTWARE}</td></tr>`,
      ),
    );
  }
  if (resumo.fecham.length > 0) secoes.push(htmlDaSecao("Fecham em até 48 h", resumo.fecham.map(htmlDaLinha).join("")));
  if (resumo.sugestoes.length > 0) secoes.push(htmlDaSecao("Sugestões para você", resumo.sugestoes.map(htmlDaLinha).join("")));
  if (resumo.propostas.total > 0) secoes.push(htmlDePropostas(resumo.propostas));

  const data = dataPorExtenso(resumo.geradoEm);
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escaparHtml(resumo.assunto)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:${COR_TEXTO};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;">
<tr><td>
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:12px;"><img src="${LOGO}" width="40" height="40" alt="FoxLicita Pro" style="display:block;border:0;"></td>
<td style="font-size:13px;line-height:1.4;color:${COR_SUAVE};">FoxLicita Pro<br>${escaparHtml(data)}</td>
</tr></table>
</td></tr>
<tr><td style="padding-top:20px;"><h1 style="margin:0;font-size:22px;line-height:1.3;color:${COR_TEXTO};">${escaparHtml(resumo.assunto)}</h1></td></tr>
${secoes.join("\n")}
<tr><td style="padding-top:28px;"><a href="${escaparHtml(linkAbsoluto("/radar"))}" style="display:inline-block;padding:12px 22px;background:#F57E11;color:#000000;font-size:15px;font-weight:bold;text-decoration:none;border-radius:6px;">Abrir o Radar</a></td></tr>
<tr><td style="padding-top:24px;font-size:12px;line-height:1.5;color:${COR_SUAVE};">Você recebe este resumo porque ele está ativo nas <a href="${escaparHtml(linkAbsoluto("/preferencias"))}" style="color:${COR_SUAVE};text-decoration:underline;">preferências</a>.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/* ---------- envio ---------- */

export interface ResultadoResumo {
  enviado: boolean;
  /** Por que não enviou, quando não enviou */
  motivo?: string;
  assunto?: string;
  para: string[];
  itens: number;
  software: number;
  fecham: number;
}

async function gravarEnvio(empresaId: string, para: string[], resumo: Resumo, resultado: ResultadoEmail): Promise<void> {
  try {
    await sql`
      insert into resumo_envios (empresa_id, para, itens, ids, ok, erro)
      values (${empresaId}, ${para}::text[], ${resumo.ids.length}, ${resumo.ids}::text[], ${resultado.ok}, ${resultado.erro ?? null})`;
  } catch {
    // O histórico é auxiliar: falhar ao gravar não pode derrubar a coleta.
  }
}

async function destinatarios(empresaId: string, preferencias: Preferencias): Promise<string[]> {
  if (preferencias.emailsResumo.length > 0) return preferencias.emailsResumo;
  const usuarios = await listarUsuariosAtivos(empresaId);
  return [...new Set(usuarios.map((u) => u.email))];
}

/** Monta e envia o resumo de uma empresa. Respeita "resumo ativo" e os e-mails das preferências dela. Nunca lança. */
export async function enviarResumoDiario(empresaId: string, agora: Date = new Date()): Promise<ResultadoResumo> {
  const vazio: ResultadoResumo = { enviado: false, para: [], itens: 0, software: 0, fecham: 0 };
  try {
    const preferencias = await lerPreferencias(empresaId);
    if (!preferencias.resumoAtivo) return { ...vazio, motivo: "resumo desativado nas preferências" };

    const para = await destinatarios(empresaId, preferencias);
    if (para.length === 0) return { ...vazio, motivo: "sem destinatário" };

    const resumo = await montarResumo(empresaId, agora);
    const resultado = await enviarEmail({
      para,
      assunto: resumo.assunto,
      html: renderizarResumoHtml(resumo),
      texto: renderizarResumoTexto(resumo),
    });
    await gravarEnvio(empresaId, para, resumo, resultado);
    return {
      enviado: resultado.ok,
      ...(resultado.ok ? {} : { motivo: resultado.erro ?? "falha ao enviar" }),
      assunto: resumo.assunto,
      para,
      itens: resumo.ids.length,
      software: resumo.totalSoftware,
      fecham: resumo.fecham.length,
    };
  } catch (e) {
    return { ...vazio, motivo: e instanceof Error ? e.message : "falha ao montar o resumo" };
  }
}

/** Resumo diário de cada empresa ativa, uma por vez (a falha de uma não impede as outras). */
export async function enviarResumosDiarios(agora: Date = new Date()): Promise<Array<{ empresaId: string } & ResultadoResumo>> {
  const ids = await listarIdsEmpresasAtivas().catch((): string[] => []);
  const resultados: Array<{ empresaId: string } & ResultadoResumo> = [];
  for (const empresaId of ids) resultados.push({ empresaId, ...(await enviarResumoDiario(empresaId, agora)) });
  return resultados;
}
