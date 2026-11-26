import type { ContextoConselheiro } from "./contexto";
import type { SaidaConselheiro } from "./esquema";
import { AVISO_VALORES_ESTRANHOS, textosDaSaida, valoresEstranhos } from "./valores";

/** Listas curtas: o modelo às vezes passa do pedido no prompt, o sistema corta. */
const MAX_ITENS = 4;
const MAX_RISCOS = MAX_ITENS;

/**
 * Ajusta a resposta validada às regras do sistema, que mandam mais que o assistente:
 * - ehPregao e foraDoFoco vêm da regra de pregão e das exceções, nunca do modelo;
 * - sem meio-termo: "talvez" vira "nao-vale"; pregão fora do foco é "nao-vale";
 * - valor em reais que o sistema não entregou ganha um aviso nos riscos.
 */
export function refinarSaida(saida: SaidaConselheiro, contexto: Pick<ContextoConselheiro, "pregao" | "valoresPermitidos">): SaidaConselheiro {
  const { pregao } = contexto;
  const veredito = pregao.foraDoFoco || saida.veredito === "talvez" ? "nao-vale" : saida.veredito;
  let riscos = saida.riscos.slice(0, MAX_RISCOS);
  if (valoresEstranhos(textosDaSaida(saida), contexto.valoresPermitidos).length > 0) {
    riscos = [...riscos.slice(0, MAX_RISCOS - 1), AVISO_VALORES_ESTRANHOS];
  }
  return {
    ...saida,
    veredito,
    porQue: saida.porQue.slice(0, MAX_ITENS),
    proximosPassos: saida.proximosPassos.slice(0, MAX_ITENS),
    comoConseguir: saida.comoConseguir.map((c) => ({ ...c, passos: c.passos.slice(0, MAX_ITENS), cuidados: c.cuidados.slice(0, MAX_ITENS) })),
    riscos,
    modalidade: { ...saida.modalidade, ehPregao: pregao.ehPregao, foraDoFoco: pregao.foraDoFoco },
  };
}
