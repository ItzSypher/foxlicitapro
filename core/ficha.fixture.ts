import type { FichaEdital } from "./ficha";

const vazio = { trecho: null, pagina: null } as const;

/** Ficha de exemplo para os testes: serviço mensal, pagamento em 30 dias. */
export const FICHA_EXEMPLO: FichaEdital = {
  natureza: { valor: "servico-continuo", trecho: "serviço contínuo de suporte técnico", pagina: 3 },
  formaPagamento: { valor: "Ordem bancária após atesto da nota fiscal", trecho: "pagamento por ordem bancária", pagina: 12 },
  prazoPagamentoDias: { valor: 30, trecho: "em até 30 dias do atesto", pagina: 12 },
  medicaoMensal: { valor: true, trecho: "medição mensal dos serviços", pagina: 12 },
  pagamentoAntecipado: { valor: false, condicao: null, ...vazio },
  prazoEntregaDias: { valor: 10, trecho: "início em até 10 dias", pagina: 8 },
  localEntrega: { valor: "Sede do órgão, Nova Iguaçu/RJ", ...vazio },
  garantiaContratualPercentual: { valor: 5, trecho: "garantia de 5%", pagina: 15 },
  reajuste: { valor: "Anual, pelo IPCA", ...vazio },
  multasSancoes: { valor: "Multa de 0,5% ao dia, até 10%", ...vazio },
  amostraProvaConceito: { valor: "não informado no edital", ...vazio },
  visitaTecnica: { valor: "não informado no edital", ...vazio },
  documentosHabilitacao: { valor: ["Certidão negativa federal", "Atestado de capacidade técnica"], ...vazio },
  criterioJulgamento: { valor: "Menor preço", ...vazio },
  modoDisputa: { valor: "Aberto", ...vazio },
  exclusividadeMeEpp: { valor: true, ...vazio },
  comoCompetir: ["Confira o atestado exigido.", "Dê lances curtos no modo aberto.", "Calcule o caixa de 40 dias."],
};
