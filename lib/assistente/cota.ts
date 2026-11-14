import "server-only";
import { calcularCota, intervaloDoDia, FUSO_PADRAO, type CotaAssistente } from "@/core/limite-diario";
import { contarPropostasDoAssistente } from "@/db/propostas";
import { lerUsuario } from "@/db/usuarios";

/**
 * Quantas propostas a pessoa ainda pode montar hoje com o assistente (dia no fuso de São Paulo).
 * Dono não tem limite. `agora` e `fuso` entram por parâmetro para os testes.
 */
export async function restantesHoje(
  usuarioId: string,
  agora: Date = new Date(),
  fuso: string = FUSO_PADRAO,
): Promise<CotaAssistente> {
  const usuario = await lerUsuario(usuarioId);
  if (!usuario) return { ilimitada: false, limite: 0, usadas: 0, restantes: 0 };
  if (usuario.papel === "dono") return calcularCota({ ehDono: true, limite: 0, usadas: 0 });
  const { inicio, fim } = intervaloDoDia(agora, fuso);
  const usadas = await contarPropostasDoAssistente(usuario.empresaId, usuarioId, inicio, fim);
  return calcularCota({ ehDono: false, limite: usuario.limitePropostasAssistenteDia, usadas });
}
