import type { OportunidadeComScore } from "@/core/types";
import { MS_DIA, MS_HORA } from "./formato";

/** Brasília não tem horário de verão desde 2019: o dia civil vai de 03:00 UTC a 03:00 UTC. */
const DESLOCAMENTO_BRASILIA_MS = 3 * MS_HORA;

/** Pipeline da empresa, quando a contagem já está disponível. */
export interface PipelinePainel {
  /** Itens que ainda não foram ganhos nem perdidos */
  ativas: number;
  emDisputa: number;
}

/** Números do "resumo do dia" que abre o Radar. */
export interface PainelDia {
  /** Oportunidades abertas que passaram pelos filtros atuais */
  abertas: number;
  /** false quando nenhuma oportunidade traz a data de publicação (cache antigo) */
  temPublicacao: boolean;
  novas24h: number;
  novasHoje: number;
  novasOntem: number;
  encerram48h: number;
  /** Fecham em até 7 dias (inclui as das próximas 48 h) */
  encerramSemana: number;
  /** Faixa "go" da pontuação */
  sinalAlto: number;
  /** Soma do valor estimado das que informam valor */
  valorTotal: number;
  semValor: number;
  pipeline: PipelinePainel | null;
}

/** Início (ms, UTC) do dia civil de Brasília que contém `instante`. */
export function inicioDoDiaBrasilia(instante: number): number {
  return Math.floor((instante - DESLOCAMENTO_BRASILIA_MS) / MS_DIA) * MS_DIA + DESLOCAMENTO_BRASILIA_MS;
}

/**
 * Conta o dia numa passada só. `agora` (ms) é o relógio; datas inválidas ou ausentes
 * não contam. Função pura: quem chama decide quais itens entram (os do filtro atual).
 */
export function calcularPainel(lista: ReadonlyArray<OportunidadeComScore>, agora: number): PainelDia {
  const hoje = inicioDoDiaBrasilia(agora);
  const ontem = hoje - MS_DIA;
  const painel: PainelDia = {
    abertas: 0,
    temPublicacao: false,
    novas24h: 0,
    novasHoje: 0,
    novasOntem: 0,
    encerram48h: 0,
    encerramSemana: 0,
    sinalAlto: 0,
    valorTotal: 0,
    semValor: 0,
    pipeline: null,
  };
  for (const item of lista) {
    const restante = Date.parse(item.dataEncerramento) - agora;
    if (Number.isNaN(restante) || restante <= 0) continue;
    painel.abertas += 1;
    if (restante < 48 * MS_HORA) painel.encerram48h += 1;
    if (restante < 7 * MS_DIA) painel.encerramSemana += 1;
    if (item.score.faixa === "go") painel.sinalAlto += 1;
    if (item.valorEstimado !== null && item.valorEstimado > 0) painel.valorTotal += item.valorEstimado;
    else painel.semValor += 1;

    const publicada = Date.parse(item.dataPublicacao ?? "");
    if (Number.isNaN(publicada)) continue;
    painel.temPublicacao = true;
    const idade = agora - publicada;
    if (idade >= -MS_HORA && idade < MS_DIA) painel.novas24h += 1;
    if (publicada >= hoje && publicada <= agora + MS_HORA) painel.novasHoje += 1;
    else if (publicada >= ontem && publicada < hoje) painel.novasOntem += 1;
  }
  return painel;
}

const numeroCurto = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** "R$ 12,4 mi", "R$ 340 mil", "R$ 1,2 bi"; abaixo de mil, o valor inteiro. */
export function formatarValorCompacto(valor: number): string {
  const v = Math.max(0, valor);
  if (v >= 1e9) return `R$ ${numeroCurto.format(v / 1e9)} bi`;
  if (v >= 1e6) return `R$ ${numeroCurto.format(v / 1e6)} mi`;
  if (v >= 1e3) return `R$ ${Math.round(v / 1e3).toLocaleString("pt-BR")} mil`;
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
}
