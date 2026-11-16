/**
 * Painel de resultados: agrega o pipeline, as propostas e as fichas de uma empresa.
 * Funções puras, sem banco; o relógio entra por parâmetro. Meses contados em America/Sao_Paulo.
 */
import { SEM_LIMITES, calcularCaixa } from "@/core/caixa";
import { diaDeSaoPaulo } from "@/core/avisos";
import { ROTULO_MOTIVO, calcularLucro, MOTIVOS_PERDA, type MotivoPerda } from "@/core/fechamento";
import type { Frente, Regiao } from "@/core/types";
import { REGIOES_PIPELINE, ROTULO_REGIAO } from "@/components/pipeline/tipos";

const MS_DIA = 24 * 3_600_000;
const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;
const MESES_NOME = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

// ---------------------------------------------------------------------------------------------
// Período
// ---------------------------------------------------------------------------------------------

export type PeriodoResultados =
  | { tipo: "mes"; mes: string }
  | { tipo: "ultimos"; meses: 3 | 12 }
  | { tipo: "ano"; ano: number };

export const PERIODO_PADRAO: PeriodoResultados = { tipo: "ultimos", meses: 3 };

const FORMATO_MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** "2026-11" de uma data ISO, em São Paulo. */
export function mesDe(iso: string): string | null {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? null : diaDeSaoPaulo(data).slice(0, 7);
}

function mesAtual(agora: Date): string {
  return diaDeSaoPaulo(agora).slice(0, 7);
}

/** Soma (ou subtrai) meses de um AAAA-MM. */
export function somarMeses(mes: string, delta: number): string {
  const indice = Number(mes.slice(0, 4)) * 12 + (Number(mes.slice(5, 7)) - 1) + delta;
  const a = Math.floor(indice / 12);
  const m = (indice % 12) + 1;
  return `${a}-${String(m).padStart(2, "0")}`;
}

/** Os últimos `quantidade` meses (AAAA-MM), do mais antigo ao mês de `agora`. */
export function mesesDoPeriodo(agora: Date, quantidade: number): string[] {
  const atual = mesAtual(agora);
  const meses: string[] = [];
  for (let i = quantidade - 1; i >= 0; i--) meses.push(somarMeses(atual, -i));
  return meses;
}

/** Os meses (AAAA-MM, do mais antigo ao mais novo) que o período cobre. O ano corrente vai só até o mês atual. */
export function mesesDoSeletor(periodo: PeriodoResultados, agora: Date): string[] {
  if (periodo.tipo === "mes") return [periodo.mes];
  if (periodo.tipo === "ultimos") return mesesDoPeriodo(agora, periodo.meses);
  const atual = mesAtual(agora);
  const meses: string[] = [];
  for (let m = 1; m <= 12; m++) {
    const mes = `${periodo.ano}-${String(m).padStart(2, "0")}`;
    if (mes <= atual) meses.push(mes);
  }
  return meses;
}

/** "2026-03" vira "mar/26". */
export function rotuloMes(mes: string): string {
  const abrev = MESES_ABREV[Number(mes.slice(5, 7)) - 1] ?? mes.slice(5, 7);
  return `${abrev}/${mes.slice(2, 4)}`;
}

/** "2026-11" vira "novembro/2026". */
export function nomeMes(mes: string): string {
  const nome = MESES_NOME[Number(mes.slice(5, 7)) - 1] ?? mes.slice(5, 7);
  return `${nome}/${mes.slice(0, 4)}`;
}

/** Texto do período para telas e relatório: "novembro/2026", "set/26 a nov/26" ou "2026". */
export function rotuloPeriodo(periodo: PeriodoResultados, agora: Date): string {
  if (periodo.tipo === "mes") return nomeMes(periodo.mes);
  if (periodo.tipo === "ano") return String(periodo.ano);
  const meses = mesesDoPeriodo(agora, periodo.meses);
  return `${rotuloMes(meses[0])} a ${rotuloMes(meses[meses.length - 1])}`;
}

export function tituloRelatorio(periodo: PeriodoResultados, agora: Date): string {
  return `Relatório de resultados — ${rotuloPeriodo(periodo, agora)}`;
}

type ParamsBrutos = { [chave: string]: string | undefined };

/** Primeiro valor de cada parâmetro da URL (o Next entrega lista quando o parâmetro se repete). */
export function achatarParametros(params: { [chave: string]: string | string[] | undefined }): ParamsBrutos {
  const saida: ParamsBrutos = {};
  for (const [chave, valor] of Object.entries(params)) saida[chave] = Array.isArray(valor) ? valor[0] : valor;
  return saida;
}

/** Trecho do nome de arquivo para o período: "2026-11", "2026" ou "ultimos-3-meses". */
export function nomeArquivoPeriodo(periodo: PeriodoResultados): string {
  if (periodo.tipo === "mes") return periodo.mes;
  if (periodo.tipo === "ano") return String(periodo.ano);
  return `ultimos-${periodo.meses}-meses`;
}

/** Lê o período da URL. `periodo=1` (mês atual), 3, 12, `mes` (com `mes=AAAA-MM`) ou `ano` (com `ano=AAAA`); o resto vira o padrão. */
export function lerPeriodo(params: ParamsBrutos, agora: Date): PeriodoResultados {
  const atual = mesAtual(agora);
  const bruto = params.periodo;
  if (bruto === "1") return { tipo: "mes", mes: atual };
  if (bruto === "3") return { tipo: "ultimos", meses: 3 };
  if (bruto === "12") return { tipo: "ultimos", meses: 12 };
  if (bruto === "mes") {
    const mes = params.mes;
    if (mes !== undefined && FORMATO_MES.test(mes) && mes <= atual) return { tipo: "mes", mes };
    return { tipo: "mes", mes: atual };
  }
  if (bruto === "ano") {
    const anoAtual = Number(atual.slice(0, 4));
    const ano = Number(params.ano);
    if (Number.isInteger(ano) && ano >= 2000 && ano <= anoAtual) return { tipo: "ano", ano };
    return { tipo: "ano", ano: anoAtual };
  }
  return PERIODO_PADRAO;
}

/** Parâmetros de URL que descrevem o período (o inverso de lerPeriodo). */
export function paramsDoPeriodo(periodo: PeriodoResultados): Record<string, string> {
  if (periodo.tipo === "mes") return { periodo: "mes", mes: periodo.mes };
  if (periodo.tipo === "ano") return { periodo: "ano", ano: String(periodo.ano) };
  return { periodo: String(periodo.meses) };
}

/** Período vizinho (mês ou ano anterior/seguinte); null quando não há (janelas móveis) ou cairia no futuro. */
export function deslocarPeriodo(periodo: PeriodoResultados, delta: 1 | -1, agora: Date): PeriodoResultados | null {
  const atual = mesAtual(agora);
  if (periodo.tipo === "mes") {
    const mes = somarMeses(periodo.mes, delta);
    return mes > atual ? null : { tipo: "mes", mes };
  }
  if (periodo.tipo === "ano") {
    const ano = periodo.ano + delta;
    return ano > Number(atual.slice(0, 4)) || ano < 2000 ? null : { tipo: "ano", ano };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Filtros da lista (e do relatório)
// ---------------------------------------------------------------------------------------------

export const ETAPAS_RESULTADO = ["ganha", "perdida", "disputa"] as const;
export type EtapaResultado = (typeof ETAPAS_RESULTADO)[number];

export const ROTULO_ETAPA_RESULTADO: Record<EtapaResultado, string> = {
  ganha: "Ganha",
  perdida: "Perdida",
  disputa: "Em disputa",
};

export type FiltroEtapa = "todas" | EtapaResultado;
export type OrdemResultados = "data" | "valor" | "lucro";
export type DirecaoResultados = "asc" | "desc";

export interface FiltrosResultados {
  etapa: FiltroEtapa;
  regiao: Regiao | "todas";
  frente: Frente | "todas";
  /** "todos", "sem" (sem responsável) ou o id da pessoa */
  responsavel: string;
  ordem: OrdemResultados;
  direcao: DirecaoResultados;
}

export const FILTROS_PADRAO: FiltrosResultados = {
  etapa: "todas",
  regiao: "todas",
  frente: "todas",
  responsavel: "todos",
  ordem: "data",
  direcao: "desc",
};

export const ROTULO_FRENTE: Record<Frente | "sem-frente", string> = {
  servicos: "Serviços",
  produtos: "Produtos",
  "sem-frente": "Sem frente",
};

const FORMATO_ID_PESSOA = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ehRegiao(valor: unknown): valor is Regiao {
  return REGIOES_PIPELINE.some((r) => r === valor);
}

/** Lê os filtros da URL; valor desconhecido volta ao padrão. */
export function lerFiltros(params: ParamsBrutos): FiltrosResultados {
  const etapa = params.etapa;
  const regiao = params.regiao;
  const frente = params.frente;
  const resp = params.resp;
  const ordem = params.ordem;
  const dir = params.dir;
  return {
    etapa: etapa === "ganha" || etapa === "perdida" || etapa === "disputa" ? etapa : "todas",
    regiao: ehRegiao(regiao) ? regiao : "todas",
    frente: frente === "servicos" || frente === "produtos" ? frente : "todas",
    responsavel: resp === "sem" || (resp !== undefined && FORMATO_ID_PESSOA.test(resp)) ? resp : "todos",
    ordem: ordem === "valor" || ordem === "lucro" ? ordem : "data",
    direcao: dir === "asc" ? "asc" : "desc",
  };
}

/** Parâmetros de URL só do que foge do padrão (o inverso de lerFiltros). */
export function paramsDosFiltros(f: FiltrosResultados): Record<string, string> {
  const params: Record<string, string> = {};
  if (f.etapa !== FILTROS_PADRAO.etapa) params.etapa = f.etapa;
  if (f.regiao !== FILTROS_PADRAO.regiao) params.regiao = f.regiao;
  if (f.frente !== FILTROS_PADRAO.frente) params.frente = f.frente;
  if (f.responsavel !== FILTROS_PADRAO.responsavel) params.resp = f.responsavel;
  if (f.ordem !== FILTROS_PADRAO.ordem) params.ordem = f.ordem;
  if (f.direcao !== FILTROS_PADRAO.direcao) params.dir = f.direcao;
  return params;
}

/** Texto de consulta ("?a=b&c=d", ou vazio) com o período e os filtros. */
export function consultaResultados(periodo: PeriodoResultados, filtros: FiltrosResultados): string {
  const texto = new URLSearchParams({ ...paramsDoPeriodo(periodo), ...paramsDosFiltros(filtros) }).toString();
  return texto === "" ? "" : `?${texto}`;
}

/** Região, frente ou responsável restringem o conjunto: aí as contagens do funil (analisadas, propostas) não se aplicam. */
function temRecorte(f: FiltrosResultados): boolean {
  return f.regiao !== "todas" || f.frente !== "todas" || f.responsavel !== "todos";
}

// ---------------------------------------------------------------------------------------------
// Itens e linhas
// ---------------------------------------------------------------------------------------------

/** Prazos da ficha do edital que entram na conta de caixa. */
export interface PrazosFicha {
  prazoEntregaDias: number | null;
  prazoPagamentoDias: number | null;
  medicaoMensal: boolean | null;
  pagamentoAntecipado: boolean | null;
}

export interface ItemResultado {
  id: string;
  etapa: string;
  /** ISO 8601: quando o item entrou na etapa em que está */
  etapaEm: string;
  valorEstimado: number | null;
  /** Total da proposta aprovada, pronta ou enviada, quando existe */
  valorProposto: number | null;
  ficha: PrazosFicha | null;
  objeto: string;
  orgao: string;
  regiao: Regiao;
  frente: Frente | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  /** Valor final da licitação ganha, informado no fechamento */
  valorHomologado: number | null;
  custoReal: number | null;
  /** ISO 8601: quando o fechamento foi registrado pela primeira vez */
  fechadoEm: string | null;
  motivoPerda: MotivoPerda | null;
}

export interface LinhaResultado {
  id: string;
  etapa: EtapaResultado;
  /** ISO 8601: quando entrou na etapa */
  data: string;
  objeto: string;
  orgao: string;
  regiao: Regiao;
  frente: Frente | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  valorEstimado: number | null;
  valorProposto: number | null;
  valorHomologado: number | null;
  /** Ganha: homologado, senão proposta, senão estimado. Perdida e em disputa: proposta, senão estimado. */
  valor: number | null;
  custo: number | null;
  /** Só das ganhas com custo informado */
  lucro: number | null;
  /** 0 a 1; só das ganhas com custo informado e valor maior que zero */
  margem: number | null;
  /** Só das perdidas */
  motivoPerda: MotivoPerda | null;
  fechadoEm: string | null;
}

function ehEtapaResultado(etapa: string): etapa is EtapaResultado {
  return etapa === "ganha" || etapa === "perdida" || etapa === "disputa";
}

function valorDaGanha(i: ItemResultado): number {
  return i.valorHomologado ?? i.valorProposto ?? i.valorEstimado ?? 0;
}

function paraLinha(i: ItemResultado, etapa: EtapaResultado): LinhaResultado {
  const ganha = etapa === "ganha";
  const valor = ganha ? (i.valorHomologado ?? i.valorProposto ?? i.valorEstimado) : (i.valorProposto ?? i.valorEstimado);
  const custo = ganha ? i.custoReal : null;
  const { lucro, margem } = calcularLucro(custo === null ? null : (valor ?? 0), custo);
  return {
    id: i.id,
    etapa,
    data: i.etapaEm,
    objeto: i.objeto,
    orgao: i.orgao,
    regiao: i.regiao,
    frente: i.frente,
    responsavelId: i.responsavelId,
    responsavelNome: i.responsavelNome,
    valorEstimado: i.valorEstimado,
    valorProposto: i.valorProposto,
    valorHomologado: ganha ? i.valorHomologado : null,
    valor,
    custo,
    lucro,
    margem,
    motivoPerda: etapa === "perdida" ? i.motivoPerda : null,
    fechadoEm: i.fechadoEm,
  };
}

function passaNoRecorte(i: ItemResultado, f: FiltrosResultados): boolean {
  if (f.regiao !== "todas" && i.regiao !== f.regiao) return false;
  if (f.frente !== "todas" && i.frente !== f.frente) return false;
  if (f.responsavel === "sem") return i.responsavelId === null;
  if (f.responsavel !== "todos") return i.responsavelId === f.responsavel;
  return true;
}

function comparar(a: LinhaResultado, b: LinhaResultado, ordem: OrdemResultados, direcao: DirecaoResultados): number {
  const sinal = direcao === "asc" ? 1 : -1;
  const desempate = Date.parse(b.data) - Date.parse(a.data) || a.id.localeCompare(b.id);
  if (ordem === "data") {
    const d = Date.parse(a.data) - Date.parse(b.data);
    return d === 0 ? a.id.localeCompare(b.id) : d * sinal;
  }
  const va = ordem === "valor" ? a.valor : a.lucro;
  const vb = ordem === "valor" ? b.valor : b.lucro;
  // Sem valor (ou sem lucro) vai sempre para o fim, qualquer que seja a direção.
  if (va === null && vb === null) return desempate;
  if (va === null) return 1;
  if (vb === null) return -1;
  return va === vb ? desempate : (va - vb) * sinal;
}

/**
 * Linhas da lista: ganhas e perdidas do período e, enquanto abertas, as em disputa (elas ainda não têm desfecho,
 * então não dependem do mês). Respeita todos os filtros e a ordenação.
 */
export function listarLinhas(
  itens: ReadonlyArray<ItemResultado>,
  periodo: PeriodoResultados,
  filtros: FiltrosResultados,
  agora: Date,
): LinhaResultado[] {
  const noPeriodo = new Set(mesesDoSeletor(periodo, agora));
  const linhas: LinhaResultado[] = [];
  for (const i of itens) {
    if (!ehEtapaResultado(i.etapa)) continue;
    if (filtros.etapa !== "todas" && filtros.etapa !== i.etapa) continue;
    if (!passaNoRecorte(i, filtros)) continue;
    if (i.etapa !== "disputa") {
      const mes = mesDe(i.etapaEm);
      if (mes === null || !noPeriodo.has(mes)) continue;
    }
    linhas.push(paraLinha(i, i.etapa));
  }
  return linhas.sort((a, b) => comparar(a, b, filtros.ordem, filtros.direcao));
}

// ---------------------------------------------------------------------------------------------
// Métricas
// ---------------------------------------------------------------------------------------------

export interface EntradaResultados {
  agora: Date;
  periodo: PeriodoResultados;
  itens: ReadonlyArray<ItemResultado>;
  /** Entradas no histórico do pipeline em etapa posterior ao Radar (uma pessoa pode mover o mesmo item várias vezes) */
  movimentos: ReadonlyArray<{ itemId: string; em: string }>;
  /** Datas (ISO) em que as propostas enviadas ficaram nesse status */
  propostasEnviadasEm: ReadonlyArray<string>;
  /** Só região, frente e responsável contam aqui; a etapa e a ordem são da lista */
  filtros?: FiltrosResultados;
}

export interface MesResultado {
  /** AAAA-MM */
  mes: string;
  ganhas: number;
  valorGanho: number;
  /** Lucro das ganhas do mês que têm custo informado */
  lucro: number;
}

export interface QuebraResultado {
  chave: string;
  rotulo: string;
  ganhas: number;
  perdidas: number;
  valorGanho: number;
  /** Lucro das ganhas que têm custo informado */
  lucro: number;
}

export interface MotivoResultado {
  motivo: MotivoPerda | "nao-informado";
  rotulo: string;
  quantidade: number;
}

export interface Resultados {
  periodo: PeriodoResultados;
  /** null quando há filtro de região, frente ou responsável: o histórico de movimentos não guarda esses dados */
  analisadas: number | null;
  propostasEnviadas: number | null;
  ganhas: number;
  perdidas: number;
  /** 0 a 1; null sem nenhuma ganha ou perdida no período */
  taxaVitoria: number | null;
  /** Soma de todas as ganhas, com ou sem custo informado */
  valorGanho: number;
  /** Soma do custo real das ganhas que têm custo informado */
  custoTotal: number;
  /** Lucro das ganhas que têm custo informado; as demais ficam de fora */
  lucroTotal: number;
  /** Lucro total sobre o valor das ganhas com custo (ponderada pelo valor); null sem nenhuma com custo */
  margemMedia: number | null;
  /** Média simples das margens de cada ganha com custo; null sem nenhuma */
  margemMediaSimples: number | null;
  /** Valor ganho dividido pelas ganhas; null sem ganhas */
  ticketMedio: number | null;
  /** Ganhas do período sem custo real informado */
  ganhasSemCusto: number;
  /** Soma da parcela mensal das ganhas do período com medição mensal */
  receitaMensal: number;
  /** Capital de giro estimado de todas as ganhas ainda em andamento (posição de hoje) */
  capitalComprometido: number;
  ganhasEmAndamento: number;
  porMes: MesResultado[];
  porRegiao: QuebraResultado[];
  porFrente: QuebraResultado[];
  motivosPerda: MotivoResultado[];
}

function somarNaQuebra(
  mapa: Map<string, QuebraResultado>,
  chave: string,
  rotulo: string,
  linha: LinhaResultado,
): void {
  const q = mapa.get(chave) ?? { chave, rotulo, ganhas: 0, perdidas: 0, valorGanho: 0, lucro: 0 };
  if (linha.etapa === "ganha") {
    q.ganhas += 1;
    q.valorGanho += linha.valor ?? 0;
    q.lucro += linha.lucro ?? 0;
  } else {
    q.perdidas += 1;
  }
  mapa.set(chave, q);
}

function ordenarQuebras(mapa: Map<string, QuebraResultado>): QuebraResultado[] {
  return [...mapa.values()].sort(
    (a, b) => b.valorGanho - a.valorGanho || b.ganhas + b.perdidas - (a.ganhas + a.perdidas) || a.rotulo.localeCompare(b.rotulo),
  );
}

export function calcularResultados(e: EntradaResultados): Resultados {
  const filtros = e.filtros ?? FILTROS_PADRAO;
  const meses = mesesDoSeletor(e.periodo, e.agora);
  const noPeriodo = new Set(meses);
  const doPeriodo = (iso: string): boolean => {
    const m = mesDe(iso);
    return m !== null && noPeriodo.has(m);
  };

  const recorte = temRecorte(filtros);
  const analisadas = recorte ? null : new Set(e.movimentos.filter((m) => doPeriodo(m.em)).map((m) => m.itemId)).size;
  const propostasEnviadas = recorte ? null : e.propostasEnviadasEm.filter(doPeriodo).length;

  const porMes = new Map<string, MesResultado>(meses.map((mes) => [mes, { mes, ganhas: 0, valorGanho: 0, lucro: 0 }]));
  const porRegiao = new Map<string, QuebraResultado>();
  const porFrente = new Map<string, QuebraResultado>();
  const motivos = new Map<MotivoPerda | "nao-informado", number>();
  let ganhas = 0;
  let perdidas = 0;
  let valorGanho = 0;
  let custoTotal = 0;
  let lucroTotal = 0;
  let valorComCusto = 0;
  let somaMargens = 0;
  let comMargem = 0;
  let ganhasSemCusto = 0;
  let receitaMensal = 0;
  let capitalComprometido = 0;
  let ganhasEmAndamento = 0;

  for (const i of e.itens) {
    if (!passaNoRecorte(i, filtros)) continue;

    if (i.etapa === "perdida") {
      if (!doPeriodo(i.etapaEm)) continue;
      perdidas += 1;
      const linha = paraLinha(i, "perdida");
      motivos.set(linha.motivoPerda ?? "nao-informado", (motivos.get(linha.motivoPerda ?? "nao-informado") ?? 0) + 1);
      somarNaQuebra(porRegiao, i.regiao, ROTULO_REGIAO[i.regiao], linha);
      somarNaQuebra(porFrente, i.frente ?? "sem-frente", ROTULO_FRENTE[i.frente ?? "sem-frente"], linha);
      continue;
    }
    if (i.etapa !== "ganha") continue;

    const valor = valorDaGanha(i);
    const inicio = new Date(i.etapaEm);
    const caixa = calcularCaixa({
      custoTotal: null,
      prazoEntregaDias: i.ficha?.prazoEntregaDias ?? null,
      prazoPagamentoDias: i.ficha?.prazoPagamentoDias ?? null,
      medicaoMensal: i.ficha?.medicaoMensal ?? null,
      pagamentoAntecipado: i.ficha?.pagamentoAntecipado ?? null,
      valorContrato: valor > 0 ? valor : null,
      mesesContrato: null,
      inicio: Number.isNaN(inicio.getTime()) ? e.agora : inicio,
      limites: SEM_LIMITES,
    });

    if (doPeriodo(i.etapaEm)) {
      const linha = paraLinha(i, "ganha");
      ganhas += 1;
      valorGanho += valor;
      if (caixa.valorMensal !== null) receitaMensal += caixa.valorMensal;
      if (linha.custo === null || linha.lucro === null) {
        ganhasSemCusto += 1;
      } else {
        custoTotal += linha.custo;
        lucroTotal += linha.lucro;
        valorComCusto += valor;
        if (linha.margem !== null) {
          somaMargens += linha.margem;
          comMargem += 1;
        }
      }
      const mes = mesDe(i.etapaEm);
      const doMes = mes === null ? undefined : porMes.get(mes);
      if (doMes) {
        doMes.ganhas += 1;
        doMes.valorGanho += valor;
        doMes.lucro += linha.lucro ?? 0;
      }
      somarNaQuebra(porRegiao, i.regiao, ROTULO_REGIAO[i.regiao], linha);
      somarNaQuebra(porFrente, i.frente ?? "sem-frente", ROTULO_FRENTE[i.frente ?? "sem-frente"], linha);
    }

    // Em andamento: ainda não recebeu. Contrato mensal vale até o fim da duração, mais o prazo de pagamento do último ciclo.
    const inicioMs = inicio.getTime();
    const base = Number.isNaN(inicioMs) ? e.agora.getTime() : inicioMs;
    const fimMs = caixa.receitaMensal
      ? base + (caixa.mesesContrato * 30 + (caixa.diasParado ?? 0)) * MS_DIA
      : caixa.dataRecebimento === null
        ? null
        : Date.parse(caixa.dataRecebimento);
    const emAndamento = fimMs === null || fimMs > e.agora.getTime();
    if (emAndamento) {
      ganhasEmAndamento += 1;
      capitalComprometido += caixa.capital?.valor ?? 0;
    }
  }

  const ordemMotivos: ReadonlyArray<MotivoPerda | "nao-informado"> = [...MOTIVOS_PERDA, "nao-informado"];
  const motivosPerda: MotivoResultado[] = ordemMotivos
    .map((motivo) => ({
      motivo,
      rotulo: motivo === "nao-informado" ? "Sem motivo informado" : ROTULO_MOTIVO[motivo],
      quantidade: motivos.get(motivo) ?? 0,
    }))
    .filter((m) => m.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade);

  const decididas = ganhas + perdidas;
  return {
    periodo: e.periodo,
    analisadas,
    propostasEnviadas,
    ganhas,
    perdidas,
    taxaVitoria: decididas === 0 ? null : ganhas / decididas,
    valorGanho,
    custoTotal,
    lucroTotal,
    margemMedia: valorComCusto > 0 ? lucroTotal / valorComCusto : null,
    margemMediaSimples: comMargem > 0 ? somaMargens / comMargem : null,
    ticketMedio: ganhas > 0 ? valorGanho / ganhas : null,
    ganhasSemCusto,
    receitaMensal,
    capitalComprometido,
    ganhasEmAndamento,
    porMes: meses.map((m) => porMes.get(m) ?? { mes: m, ganhas: 0, valorGanho: 0, lucro: 0 }),
    porRegiao: ordenarQuebras(porRegiao),
    porFrente: ordenarQuebras(porFrente),
    motivosPerda,
  };
}

// ---------------------------------------------------------------------------------------------
// Exportação em CSV
// ---------------------------------------------------------------------------------------------

/** "2026-11-05" vira "05/11/2026", em São Paulo; texto vazio quando a data é inválida. */
export function formatarDia(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  const [a, m, d] = diaDeSaoPaulo(data).split("-");
  return `${d}/${m}/${a}`;
}

function celulaTexto(texto: string): string {
  // Texto que o Excel leria como fórmula ganha uma aspa na frente.
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  const limpo = seguro.replace(/\s*[\r\n]+\s*/g, " ");
  return /[";]/.test(limpo) ? `"${limpo.replace(/"/g, '""')}"` : limpo;
}

function celulaNumero(valor: number | null, casas = 2): string {
  return valor === null || !Number.isFinite(valor) ? "" : valor.toFixed(casas).replace(".", ",");
}

export const CABECALHO_CSV = [
  "Data",
  "Situação",
  "Órgão",
  "Objeto",
  "Região",
  "Frente",
  "Responsável",
  "Valor estimado",
  "Valor da proposta",
  "Valor homologado",
  "Custo real",
  "Lucro",
  "Margem (%)",
  "Motivo da perda",
] as const;

/** Texto do CSV (separador ";", decimal com vírgula, linhas com CRLF). O BOM fica por conta de quem responde o download. */
export function linhasParaCsv(linhas: ReadonlyArray<LinhaResultado>): string {
  const corpo = linhas.map((l) =>
    [
      formatarDia(l.data),
      ROTULO_ETAPA_RESULTADO[l.etapa],
      celulaTexto(l.orgao),
      celulaTexto(l.objeto),
      ROTULO_REGIAO[l.regiao],
      ROTULO_FRENTE[l.frente ?? "sem-frente"],
      celulaTexto(l.responsavelNome ?? ""),
      celulaNumero(l.valorEstimado),
      celulaNumero(l.valorProposto),
      celulaNumero(l.valorHomologado),
      celulaNumero(l.custo),
      celulaNumero(l.lucro),
      celulaNumero(l.margem === null ? null : l.margem * 100, 1),
      l.motivoPerda === null ? "" : ROTULO_MOTIVO[l.motivoPerda],
    ].join(";"),
  );
  return [CABECALHO_CSV.join(";"), ...corpo].join("\r\n") + "\r\n";
}
