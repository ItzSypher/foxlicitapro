import type { ContextoConselheiro } from "./contexto";
import type { SaidaConselheiro } from "./esquema";
import { AVISO_VALORES_ESTRANHOS, textosDaSaida, valoresEstranhos } from "./valores";

const MAX_RISCOS = 8;

/**
 * Ajusta a resposta validada às regras do sistema, que mandam mais que o assistente:
 * - ehPregao e foraDoFoco vêm da regra de pregão e das exceções, nunca do modelo;
 * - pregão fora do foco não passa de "talvez";
 * - valor em reais que o sistema não entregou ganha um aviso nos riscos.
 */
export function refinarSaida(saida: SaidaConselheiro, contexto: Pick<ContextoConselheiro, "pregao" | "valoresPermitidos">): SaidaConselheiro {
  const { pregao } = contexto;
  const veredito = pregao.foraDoFoco && saida.veredito === "vale" ? "talvez" : saida.veredito;
  let riscos = saida.riscos;
  if (valoresEstranhos(textosDaSaida(saida), contexto.valoresPermitidos).length > 0) {
    riscos = [...riscos.slice(0, MAX_RISCOS - 1), AVISO_VALORES_ESTRANHOS];
  }
  return {
    ...saida,
    veredito,
    riscos,
    modalidade: { ...saida.modalidade, ehPregao: pregao.ehPregao, foraDoFoco: pregao.foraDoFoco },
  };
}
