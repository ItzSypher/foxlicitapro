import type { NextRequest } from "next/server";
import { z } from "zod";
import { converterBusca, montarUrlBusca } from "@/core/pncp/busca";
import { acharUf } from "@/core/ufs";
import { lerSessao } from "@/lib/sessao";

const consultaSchema = z.object({
  q: z.string().trim().min(3).max(120),
  uf: z.string().max(200).default(""),
  pagina: z.coerce.number().int().min(1).max(20).default(1),
});

const TIMEOUT_MS = 12_000;

/**
 * Busca por texto direto no PNCP, para achar o que a coleta diária por estado ainda não trouxe.
 * `uf` é uma lista separada por vírgula; vazia busca no Brasil todo.
 */
export async function GET(request: NextRequest): Promise<Response> {
  if (!(await lerSessao())) return Response.json({ erro: "Sessão expirada. Entre de novo." }, { status: 401 });

  const p = request.nextUrl.searchParams;
  const consulta = consultaSchema.safeParse({
    q: p.get("q") ?? "",
    uf: p.get("uf") ?? undefined,
    pagina: p.get("pagina") ?? undefined,
  });
  if (!consulta.success) return Response.json({ erro: "Digite ao menos 3 letras para buscar." }, { status: 400 });

  const ufs = consulta.data.uf
    .split(",")
    .map((u) => acharUf(u)?.sigla ?? null)
    .filter((u): u is string => u !== null);

  try {
    const resposta = await fetch(montarUrlBusca({ texto: consulta.data.q, ufs, pagina: consulta.data.pagina }), {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; FoxLicita)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!resposta.ok) return Response.json({ erro: "O PNCP não respondeu agora. Tente de novo." }, { status: 502 });
    return Response.json(converterBusca(await resposta.json(), new Date()));
  } catch {
    return Response.json({ erro: "O PNCP não respondeu agora. Tente de novo." }, { status: 502 });
  }
}
