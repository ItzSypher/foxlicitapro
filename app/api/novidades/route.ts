import { listarAvisos } from "@/db/avisos";
import { lerSessao } from "@/lib/sessao";

/** Quantos avisos recentes a central de novidades mostra. */
const LIMITE_NOVIDADES = 10;

/**
 * Consulta leve da central de novidades (o sino consulta a cada 2 min, só com a aba visível):
 * contagem de não lidos e os 10 últimos avisos da empresa da sessão.
 */
export async function GET(): Promise<Response> {
  const sessao = await lerSessao();
  if (!sessao) return Response.json({ erro: "Sessão expirada. Entre de novo." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const { itens, naoLidos } = await listarAvisos(sessao.empresaId, sessao.usuarioId, LIMITE_NOVIDADES);
    return Response.json({ naoLidos, itens }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[novidades]", e instanceof Error ? e.message : e);
    return Response.json({ erro: "Não foi possível carregar as novidades." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
