import { after } from "next/server";
import { lerEventoRecebido } from "@/core/whatsapp-alertas";
import { registrarEvento } from "@/db/whatsapp";
import { processarMensagem } from "@/lib/whatsapp-agente";
import { assinaturaValida } from "@/lib/zernio";

export const maxDuration = 60;

function resposta(status: number): Response {
  return new Response(null, { status });
}

/**
 * Webhook do Zernio (mensagem recebida no WhatsApp). Confere a assinatura do corpo cru, ignora repetidos
 * e responde na hora; a conversa é processada depois da resposta. Nunca registra texto, número nem cabeçalhos.
 */
export async function POST(request: Request): Promise<Response> {
  const cru = await request.text();
  const segredo = process.env.ZERNIO_WEBHOOK_SECRET?.trim() ?? "";
  const assinatura = request.headers.get("x-zernio-signature") ?? request.headers.get("x-late-signature");
  if (segredo === "" || !assinaturaValida(cru, assinatura, segredo)) return resposta(401);

  let corpo: unknown;
  try {
    corpo = JSON.parse(cru);
  } catch {
    return resposta(400);
  }

  const msg = lerEventoRecebido(corpo, request.headers.get("x-zernio-event-id"));
  if (msg === null) return resposta(200);

  const contaEsperada = process.env.ZERNIO_WHATSAPP_ACCOUNT_ID?.trim() ?? "";
  if (msg.contaId !== null && msg.contaId !== contaEsperada) return resposta(200);

  try {
    if (!(await registrarEvento(msg.eventoId))) return resposta(200);
  } catch {
    console.error("[whatsapp] webhook: falha ao registrar o evento");
    return resposta(500);
  }

  after(() => processarMensagem(msg));
  return resposta(200);
}
