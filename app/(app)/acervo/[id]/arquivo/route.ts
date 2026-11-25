import { NextResponse } from "next/server";
import { lerArquivoAcervo } from "@/db/acervo";
import { lerSessao } from "@/lib/sessao";

/** Nome com acento vai em filename* (RFC 5987); filename leva só ASCII, para navegadores antigos. */
function cabecalhoDisposicao(nome: string): string {
  const ascii = nome.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}

/** Abre o arquivo de um documento do acervo. Qualquer pessoa da mesma empresa vê. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ erro: "Sessão expirada. Entre de novo." }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const arquivo = await lerArquivoAcervo(sessao.empresaId, id);
    if (arquivo === null) return NextResponse.json({ erro: "Arquivo não encontrado." }, { status: 404 });
    return new Response(new Uint8Array(arquivo.bytes), {
      headers: {
        "Content-Type": arquivo.tipo,
        "Content-Length": String(arquivo.bytes.length),
        "Content-Disposition": cabecalhoDisposicao(arquivo.nome),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("[acervo] arquivo:", e instanceof Error ? e.message : e);
    return NextResponse.json({ erro: "Não foi possível abrir o arquivo agora." }, { status: 500 });
  }
}
