import type { NextRequest } from "next/server";
import { z } from "zod";
import { buscarRadar } from "@/core/radar";

const consultaSchema = z.object({
  frente: z.enum(["servicos", "produtos"]).default("servicos"),
});

export async function GET(request: NextRequest): Promise<Response> {
  const consulta = consultaSchema.safeParse({
    frente: request.nextUrl.searchParams.get("frente") ?? undefined,
  });
  if (!consulta.success) {
    return Response.json({ erro: "Parâmetro frente inválido: use servicos ou produtos" }, { status: 400 });
  }

  try {
    const radar = await buscarRadar(consulta.data.frente);
    return Response.json(radar);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha ao consultar o PNCP";
    return Response.json({ erro: mensagem }, { status: 502 });
  }
}
