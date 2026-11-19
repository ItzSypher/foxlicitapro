/**
 * Resultado de uma proposta enviada, a partir dos resultados por item do PNCP.
 * Funções puras, sem banco nem rede; o relógio entra por parâmetro.
 */
import type { AvisoNovo } from "./avisos";
import type { ResultadoItemPncp } from "./pncp/resultados";

export const SITUACOES_RESULTADO = ["aguardando", "ganhou", "perdeu"] as const;
export type SituacaoResultado = (typeof SITUACOES_RESULTADO)[number];

export const ROTULO_RESULTADO: Record<SituacaoResultado, string> = {
  aguardando: "Aguardando resultado",
  ganhou: "Ganhou",
  perdeu: "Perdeu",
};

export function ehSituacaoResultado(valor: unknown): valor is SituacaoResultado {
  return typeof valor === "string" && (SITUACOES_RESULTADO as readonly string[]).includes(valor);
}

/** Enviada e ainda sem resultado final (filtro "Enviadas sem resultado"). */
export function semResultado(p: { status: string; resultado: SituacaoResultado | null }): boolean {
  return p.status === "enviada" && (p.resultado === null || p.resultado === "aguardando");
}

/** Máximo de itens consultados por proposta em cada rodada (uma chamada por item). */
export const MAX_ITENS_CONSULTA = 30;
/** Depois disso a proposta deixa de ser consultada sozinha. */
export const DIAS_MAXIMOS_CONSULTA = 180;
/** Intervalo mínimo entre duas consultas da mesma proposta. */
export const HORAS_ENTRE_CONSULTAS = 20;

const MS_HORA = 3_600_000;

/** Situação do item no PNCP que encerra sem vencedor (ninguém ganha). */
const ENCERRADO_SEM_VENCEDOR = /desert|fracass|anulad|revogad|cancelad/i;

export interface ItemParaApurar {
  numero: number;
  /** Situação do item no detalhe da compra (ex.: "Homologado", "Deserto"); null se não veio */
  situacao: string | null;
  resultados: ReadonlyArray<ResultadoItemPncp>;
}

export interface ResultadoApurado {
  situacao: SituacaoResultado;
  /** Nome de quem ganhou quando a empresa perdeu; null quando ganhou ou não se sabe */
  vencedor: string | null;
  /** Ganhou: soma homologada dos itens da empresa. Perdeu: soma homologada dos vencedores. */
  valor: number | null;
  itensGanhos: number;
  itensPerdidos: number;
  itensAguardando: number;
}

/** Mesma empresa quando a raiz do CNPJ (8 primeiros dígitos) bate: cobre matriz e filial. */
export function mesmaEmpresa(documento: string, cnpjEmpresa: string): boolean {
  const a = documento.replace(/\D/g, "");
  const b = cnpjEmpresa.replace(/\D/g, "");
  if (a.length !== 14 || b.length !== 14) return a !== "" && a === b;
  return a.slice(0, 8) === b.slice(0, 8);
}

function somar(atual: number | null, v: number | null): number | null {
  if (v === null) return atual;
  return Math.round(((atual ?? 0) + v) * 100) / 100;
}

/**
 * Item a item: ganho quando um resultado válido é da empresa; perdido quando há vencedor de outra empresa
 * ou o item encerrou sem vencedor (deserto, fracassado, anulado, revogado, cancelado); senão, aguardando.
 * A proposta só sai de "aguardando" quando todos os itens estão decididos; aí ganhou se levou ao menos um.
 */
export function apurarResultado(itens: ReadonlyArray<ItemParaApurar>, cnpjEmpresa: string): ResultadoApurado {
  let ganhos = 0;
  let perdidos = 0;
  let aguardando = 0;
  let valorGanho: number | null = null;
  let valorVencedores: number | null = null;
  const vencedores = new Map<string, number>();

  for (const item of itens) {
    const validos = item.resultados.filter((r) => !r.cancelado);
    const nossos = validos.filter((r) => mesmaEmpresa(r.documentoFornecedor, cnpjEmpresa));
    if (nossos.length > 0) {
      ganhos += 1;
      for (const r of nossos) valorGanho = somar(valorGanho, r.valorTotal);
    } else if (validos.length > 0) {
      perdidos += 1;
      for (const r of validos) {
        valorVencedores = somar(valorVencedores, r.valorTotal);
        if (r.nomeFornecedor !== "") vencedores.set(r.nomeFornecedor, (vencedores.get(r.nomeFornecedor) ?? 0) + 1);
      }
    } else if (item.situacao !== null && ENCERRADO_SEM_VENCEDOR.test(item.situacao)) {
      perdidos += 1;
    } else {
      aguardando += 1;
    }
  }

  const base = { itensGanhos: ganhos, itensPerdidos: perdidos, itensAguardando: aguardando };
  if (itens.length === 0 || aguardando > 0) {
    return { situacao: "aguardando", vencedor: null, valor: ganhos > 0 ? valorGanho : null, ...base };
  }
  if (ganhos > 0) return { situacao: "ganhou", vencedor: null, valor: valorGanho, ...base };

  let vencedor: string | null = null;
  let maior = 0;
  for (const [nome, vezes] of vencedores) {
    if (vezes > maior) {
      vencedor = nome;
      maior = vezes;
    }
  }
  return { situacao: "perdeu", vencedor, valor: valorVencedores, ...base };
}

/**
 * Itens a consultar: os números da proposta que existem na compra; se nenhum bate
 * (proposta registrada fora do sistema, sem itens), todos os itens da compra. No máximo 30.
 */
export function itensParaConsultar(numerosProposta: ReadonlyArray<number>, numerosCompra: ReadonlyArray<number>): number[] {
  const daCompra = new Set(numerosCompra);
  const comuns = [...new Set(numerosProposta)].filter((n) => daCompra.has(n));
  const escolhidos = comuns.length > 0 ? comuns : [...daCompra];
  return escolhidos.sort((a, b) => a - b).slice(0, MAX_ITENS_CONSULTA);
}

/** Enviada há no máximo 180 dias e sem consulta nas últimas 20 h. */
export function precisaConsultar(p: { enviadaEm: string | null; consultadoEm: string | null }, agora: Date): boolean {
  if (p.enviadaEm === null) return false;
  const enviada = Date.parse(p.enviadaEm);
  if (Number.isNaN(enviada) || agora.getTime() - enviada > DIAS_MAXIMOS_CONSULTA * 24 * MS_HORA) return false;
  if (p.consultadoEm === null) return true;
  const consultada = Date.parse(p.consultadoEm);
  return Number.isNaN(consultada) || agora.getTime() - consultada >= HORAS_ENTRE_CONSULTAS * MS_HORA;
}

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function cortar(texto: string, max: number): string {
  return texto.length <= max ? texto : `${texto.slice(0, max - 1).trimEnd()}…`;
}

/** Frase curta do resultado, para a linha do tempo e o aviso. */
export function textoResultado(r: ResultadoApurado): string {
  const total = r.itensGanhos + r.itensPerdidos + r.itensAguardando;
  const valor = r.valor === null ? "" : ` (${moeda.format(r.valor)})`;
  if (r.situacao === "ganhou") {
    return total > 1 ? `Ganhou ${r.itensGanhos} de ${total} itens${valor}.` : `Ganhou${valor}.`;
  }
  if (r.situacao === "perdeu") {
    if (r.vencedor === null) return "Perdeu: a compra encerrou sem vencedor para os itens da proposta.";
    return `Perdeu para ${r.vencedor}${valor}.`;
  }
  if (r.itensGanhos > 0) return `Aguardando: ganhou ${r.itensGanhos} de ${total} itens até agora${valor}.`;
  return "Aguardando o resultado no PNCP.";
}

/** Aviso para todos da empresa quando o resultado sai; null enquanto aguarda. */
export function avisoResultado(p: { id: string; titulo: string; apurado: ResultadoApurado }): AvisoNovo | null {
  if (p.apurado.situacao === "aguardando") return null;
  return {
    alvo: { tipo: "todos" },
    tipo: "proposta_resultado",
    titulo: p.apurado.situacao === "ganhou" ? "Proposta ganha" : "Proposta perdida",
    corpo: `${cortar(p.titulo, 140)}: ${textoResultado(p.apurado)}`,
    link: `/propostas/${p.id}`,
    chave: `proposta_resultado:${p.id}:${p.apurado.situacao}`,
  };
}
