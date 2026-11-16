import "server-only";
import { calcularCota, intervaloDoDia, FUSO_PADRAO, type CotaAssistente } from "@/core/limite-diario";
import { contarAnalisesDaPessoa } from "@/db/conselheiro";
import { lerUsuario } from "@/db/usuarios";

/**
 * Uma análise do conselheiro é bem mais leve que montar uma proposta: cada proposta do limite diário da pessoa
 * (Equipe) libera tantas análises. O dono não tem limite e limite zero desliga o assistente para a pessoa.
 */
export const ANALISES_POR_PROPOSTA = 5;

export function limiteDeAnalises(limitePropostasPorDia: number): number {
  return Math.max(0, Math.trunc(limitePropostasPorDia)) * ANALISES_POR_PROPOSTA;
}

export function mensagemLimiteAnalises(limite: number): string {
  const n = Math.max(0, Math.trunc(limite));
  const analises = n === 1 ? "1 análise" : `${n} análises`;
  return `Você já pediu ${analises} ao conselheiro hoje. Tente amanhã.`;
}

/** Quantas análises a pessoa ainda pode pedir hoje (dia no fuso de São Paulo). `agora` e `fuso` entram para os testes. */
export async function analisesRestantesHoje(
  usuarioId: string,
  agora: Date = new Date(),
  fuso: string = FUSO_PADRAO,
): Promise<CotaAssistente> {
  const usuario = await lerUsuario(usuarioId);
  if (!usuario) return { ilimitada: false, limite: 0, usadas: 0, restantes: 0 };
  if (usuario.papel === "dono") return calcularCota({ ehDono: true, limite: 0, usadas: 0 });
  const { inicio, fim } = intervaloDoDia(agora, fuso);
  const usadas = await contarAnalisesDaPessoa(usuario.empresaId, usuarioId, inicio, fim);
  return calcularCota({ ehDono: false, limite: limiteDeAnalises(usuario.limitePropostasAssistenteDia), usadas });
}
