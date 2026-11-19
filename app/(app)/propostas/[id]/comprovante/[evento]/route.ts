import { NextResponse } from "next/server";
import { lerComprovante } from "@/core/proposta-eventos";
import { lerComprovanteEvento } from "@/db/proposta-eventos";
import { lerSessao } from "@/lib/sessao";

const EXTENSAO: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Abre o comprovante de envio (print ou PDF) de um evento da proposta. Qualquer pessoa da empresa vê. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string; evento: string }> }) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ erro: "Sessão expirada. Entre de novo." }, { status: 401 });
  const { id, evento } = await ctx.params;
  try {
    const dataUrl = await lerComprovanteEvento(sessao.empresaId, id, evento);
    const lido = dataUrl === null ? null : lerComprovante(dataUrl);
    if (lido === null || !lido.ok) return NextResponse.json({ erro: "Comprovante não encontrado." }, { status: 404 });
    const bytes = Buffer.from(lido.base64, "base64");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": lido.mime,
        "Content-Disposition": `inline; filename="comprovante-envio.${EXTENSAO[lido.mime] ?? "bin"}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("[propostas] comprovante:", e instanceof Error ? e.message : e);
    return NextResponse.json({ erro: "Não foi possível abrir o comprovante agora." }, { status: 500 });
  }
}
