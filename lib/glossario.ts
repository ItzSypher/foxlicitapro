import type { CriterioId, Faixa } from "@/core/types";

/** Explicações curtas, para quem não conhece licitação. Usadas nas dicas "i" do painel. */
export const GLOSSARIO = {
  dispensa: "Dispensa: compra rápida de menor valor. A disputa é simples e costuma pedir poucos documentos.",
  pregao: "Pregão: disputa por lances, mais concorrida. Vence o menor preço e a lista de documentos é maior.",
  meEpp:
    "ME/EPP: microempresa e empresa de pequeno porte. O MEI entra nesse grupo e tem vantagens, como preferência em caso de empate e prazo extra para regularizar certidões.",
  srp: "SRP (registro de preços): o órgão fixa o preço agora e compra aos poucos, quando precisar. Não garante uma quantidade mínima.",
  teto: "Teto: valor máximo que o órgão aceita pagar. Seu preço não pode passar dele.",
  desagio:
    "Deságio: o quanto o seu preço fica abaixo do teto. Quanto maior o deságio, maior a chance de vencer e menor a sua margem.",
  atestado:
    "Atestado de capacidade técnica: documento de um cliente que comprova que você já fez serviço parecido. Pregões podem exigir.",
  cnd: "CND (certidão negativa de débitos): prova que a empresa não deve impostos. É pedida na maioria das licitações.",
  sicaf:
    "SICAF: cadastro federal de fornecedores do governo. Reúne os documentos da empresa e vale em várias compras públicas.",
  prazo:
    "Prazo: até esta data e hora o órgão aceita propostas. Depois disso a disputa fecha e não dá mais para participar.",
} as const;

export type ChaveGlossario = keyof typeof GLOSSARIO;

/** O que cada critério da nota mede, em uma frase. */
export const EXPLICACAO_CRITERIO: Readonly<Record<CriterioId, string>> = {
  cnae: "Se o que o órgão quer comprar combina com as atividades da sua empresa.",
  modalidade: "Dispensa é disputa simples e rápida. Pregão tem mais concorrentes.",
  local: "Quanto mais perto de Nova Iguaçu, menor o custo de entrega ou de deslocamento.",
  documentacao:
    "Dispensa costuma pedir só CNPJ, certidões e a proposta. Pregão pode exigir balanço e atestado de capacidade técnica. Confirme no edital.",
  valor: "Se o valor estimado cabe no limite de faturamento do MEI. Acima do teto anual, só disputando parte dos itens.",
  caixa: "Se o dinheiro que você paga antes de receber, e por quantos dias, cabe nos limites definidos em Preferências. Peso pequeno.",
};

/** O que cada faixa da nota significa. */
export const EXPLICACAO_FAIXA: Readonly<Record<Faixa, { rotulo: string; intervalo: string; frase: string }>> = {
  go: { rotulo: "Boa", intervalo: "75 ou mais", frase: "Vale montar a proposta." },
  atencao: { rotulo: "Atenção", intervalo: "50 a 74", frase: "Dá para participar, mas confira os pontos fracos." },
  nogo: { rotulo: "Evitar", intervalo: "abaixo de 50", frase: "Pouca chance ou pouco retorno." },
};
