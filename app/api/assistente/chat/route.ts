import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { montarSistemaDoChat } from "@/lib/assistente/contexto";
import { registrarMensagem } from "@/lib/assistente/limite";
import { interpretarRota } from "@/lib/assistente/rota";
import { ErroAssistente, assistenteDisponivel, gerarTexto } from "@/lib/gemini";
import { COOKIE_FRENTE, lerFrente } from "@/lib/frente";
import { verificarPermissao } from "@/lib/sessao";

export const maxDuration = 120;

const PedidoSchema = z.object({
  rota: z.string().max(300),
  mensagens: z
    .array(z.object({ papel: z.enum(["usuario", "assistente"]), texto: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(12),
});

function erro(mensagem: string, status: number) {
  return NextResponse.json({ erro: mensagem }, { status });
}

/** Chat do assistente: histórico só no cliente; o contexto da página é montado aqui, no servidor. */
export async function POST(request: Request) {
  const acesso = await verificarPermissao("usar_assistente");
  if (!acesso.ok) return erro(acesso.erro, acesso.semSessao ? 401 : 403);
  const sessao = acesso.sessao;
  if (!assistenteDisponivel()) return erro("O assistente ainda não está ativado.", 503);

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return erro("Pedido inválido.", 400);
  }
  const lido = PedidoSchema.safeParse(corpo);
  if (!lido.success || lido.data.mensagens[lido.data.mensagens.length - 1].papel !== "usuario") {
    return erro("Pedido inválido.", 400);
  }

  const limite = registrarMensagem(sessao.usuarioId);
  if (!limite.permitido) {
    const minutos = Math.max(1, Math.ceil(limite.tentarEmMs / 60_000));
    return erro(`Você chegou ao limite de mensagens por hora. Tente de novo em ${minutos} min.`, 429);
  }

  try {
    const jar = await cookies();
    const frente = lerFrente(jar.get(COOKIE_FRENTE)?.value);
    const sistema = await montarSistemaDoChat(interpretarRota(lido.data.rota), frente, new Date());
    const resposta = await gerarTexto({ sistema, historico: lido.data.mensagens, maxTokens: 4096 });
    return NextResponse.json({ resposta });
  } catch (e) {
    if (e instanceof ErroAssistente) return erro(e.message, e.codigo === "limite" ? 429 : 502);
    console.error("[assistente] falha no chat:", e instanceof Error ? e.name : "erro");
    return erro("Não foi possível responder agora. Tente de novo.", 500);
  }
}
