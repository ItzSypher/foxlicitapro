import { avaliarLimites, capitalNecessario, type LimitesCaixa } from "./caixa";
import { casarCnaesComForca, type CasamentoCnae } from "./cnae-keywords";
import { EMPRESA } from "./empresa";
import type { Criterio, Faixa, Frente, Oportunidade, Regiao, Score } from "./types";

const FATURAMENTO_MEI_MENSAL = 6750;
const FATURAMENTO_MEI_ANUAL = 81000;

const LIMITE_GO = 75;
const LIMITE_ATENCAO = 50;

const NOMES_REGIAO: Record<Regiao, string> = {
  "nova-iguacu": "Nova Iguaçu",
  baixada: "Baixada Fluminense",
  capital: "capital do Rio de Janeiro",
  rj: "interior do estado do Rio",
  "fora-rj": "fora do estado do Rio",
};

const PONTOS_LOCAL_SERVICOS: Record<Regiao, number> = {
  "nova-iguacu": 20,
  baixada: 16,
  capital: 14,
  rj: 6,
  "fora-rj": 0,
};

/**
 * Limite de faturamento MEI para o ano informado.
 * No ano de abertura vale R$ 6.750 por mês, contando o mês da abertura;
 * nos anos seguintes, R$ 81.000. Antes da abertura não há limite (0).
 */
export function limiteMeiAnual(ano: number): number {
  const [anoAbertura, mesAbertura] = EMPRESA.dataAbertura.split("-").map(Number);
  if (ano < anoAbertura) return 0;
  if (ano === anoAbertura) return FATURAMENTO_MEI_MENSAL * (12 - mesAbertura + 1);
  return FATURAMENTO_MEI_ANUAL;
}

function formatarReais(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** O ano vem dos 4 primeiros caracteres: a data já está no horário de Brasília. */
function anoDoEncerramento(dataEncerramento: string): number {
  const ano = Number(dataEncerramento.slice(0, 4));
  return Number.isInteger(ano) ? ano : new Date(dataEncerramento).getFullYear();
}

/** Quanto mais termos e mais inequívoco o termo, mais forte o casamento. */
function forcaDoCasamento(c: CasamentoCnae): number {
  return (c.forte ? 100 : 0) + c.termos.length;
}

function melhorPrimeiro(lista: CasamentoCnae[]): CasamentoCnae[] {
  return [...lista].sort((a, b) => forcaDoCasamento(b) - forcaDoCasamento(a));
}

function criterioCnae(frente: Frente, ativos: CasamentoCnae[], outros: CasamentoCnae[]): Criterio {
  const base = { id: "cnae" as const, rotulo: "Atividade (CNAE)", maximo: 30, aConfirmar: false };
  if (ativos.length > 0) {
    const melhor = ativos[0];
    if (melhor.forte || melhor.termos.length >= 2) {
      return { ...base, pontos: 30, motivo: `O objeto casa com o CNAE ${melhor.codigo}, da frente ativa` };
    }
    return {
      ...base,
      pontos: 22,
      motivo: `O objeto casa com o CNAE ${melhor.codigo} por um termo genérico: confirme o que será entregue`,
    };
  }
  if (outros.length > 0) {
    const outra = frente === "servicos" ? "produtos" : "serviços";
    return { ...base, pontos: 12, motivo: `O objeto casa só com a frente de ${outra} (CNAE ${outros[0].codigo})` };
  }
  return { ...base, pontos: 0, motivo: "Nenhum CNAE da empresa casa com o objeto" };
}

function criterioModalidade(o: Oportunidade): Criterio {
  const base = { id: "modalidade" as const, rotulo: "Modalidade", maximo: 25, aConfirmar: false };
  if (o.modalidadeId === 8) {
    return { ...base, pontos: 25, motivo: "Dispensa eletrônica: disputa simples e rápida" };
  }
  return { ...base, pontos: 10, motivo: "Pregão eletrônico: disputa por lances, mais concorrida" };
}

function criterioLocal(o: Oportunidade, frente: Frente): Criterio {
  const base = { id: "local" as const, rotulo: "Local da entrega", maximo: 20, aConfirmar: false };
  const regiao = NOMES_REGIAO[o.regiao];
  if (frente === "produtos") {
    if (o.regiao === "fora-rj") {
      return { ...base, pontos: 8, motivo: "Produto entregue fora do estado do Rio: frete mais pesado" };
    }
    return { ...base, pontos: 20, motivo: `Produto entregue em ${regiao}: frete viável` };
  }
  const pontos = PONTOS_LOCAL_SERVICOS[o.regiao];
  const motivos: Record<Regiao, string> = {
    "nova-iguacu": "Serviço em Nova Iguaçu: sem deslocamento",
    baixada: "Serviço na Baixada Fluminense: deslocamento curto",
    capital: "Serviço na capital: deslocamento médio",
    rj: "Serviço no interior do estado: deslocamento longo",
    "fora-rj": "Serviço fora do estado do Rio: inviável presencialmente",
  };
  return { ...base, pontos, motivo: motivos[o.regiao] };
}

function criterioDocumentacao(o: Oportunidade): Criterio {
  const base = { id: "documentacao" as const, rotulo: "Documentação", maximo: 15, aConfirmar: true };
  if (o.modalidadeId === 8) {
    return { ...base, pontos: 15, motivo: "Dispensa exige pouca documentação; confirme no aviso" };
  }
  return { ...base, pontos: 6, motivo: "Pregão costuma exigir balanço e atestados; confirme no edital" };
}

/** Abaixo deste valor o retorno não compensa o esforço de montar a proposta. */
export const VALOR_MINIMO = 1500;

function criterioValor(o: Oportunidade): Criterio {
  const base = { id: "valor" as const, rotulo: "Valor x limite MEI", maximo: 10 };
  if (o.valorEstimado === null) {
    return { ...base, pontos: 5, aConfirmar: true, motivo: "Valor sigiloso ou não informado: confirme no edital" };
  }
  const valor = o.valorEstimado;
  if (valor > TETO_MEI_ANO_CHEIO) {
    return {
      ...base,
      pontos: 0,
      aConfirmar: false,
      motivo: `Valor de ${formatarReais(valor)} passa do teto anual do MEI (${formatarReais(TETO_MEI_ANO_CHEIO)}): só disputando parte dos itens`,
    };
  }
  const ano = anoDoEncerramento(o.dataEncerramento);
  const limite = limiteMeiAnual(ano);
  const textoLimite = `limite MEI de ${ano} (${formatarReais(limite)})`;
  if (valor <= limite) {
    if (valor < VALOR_MINIMO) {
      return {
        ...base,
        pontos: 6,
        aConfirmar: false,
        motivo: `Valor de ${formatarReais(valor)} cabe no ${textoLimite}, mas o retorno é baixo para o esforço`,
      };
    }
    return { ...base, pontos: 10, aConfirmar: false, motivo: `Valor de ${formatarReais(valor)} cabe no ${textoLimite}` };
  }
  if (valor <= 2 * limite) {
    return { ...base, pontos: 5, aConfirmar: false, motivo: `Valor de ${formatarReais(valor)} passa do ${textoLimite}, até 2 vezes` };
  }
  return { ...base, pontos: 0, aConfirmar: false, motivo: `Valor de ${formatarReais(valor)} passa de 2 vezes o ${textoLimite}` };
}

/** Faturamento máximo do MEI em um ano cheio. Acima disso o sinal nunca fica verde. */
export const TETO_MEI_ANO_CHEIO = 81_000;

function limitarPeloTeto(faixa: Faixa, valor: number | null): Faixa {
  return faixa === "go" && valor !== null && valor > TETO_MEI_ANO_CHEIO ? "atencao" : faixa;
}

function faixaDoTotal(total: number): Faixa {
  if (total >= LIMITE_GO) return "go";
  if (total >= LIMITE_ATENCAO) return "atencao";
  return "nogo";
}

/** Menos que isto para o prazo: não dá tempo de montar proposta. */
export const MS_POUCO_TEMPO = 6 * 3_600_000;

/** Peso do critério de caixa: pequeno, 5 pontos. Só entra quando o dono definiu algum limite. */
export const PESO_CAIXA = 5;

/**
 * O que o score sabe sobre o caixa. `limites` vêm das Preferências; sem nenhum limite, o critério não entra.
 * `custoTotal` (da cotação) e `diasParado` (da ficha) são opcionais: sem custo, o capital é estimado pelo valor do edital.
 */
export interface ContextoCaixa {
  limites: LimitesCaixa;
  custoTotal?: number | null;
  diasParado?: number | null;
  pagamentoAntecipado?: boolean | null;
}

/**
 * Passou de um limite: 0 pontos (ou 2, quando só o capital estimado pelo valor passou). Dentro dos limites: 5,
 * ou 4 quando parte é estimada ou falta dado. Nada para comparar: 3, a confirmar.
 * Devolve null quando o dono não definiu limite algum.
 */
function criterioCaixa(o: Oportunidade, ctx: ContextoCaixa | undefined): { criterio: Criterio; alerta: string | null } | null {
  if (!ctx || (ctx.limites.capitalMaximo === null && ctx.limites.diasMaximosParado === null)) return null;
  const base = { id: "caixa" as const, rotulo: "Caixa necessário", maximo: PESO_CAIXA };
  const capital = capitalNecessario(ctx.custoTotal ?? null, o.valorEstimado);
  const dias = ctx.diasParado ?? null;
  const a = avaliarLimites(capital, dias, ctx.pagamentoAntecipado ?? null, ctx.limites);

  if (a.excede) {
    const soEstimado = !a.excedeDias && capital?.fonte === "estimado";
    return {
      criterio: { ...base, pontos: soEstimado ? 2 : 0, aConfirmar: soEstimado, motivo: a.motivos.join("; ") },
      alerta: soEstimado ? `${a.alerta ?? ""} (estimado pelo valor do edital)` : a.alerta,
    };
  }
  if (capital === null && dias === null) {
    return { criterio: { ...base, pontos: 3, aConfirmar: true, motivo: "Sem dados para comparar com seus limites de caixa" }, alerta: null };
  }
  const aConfirmar = a.faltaDado || capital?.fonte === "estimado";
  return {
    criterio: {
      ...base,
      pontos: aConfirmar ? 4 : PESO_CAIXA,
      aConfirmar,
      motivo: aConfirmar ? "Dentro dos seus limites de caixa, com parte estimada" : "Dentro dos seus limites de caixa",
    },
    alerta: null,
  };
}

/** Pontua uma oportunidade de 0 a 100 para a frente ativa. Função pura. */
export function calcularScore(o: Oportunidade, frente: Frente, agora: Date = new Date(), caixa?: ContextoCaixa): Score {
  const casados = casarCnaesComForca(o.objeto);
  const outraFrente: Frente = frente === "servicos" ? "produtos" : "servicos";
  const ativos = melhorPrimeiro(casados[frente]);
  const outros = melhorPrimeiro(casados[outraFrente]);

  const criterios: Criterio[] = [
    criterioCnae(frente, ativos, outros),
    criterioModalidade(o),
    criterioLocal(o, frente),
    criterioDocumentacao(o),
    criterioValor(o),
  ];

  const cx = criterioCaixa(o, caixa);
  if (cx) criterios.push(cx.criterio);

  // Com o critério de caixa o máximo passa de 100; a nota volta à escala de 100 proporcionalmente.
  const soma = criterios.reduce((acc, c) => acc + c.pontos, 0);
  const somaMaximos = criterios.reduce((acc, c) => acc + c.maximo, 0);
  const total = cx ? Math.round((soma * 100) / somaMaximos) : soma;
  const semMatch = ativos.length === 0 && outros.length === 0;
  const frenteCasada: Frente | null = ativos.length > 0 ? frente : outros.length > 0 ? outraFrente : null;

  const restante = Date.parse(o.dataEncerramento) - agora.getTime();
  const poucoTempo = restante > 0 && restante < MS_POUCO_TEMPO;

  const alertas: string[] = [];
  if (poucoTempo) alertas.push("Fecha em menos de 6 h: pouco tempo para montar proposta");
  if (o.valorEstimado !== null && o.valorEstimado > TETO_MEI_ANO_CHEIO) alertas.push("Valor acima do teto anual do MEI");
  if (cx?.alerta) alertas.push(cx.alerta);
  if (frenteCasada === outraFrente) {
    alertas.push(`Casou só com a outra frente (${outraFrente === "produtos" ? "produtos" : "serviços"})`);
  }

  let faixa: Faixa = semMatch ? "nogo" : limitarPeloTeto(faixaDoTotal(total), o.valorEstimado);
  if (poucoTempo && faixa === "go") faixa = "atencao";

  return {
    total,
    faixa,
    criterios,
    cnaesCasados: [...ativos, ...outros].map((c) => c.codigo),
    frenteCasada,
    ...(alertas.length > 0 ? { alertas } : {}),
  };
}
