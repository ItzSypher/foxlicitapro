/**
 * Caminho do dinheiro de uma licitação: empenho, ordem, entrega ou execução, atesto, pagamento.
 * Mostra quantos dias passam sem receber e quanto caixa a pessoa precisa ter, com a ficha do edital
 * (prazos exatos) ou, sem ela, por uma estimativa pelo tipo do objeto e pelo valor.
 * Funções puras, sem rede nem banco.
 */
import { normalizarTexto } from "./cnae-keywords";
import { calcularCapitalGiro, DIAS_CICLO_MENSAL } from "./capital-giro";
import { FRACAO_CUSTO_ESTIMADA, MESES_CONTRATO_PADRAO } from "./caixa";
import type { FichaEdital } from "./ficha";
import { servicoRemoto } from "./score";
import type { Frente, Score } from "./types";

export type NivelCaixa = "baixo" | "medio" | "alto";

export const NOME_NIVEL_CAIXA: Record<NivelCaixa, string> = { baixo: "baixo", medio: "médio", alto: "alto" };

/** Serviço presencial: deslocamento e mão de obra custam esta fração do valor estimado. */
export const FRACAO_CUSTO_SERVICO = 0.1;
/** Produto até este valor é caixa médio; acima, alto. */
export const LIMITE_PRODUTO_MEDIO = 5_000;
/** Serviço presencial até este valor é caixa baixo; acima, médio. */
export const LIMITE_SERVICO_BAIXO = 30_000;
/** Garantia contratual a partir deste percentual sobe o nível do caixa. */
export const GARANTIA_QUE_SOBE_NIVEL = 5;

/** O que a função precisa da oportunidade; o Radar e a licitação já têm estes campos. */
export interface OportunidadeCaixa {
  objeto: string;
  valorEstimado: number | null;
  /** Frente que o score identificou; com ela a heurística acerta produto x serviço */
  score?: Pick<Score, "frenteCasada">;
}

export type TipoObjeto = "produto" | "servico-remoto" | "servico-presencial";

export type IdEtapa = "empenho" | "ordem" | "antecipado" | "entrega" | "medicao" | "atesto" | "pagamento";

export interface EtapaDinheiro {
  id: IdEtapa;
  rotulo: string;
  /** Prazo estimado em texto curto, pronto para mostrar */
  prazo: string;
  /** Dias do prazo, quando há número */
  dias: number | null;
  /** Frase curta do que acontece nesta etapa */
  detalhe: string;
}

export interface AvaliacaoCaixa {
  nivel: NivelCaixa;
  explicacao: string;
}

export interface CaixaEstimado {
  /** R$ estimado a pôr do bolso antes de receber; null quando falta o valor do edital */
  valor: number | null;
  nivel: NivelCaixa;
  explicacao: string;
}

export interface CaminhoDoDinheiro {
  tipo: TipoObjeto;
  /** true quando os prazos vieram da ficha do edital */
  comFicha: boolean;
  etapas: EtapaDinheiro[];
  /** Entrega + pagamento; 0 com pagamento antecipado; null quando falta prazo */
  diasSemReceber: number | null;
  caixaNecessario: CaixaEstimado;
  /** Dicas para receber mais rápido */
  dicas: string[];
}

const TERMOS_SERVICO = /\b(servicos?|prestacao|manutencao|locacao|instalacao|reforma|obra|obras|consultoria|assessoria|treinamento|capacitacao|limpeza|vigilancia|transporte)\b/;

function positivo(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

function naoNegativo(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

function frenteDe(o: OportunidadeCaixa): Frente {
  const casada = o.score?.frenteCasada ?? null;
  if (casada !== null) return casada;
  return TERMOS_SERVICO.test(normalizarTexto(o.objeto)) ? "servicos" : "produtos";
}

/** Produto, serviço feito à distância (site, sistema, hospedagem) ou serviço presencial. */
export function tipoDoObjeto(o: OportunidadeCaixa): TipoObjeto {
  if (servicoRemoto(o.objeto)) return "servico-remoto";
  return frenteDe(o) === "servicos" ? "servico-presencial" : "produto";
}

function textoDias(n: number): string {
  return `${n} ${n === 1 ? "dia" : "dias"}`;
}

function subir(nivel: NivelCaixa): NivelCaixa {
  return nivel === "baixo" ? "medio" : "alto";
}

function garantiaDe(ficha: FichaEdital | null): number {
  const g = ficha?.garantiaContratualPercentual.valor ?? null;
  return positivo(g) ? g : 0;
}

function antecipadoDe(ficha: FichaEdital | null): boolean {
  return ficha?.pagamentoAntecipado.valor === true;
}

function mensalDe(ficha: FichaEdital | null): boolean {
  return ficha?.medicaoMensal.valor === true;
}

/** Nível de caixa e a frase que explica. Sem ficha, usa só o tipo do objeto e o valor. */
export function avaliarCaixa(o: OportunidadeCaixa, ficha?: FichaEdital | null): AvaliacaoCaixa {
  const f = ficha ?? null;
  const tipo = tipoDoObjeto(o);
  const valor = positivo(o.valorEstimado) ? o.valorEstimado : null;
  const antecipado = antecipadoDe(f);

  let nivel: NivelCaixa;
  let explicacao: string;
  if (antecipado) {
    nivel = "baixo";
    explicacao = "O órgão paga antes da entrega: o seu dinheiro não fica parado. Confira a condição no edital.";
  } else if (tipo === "servico-remoto") {
    nivel = "baixo";
    explicacao = "Serviço feito à distância: você entrega o trabalho, sem comprar mercadoria antes.";
  } else if (tipo === "servico-presencial") {
    if (valor !== null && valor > LIMITE_SERVICO_BAIXO) {
      nivel = "medio";
      explicacao = "Serviço de valor maior: mão de obra e deslocamento já pesam antes de receber.";
    } else {
      nivel = "baixo";
      explicacao = "Serviço: o gasto é mão de obra e deslocamento, uma parte pequena do valor.";
    }
  } else if (valor !== null && valor > LIMITE_PRODUTO_MEDIO) {
    nivel = "alto";
    explicacao = "Produto: você paga o fornecedor antes de receber do órgão e precisa ter esse dinheiro.";
  } else {
    nivel = "medio";
    explicacao = "Produto de valor pequeno: você compra a mercadoria antes de receber, mas o valor é baixo.";
  }

  const garantia = garantiaDe(f);
  if (garantia >= GARANTIA_QUE_SOBE_NIVEL) {
    nivel = subir(nivel);
    explicacao = `${explicacao} A garantia contratual de ${garantia}% aumenta o caixa.`;
  }
  return { nivel, explicacao };
}

/** "baixo" | "medio" | "alto" para o Radar e a licitação. */
export function nivelCaixa(o: OportunidadeCaixa, ficha?: FichaEdital | null): NivelCaixa {
  return avaliarCaixa(o, ficha).nivel;
}

/** R$ estimado que sai do bolso antes de receber. null quando o edital não traz valor e o objeto exige gasto. */
function estimarCaixa(o: OportunidadeCaixa, ficha: FichaEdital | null): number | null {
  const tipo = tipoDoObjeto(o);
  const valor = positivo(o.valorEstimado) ? o.valorEstimado : null;
  const garantia = garantiaDe(ficha);
  const garantiaReais = valor !== null ? (valor * garantia) / 100 : 0;

  if (antecipadoDe(ficha)) return garantiaReais;
  if (tipo === "servico-remoto") return garantiaReais;
  if (valor === null) return null;
  // Contrato mensal: o gasto de cada ciclo é a parcela do mês, não o contrato inteiro.
  const base = mensalDe(ficha) ? valor / MESES_CONTRATO_PADRAO : valor;
  const fracao = tipo === "produto" ? FRACAO_CUSTO_ESTIMADA : FRACAO_CUSTO_SERVICO;
  return base * fracao + garantiaReais;
}

/** R$ estimado a pôr do bolso antes de receber, para o Radar. Sem ficha, usa o tipo do objeto e o valor; null quando falta o valor do edital. */
export function valorEstimadoCaixa(o: OportunidadeCaixa, ficha?: FichaEdital | null): number | null {
  return estimarCaixa(o, ficha ?? null);
}

function etapaPagamento(dias: number | null): EtapaDinheiro {
  return {
    id: "pagamento",
    rotulo: "Pagamento",
    prazo: dias === null ? "prazo não informado" : `em até ${textoDias(dias)}`,
    dias,
    detalhe: "O órgão paga na conta da empresa depois da liquidação.",
  };
}

function montarEtapas(tipo: TipoObjeto, ficha: FichaEdital | null): EtapaDinheiro[] {
  const produto = tipo === "produto";
  const entregaDias = ficha?.prazoEntregaDias.valor ?? null;
  const pagamentoDias = ficha?.prazoPagamentoDias.valor ?? null;
  const mensal = mensalDe(ficha);
  const antecipado = antecipadoDe(ficha);
  const comPrazoEntrega = naoNegativo(entregaDias);

  const etapas: EtapaDinheiro[] = [
    {
      id: "empenho",
      rotulo: "Nota de empenho",
      prazo: "logo após a assinatura",
      dias: null,
      detalhe: "O órgão reserva o dinheiro no orçamento. Sem empenho, não compre nada.",
    },
    {
      id: "ordem",
      rotulo: produto ? "Ordem de fornecimento" : "Ordem de serviço",
      prazo: "junto ou logo após o empenho",
      dias: null,
      detalhe: produto ? "É o aviso para entregar. O prazo de entrega começa a contar aqui." : "É o aviso para começar. O prazo de execução começa a contar aqui.",
    },
  ];

  if (antecipado) {
    const condicao = ficha?.pagamentoAntecipado.condicao ?? null;
    etapas.push({
      id: "antecipado",
      rotulo: "Pagamento antecipado",
      prazo: "antes da entrega",
      dias: 0,
      detalhe: condicao !== null && condicao !== "" ? condicao : "O edital prevê pagar antes de entregar; confira a condição.",
    });
  }

  etapas.push({
    id: "entrega",
    rotulo: mensal ? (produto ? "Entrega do mês" : "Execução do mês") : produto ? "Entrega" : "Execução do serviço",
    prazo: comPrazoEntrega ? `em até ${textoDias(entregaDias)}` : mensal ? `ciclo de ${textoDias(DIAS_CICLO_MENSAL)}` : "prazo não informado",
    dias: comPrazoEntrega ? entregaDias : mensal ? DIAS_CICLO_MENSAL : null,
    detalhe: produto ? "Você entrega e emite a nota fiscal." : "Você executa o serviço e emite a nota fiscal.",
  });

  if (mensal) {
    etapas.push({
      id: "medicao",
      rotulo: "Medição mensal",
      prazo: "fim de cada mês",
      dias: null,
      detalhe: "O órgão confere o que foi feito no mês e libera a nota para pagamento.",
    });
  }

  etapas.push({
    id: "atesto",
    rotulo: "Atesto e liquidação",
    prazo: "poucos dias após a nota",
    dias: null,
    detalhe: "O fiscal confirma que recebeu certo e o órgão liquida a despesa. Aqui o pagamento costuma travar.",
  });

  etapas.push(etapaPagamento(naoNegativo(pagamentoDias) ? pagamentoDias : null));
  return etapas;
}

function montarDicas(tipo: TipoObjeto, ficha: FichaEdital | null): string[] {
  const dicas = ["Peça a nota de empenho antes de comprar ou começar: sem ela você pode não receber."];
  if (tipo === "produto") dicas.push("Fale com o fornecedor sobre pagar a prazo, para o seu dinheiro sair perto de quando entra.");
  dicas.push("Emita a nota fiscal no dia da entrega, com os dados do empenho.");
  dicas.push("Acompanhe a liquidação com o fiscal do contrato: o prazo de pagamento só conta depois do atesto.");
  if (garantiaDe(ficha) > 0) dicas.push("Veja se o seguro-garantia sai mais barato do que deixar dinheiro parado como caução.");
  if (mensalDe(ficha)) dicas.push("Entregue o relatório da medição no primeiro dia útil do mês seguinte.");
  return dicas;
}

/**
 * Monta o caminho do dinheiro. Com ficha usa os prazos do edital; sem ela, mostra as etapas padrão
 * sem prazos exatos e a estimativa pelo tipo do objeto e pelo valor.
 */
export function caminhoDoDinheiro(ficha: FichaEdital | null, oportunidade: OportunidadeCaixa): CaminhoDoDinheiro {
  const tipo = tipoDoObjeto(oportunidade);
  const avaliacao = avaliarCaixa(oportunidade, ficha);

  let diasSemReceber: number | null = null;
  if (ficha !== null) {
    if (antecipadoDe(ficha)) {
      diasSemReceber = 0;
    } else {
      diasSemReceber = calcularCapitalGiro({
        prazoEntregaDias: ficha.prazoEntregaDias.valor,
        prazoPagamentoDias: ficha.prazoPagamentoDias.valor,
        medicaoMensal: ficha.medicaoMensal.valor,
        pagamentoAntecipado: false,
      }).dias;
    }
  }

  return {
    tipo,
    comFicha: ficha !== null,
    etapas: montarEtapas(tipo, ficha),
    diasSemReceber,
    caixaNecessario: { valor: estimarCaixa(oportunidade, ficha), nivel: avaliacao.nivel, explicacao: avaliacao.explicacao },
    dicas: montarDicas(tipo, ficha),
  };
}
