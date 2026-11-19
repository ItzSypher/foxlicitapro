import "server-only";
import { sql } from "@/db/client";
import { prontasPorCompra } from "@/core/propostas-prontas";
import { ehStatusEquipe } from "@/core/revisao";

interface LinhaPronta {
  id: string;
  compra_id: string | null;
  status: string;
}

/**
 * Das compras pedidas, as que já têm rascunho montado pelo assistente e ainda não enviado: compra -> id da proposta.
 * Uma consulta só, para o selo "Proposta pronta" do Radar.
 */
export async function propostasProntasDasCompras(empresaId: string, compraIds: ReadonlyArray<string>): Promise<Record<string, string>> {
  if (compraIds.length === 0) return {};
  const linhas = await sql<LinhaPronta[]>`
    select id, compra_id, status
    from propostas
    where empresa_id = ${empresaId} and autor = 'assistente' and status <> 'enviada' and compra_id in ${sql([...compraIds])}
    order by atualizado_em desc`;
  return prontasPorCompra(
    linhas.flatMap((l) => (ehStatusEquipe(l.status) ? [{ id: l.id, compraId: l.compra_id, autor: "assistente" as const, status: l.status }] : [])),
  );
}
