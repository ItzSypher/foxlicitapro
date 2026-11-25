import { NextResponse } from "next/server";
import { lerArquivoAssinado } from "@/db/atestados";
import { lerSessao } from "@/lib/sessao";

/** Abre o PDF assinado fora do sistema (gov.br). Qualquer pessoa da empresa vê. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ erro: "Sessão expirada. Entre de novo." }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const bytes = await lerArquivoAssinado(sessao.empresaId, id);
    if (bytes === null) return NextResponse.json({ erro: "Arquivo não encontrado." }, { status: 404 });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="atestado-assinado.pdf"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("[atestados] arquivo:", e instanceof Error ? e.message : e);
    return NextResponse.json({ erro: "Não foi possível abrir o arquivo agora." }, { status: 500 });
  }
}
