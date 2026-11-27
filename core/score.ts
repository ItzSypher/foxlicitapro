import { avaliarLimites, capitalNecessario, type LimitesCaixa } from "./caixa";
import { casarCnaesComForca, casarFoco, normalizarTexto, regexDoTermo, type CasamentoCnae } from "./cnae-keywords";
import { PERFIL_ORIGEM } from "./empresa";
import { pontuacaoLocal, type NivelLocal } from "./areas";
import { ehMei, type PerfilEmpresa } from "./perfil";
import type { Criterio, Faixa, Frente, Oportunidade, Score } from "./types";

const FATURAMENTO_MEI_MENSAL = 6750;
const FATURAMENTO_MEI_ANUAL = 81000;

const LIMITE_GO = 75;
const LIMITE_ATENCAO = 50;

const MOTIVO_LOCAL_SERVICO: Record<NivelLocal, string> = {
  "municipio-base": "Serviço no seu município-base: sem deslocamento",
  "mesma-rm": "Serviço na sua região metropolitana: deslocamento curto",
  "capital-ou-rm": "Serviço na capital ou região metropolitana do seu estado: deslocamento médio",
  "mesma-uf": "Serviço no interior do seu estado: deslocamento longo",
  "outra-uf": "Serviço em outro estado que você atende: deslocamento muito longo",
  fora: "Serviço fora das suas áreas de atendimento: inviável presencialmente",
};

const MOTIVO_LOCAL_PRODUTO: Record<NivelLocal, string> = {
  "municipio-base": "Produto entregue no seu município-base: frete viável",
  "mesma-rm": "Produto entregue na sua região metropolitana: frete viável",
  "capital-ou-rm": "Produto entregue na capital ou região metropolitana do seu estado: frete viável",
  "mesma-uf": "Produto entregue no seu estado: frete viável",
  "outra-uf": "Produto entregue em outro estado que você atende: frete viável",
  fora: "Produto entregue fora das suas áreas de atendimento: frete mais pesado",
};

/**
 * Limite de faturamento MEI para o ano informado.
 * No ano de abertura vale R$ 6.750 por mês, contando o mês da abertura;
 * nos anos seguintes, R$ 81.000. Antes da abertura não há limite (0).
 * Sem data de abertura no perfil, vale o ano cheio. Só faz sentido para porte MEI (confira com ehMei).
 */
export function limiteMeiAnual(ano: number, perfil: Pick<PerfilEmpresa, "dataAbertura"> = PERFIL_ORIGEM): number {
  if (!perfil.dataAbertura) return FATURAMENTO_MEI_ANUAL;
  const [anoAbertura, mesAbertura] = perfil.dataAbertura.split("-").map(Number);
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

/**
 * Nota mínima de quem bate com o foco e está dentro das áreas de atendimento: o foco é o que o dono diz que oferece,
 * então a modalidade mais concorrida, a documentação mais pesada ou um local menos próximo não o jogam para as notas baixas.
 */
export const NOTA_MINIMA_FOCO = LIMITE_GO;

/** O objeto bate com um termo do foco: vale o melhor casamento de ramo, como se o CNAE casasse com força. */
function criterioFoco(termo: string, elevada: boolean): Criterio {
  const sufixo = elevada ? ` (a nota não fica abaixo de ${NOTA_MINIMA_FOCO} para o que você oferece)` : "";
  return { id: "cnae", rotulo: "Ramo e foco", maximo: 30, pontos: 30, aConfirmar: false, motivo: `Bate com o seu foco: ${termo}${sufixo}` };
}

function criterioModalidade(o: Oportunidade): Criterio {
  const base = { id: "modalidade" as const, rotulo: "Modalidade", maximo: 25, aConfirmar: false };
  if (o.modalidadeId === 8) {
    return { ...base, pontos: 25, motivo: "Dispensa eletrônica: disputa simples e rápida" };
  }
  return { ...base, pontos: 10, motivo: "Pregão eletrônico: disputa por lances, mais concorrida" };
}

/** Serviços entregues à distância: site, sistema, hospedagem. Para eles o deslocamento não pesa. */
const TERMOS_REMOTOS = [
  "site",
  "website",
  "sitio eletronico",
  "portal institucional",
  "portal da transparencia",
  "landing page",
  "redesign",
  "identidade visual",
  "sistema informatizado",
  "sistema de gestao",
  "sistema web",
  "software",
  "aplicativo",
  "saas",
  "hospedagem",
  "plataforma digital",
  "computacao em nuvem",
].map(regexDoTermo);

export function servicoRemoto(objeto: string): boolean {
  const texto = normalizarTexto(objeto);
  return TERMOS_REMOTOS.some((r) => r.test(texto));
}

function criterioLocal(o: Oportunidade, frente: Frente, perfil: PerfilEmpresa): Criterio {
  const base = { id: "local" as const, rotulo: "Local da entrega", maximo: 20, aConfirmar: false };
  const local = pontuacaoLocal(o, perfil.areas);
  if (frente === "servicos" && servicoRemoto(o.objeto)) {
    return {
      ...base,
      pontos: local.dentro ? 20 : 16,
      motivo: "Serviço feito à distância (site, sistema ou hospedagem): o local quase não pesa",
    };
  }
  if (frente === "produtos") {
    // Produto viaja: dentro das áreas vale o máximo, fora delas o frete pesa.
    return { ...base, pontos: local.dentro ? 20 : 8, motivo: MOTIVO_LOCAL_PRODUTO[local.nivel] };
  }
  return { ...base, pontos: local.pontos, motivo: MOTIVO_LOCAL_SERVICO[local.nivel] };
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

function criterioValor(o: Oportunidade, perfil: PerfilEmpresa): Criterio {
  const mei = ehMei(perfil);
  const base = { id: "valor" as const, rotulo: mei ? "Valor x limite MEI" : "Valor da contratação", maximo: 10 };
  if (o.valorEstimado === null) {
    return { ...base, pontos: 5, aConfirmar: true, motivo: "Valor sigiloso ou não informado: confirme no edital" };
  }
  const valor = o.valorEstimado;
  if (!mei) {
    if (valor < VALOR_MINIMO) {
      return { ...base, pontos: 6, aConfirmar: false, motivo: `Valor de ${formatarReais(valor)}: o retorno é baixo para o esforço` };
    }
    return { ...base, pontos: 10, aConfirmar: false, motivo: `Valor de ${formatarReais(valor)}: sem teto de faturamento MEI` };
  }
  if (valor > TETO_MEI_ANO_CHEIO) {
    return {
      ...base,
      pontos: 0,
      aConfirmar: false,
      motivo: `Valor de ${formatarReais(valor)} passa do teto anual do MEI (${formatarReais(TETO_MEI_ANO_CHEIO)}): só disputando parte dos itens`,
    };
  }
  const ano = anoDoEncerramento(o.dataEncerramento);
  const limite = limiteMeiAnual(ano, perfil);
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

function limitarPeloTeto(faixa: Faixa, valor: number | null, perfil: PerfilEmpresa): Faixa {
  return ehMei(perfil) && faixa === "go" && valor !== null && valor > TETO_MEI_ANO_CHEIO ? "atencao" : faixa;
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
export function calcularScore(
  o: Oportunidade,
  frente: Frente,
  agora: Date = new Date(),
  caixa?: ContextoCaixa,
  perfil: PerfilEmpresa = PERFIL_ORIGEM,
): Score {
  const casados = casarCnaesComForca(o.objeto, perfil);
  const outraFrente: Frente = frente === "servicos" ? "produtos" : "servicos";
  const ativos = melhorPrimeiro(casados[frente]);
  const outros = melhorPrimeiro(casados[outraFrente]);

  const foco = casarFoco(o.objeto, perfil.foco);

  const criterios: Criterio[] = [
    criterioCnae(frente, ativos, outros),
    criterioModalidade(o),
    criterioLocal(o, frente, perfil),
    criterioDocumentacao(o),
    criterioValor(o, perfil),
  ];

  const cx = criterioCaixa(o, caixa);
  if (cx) criterios.push(cx.criterio);

  // Com o critério de caixa o máximo passa de 100; a nota volta à escala de 100 proporcionalmente.
  const somaDe = (lista: Criterio[]): number => lista.reduce((acc, c) => acc + c.pontos, 0);
  const notaDe = (lista: Criterio[]): number =>
    cx ? Math.round((somaDe(lista) * 100) / lista.reduce((acc, c) => acc + c.maximo, 0)) : somaDe(lista);

  // O foco substitui o critério de ramo; sem ele o CNAE decide.
  if (foco !== null) criterios[0] = criterioFoco(foco, false);
  let total = notaDe(criterios);
  if (foco !== null && total < NOTA_MINIMA_FOCO && pontuacaoLocal(o, perfil.areas).dentro) {
    total = NOTA_MINIMA_FOCO;
    criterios[0] = criterioFoco(foco, true);
  }
  const semCnae = ativos.length === 0 && outros.length === 0;
  const semMatch = semCnae && foco === null;
  // O foco conta como casado na frente ativa.
  const frenteCasada: Frente | null = ativos.length > 0 || foco !== null ? frente : outros.length > 0 ? outraFrente : null;

  const restante = Date.parse(o.dataEncerramento) - agora.getTime();
  const poucoTempo = restante > 0 && restante < MS_POUCO_TEMPO;

  const alertas: string[] = [];
  if (poucoTempo) alertas.push("Fecha em menos de 6 h: pouco tempo para montar proposta");
  if (ehMei(perfil) && o.valorEstimado !== null && o.valorEstimado > TETO_MEI_ANO_CHEIO) alertas.push("Valor acima do teto anual do MEI");
  if (cx?.alerta) alertas.push(cx.alerta);
  if (foco !== null && semCnae) {
    alertas.push("Nenhum CNAE do CNPJ cobre este objeto: confira se o edital exige CNAE compatível");
  }
  if (frenteCasada === outraFrente) {
    alertas.push(`Casou só com a outra frente (${outraFrente === "produtos" ? "produtos" : "serviços"})`);
  }

  let faixa: Faixa = semMatch ? "nogo" : limitarPeloTeto(faixaDoTotal(total), o.valorEstimado, perfil);
  if (poucoTempo && faixa === "go") faixa = "atencao";

  return {
    total,
    faixa,
    criterios,
    cnaesCasados: [...ativos, ...outros].map((c) => c.codigo),
    frenteCasada,
    ...(foco !== null ? { foco } : {}),
    ...(alertas.length > 0 ? { alertas } : {}),
  };
}
