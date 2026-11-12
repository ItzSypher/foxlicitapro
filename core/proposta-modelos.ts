import type { DadosProposta, DetalheCompra } from "./types-detalhe";
import type { Frente } from "./types";

export type ModeloId = "dispensa-produtos" | "dispensa-servicos" | "pregao-produtos" | "cotacao-simples";

export interface ModeloProposta {
  id: ModeloId;
  nome: string;
  /** Uma frase: em que situação este modelo serve */
  quandoUsar: string;
  frente: Frente;
  textos: {
    abertura: string;
    declaracoes: string[];
    fechamento: string;
  };
  padroes: Partial<DadosProposta>;
}

const DECL_TRIBUTOS_PRODUTOS =
  "Os preços propostos incluem todos os tributos, fretes, seguros e demais encargos incidentes sobre o fornecimento, nada mais sendo devido a qualquer título.";
const DECL_TRIBUTOS_SERVICOS =
  "Os preços propostos incluem mão de obra, materiais, deslocamentos, tributos e demais encargos incidentes sobre a prestação dos serviços, nada mais sendo devido a qualquer título.";
const DECL_VALIDADE =
  "A proposta é válida pelo prazo indicado nas condições, contado da data de sua emissão.";
const DECL_MEI =
  "A empresa está enquadrada como microempreendedor individual (MEI) e opta pelos benefícios concedidos às microempresas e empresas de pequeno porte pela Lei Complementar nº 123/2006.";
const DECL_CIENCIA =
  "Temos ciência e concordamos com as condições estabelecidas no edital ou aviso de contratação e em seus anexos.";
const DECL_IMPEDITIVO =
  "Declaramos que inexiste fato impeditivo à nossa participação ou à contratação e que comunicaremos qualquer ocorrência superveniente.";
const DECL_MENOR =
  "Declaramos que não empregamos menor de 18 anos em trabalho noturno, perigoso ou insalubre, nem menor de 16 anos em qualquer trabalho, salvo na condição de aprendiz, a partir de 14 anos, nos termos do art. 7º, inciso XXXIII, da Constituição Federal.";

export const MODELOS: readonly ModeloProposta[] = [
  {
    id: "dispensa-produtos",
    nome: "Dispensa eletrônica: fornecimento",
    quandoUsar: "Compra de produtos por dispensa eletrônica, com o aviso de contratação direta publicado pelo órgão.",
    frente: "produtos",
    textos: {
      abertura:
        "Em atenção ao aviso de contratação direta (dispensa eletrônica, art. 75 da Lei nº 14.133/2021) publicado por esse órgão, apresentamos nossa proposta comercial para o fornecimento dos itens relacionados abaixo, de acordo com as especificações e as condições estabelecidas no aviso.",
      declaracoes: [DECL_TRIBUTOS_PRODUTOS, DECL_VALIDADE, DECL_MEI, DECL_CIENCIA, DECL_IMPEDITIVO, DECL_MENOR],
      fechamento: "Colocamo-nos à disposição para os esclarecimentos que se fizerem necessários.",
    },
    padroes: {
      validadeDias: 30,
      prazoEntrega: "10 dias úteis, contados do recebimento da ordem de fornecimento ou da nota de empenho.",
      localEntrega: "Conforme indicado no aviso de contratação direta.",
      pagamento: "Em até 30 dias, contados do recebimento definitivo e da apresentação da nota fiscal.",
      garantia: "Garantia legal e do fabricante, conforme o produto.",
    },
  },
  {
    id: "dispensa-servicos",
    nome: "Dispensa eletrônica: serviços",
    quandoUsar: "Prestação de serviço contratada por dispensa eletrônica, com termo de referência ou descrição no aviso.",
    frente: "servicos",
    textos: {
      abertura:
        "Em atenção ao aviso de contratação direta (dispensa eletrônica, art. 75 da Lei nº 14.133/2021) publicado por esse órgão, apresentamos nossa proposta comercial para a prestação dos serviços relacionados abaixo, de acordo com as especificações e as condições estabelecidas no aviso.",
      declaracoes: [DECL_TRIBUTOS_SERVICOS, DECL_VALIDADE, DECL_MEI, DECL_CIENCIA, DECL_IMPEDITIVO, DECL_MENOR],
      fechamento: "Colocamo-nos à disposição para os esclarecimentos que se fizerem necessários.",
    },
    padroes: {
      validadeDias: 30,
      prazoEntrega: "Início em até 5 dias úteis após a ordem de serviço, com execução conforme o termo de referência.",
      localEntrega: "Conforme indicado no aviso de contratação direta.",
      pagamento: "Em até 30 dias, contados da conclusão dos serviços e da apresentação da nota fiscal.",
      garantia: "Garantia dos serviços prestados, conforme o termo de referência.",
    },
  },
  {
    id: "pregao-produtos",
    nome: "Pregão eletrônico: proposta de preços",
    quandoUsar: "Proposta de preços para pregão eletrônico, enviada antes da sessão pública.",
    frente: "produtos",
    textos: {
      abertura:
        "Apresentamos nossa proposta de preços para o pregão eletrônico em referência, nos termos do edital e de seus anexos, para o objeto e os itens relacionados abaixo.",
      declaracoes: [
        DECL_TRIBUTOS_PRODUTOS,
        "O prazo de validade desta proposta é de, no mínimo, 60 (sessenta) dias, contados da data de abertura da sessão pública.",
        DECL_MEI,
        DECL_CIENCIA,
        DECL_IMPEDITIVO,
        DECL_MENOR,
      ],
      fechamento: "Estamos à disposição para prestar os esclarecimentos solicitados pelo pregoeiro.",
    },
    padroes: {
      validadeDias: 60,
      prazoEntrega: "Conforme o edital, contado do recebimento da nota de empenho.",
      localEntrega: "Conforme indicado no edital.",
      pagamento: "Conforme o edital, após o recebimento definitivo e a apresentação da nota fiscal.",
      garantia: "Garantia legal e do fabricante, conforme o edital.",
    },
  },
  {
    id: "cotacao-simples",
    nome: "Cotação simples",
    quandoUsar: "Orçamento curto, pedido pelo órgão para pesquisa de preços.",
    frente: "produtos",
    textos: {
      abertura:
        "Em resposta à solicitação de cotação desse órgão, apresentamos nosso orçamento para os itens relacionados abaixo.",
      declaracoes: [
        "Os preços informados incluem tributos, frete e demais encargos e correspondem aos praticados pela empresa na data de emissão.",
        "Este orçamento destina-se à pesquisa de preços e não constitui, por si só, compromisso de contratação.",
        DECL_VALIDADE,
        DECL_MEI,
      ],
      fechamento: "Permanecemos à disposição para qualquer esclarecimento.",
    },
    padroes: {
      validadeDias: 30,
      prazoEntrega: "A combinar, conforme a necessidade do órgão.",
      localEntrega: "",
      pagamento: "Conforme a necessidade do órgão.",
      garantia: "",
    },
  },
];

export function ehModeloId(valor: unknown): valor is ModeloId {
  return MODELOS.some((m) => m.id === valor);
}

export function obterModelo(id: ModeloId): ModeloProposta {
  const achado = MODELOS.find((m) => m.id === id);
  if (!achado) throw new Error(`Modelo desconhecido: ${id}`);
  return achado;
}

/** Frente pelo tipo predominante dos itens ("Serviço" x "Material"); em empate ou sem itens, usa o padrão. */
export function frentePredominante(detalhe: DetalheCompra, padrao: Frente): Frente {
  let servicos = 0;
  let produtos = 0;
  for (const item of detalhe.itens) {
    const tipo = (item.tipo ?? "").toLowerCase();
    if (tipo.startsWith("serv")) servicos += 1;
    else if (tipo.length > 0) produtos += 1;
  }
  if (servicos > produtos) return "servicos";
  if (produtos > servicos) return "produtos";
  return padrao;
}

/** Modalidade 8 = dispensa, 6 = pregão. Outras modalidades caem na cotação simples. */
export function sugerirModelo(detalhe: DetalheCompra, frente: Frente): ModeloId {
  if (detalhe.modalidadeId === 8) return frente === "servicos" ? "dispensa-servicos" : "dispensa-produtos";
  if (detalhe.modalidadeId === 6) return "pregao-produtos";
  return "cotacao-simples";
}
