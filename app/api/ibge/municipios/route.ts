import type { NextRequest } from "next/server";
import { listarMunicipios } from "@/lib/ibge";
import { acharUf } from "@/core/ufs";

export async function GET(request: NextRequest): Promise<Response> {
  const uf = request.nextUrl.searchParams.get("uf") ?? "";
  if (!acharUf(uf)) return Response.json({ erro: "Parâmetro uf inválido: use a sigla do estado" }, { status: 400 });

  const municipios = await listarMunicipios(uf);
  if (!municipios) return Response.json({ erro: "Não foi possível carregar os municípios agora" }, { status: 502 });
  return Response.json(municipios);
}
