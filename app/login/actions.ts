"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  COOKIE_SESSAO,
  DURACAO_SESSAO_SEGUNDOS,
  criarToken,
  lerConfigAcesso,
  senhaConfere,
} from "@/lib/auth";

export interface EstadoLogin {
  erro: string | null;
}

export async function entrar(_anterior: EstadoLogin, dados: FormData): Promise<EstadoLogin> {
  const config = lerConfigAcesso();
  if (!config) {
    return { erro: "Acesso não configurado: defina APP_PASSWORD e APP_SECRET no servidor." };
  }

  const informada = dados.get("senha");
  if (typeof informada !== "string" || informada.length === 0) {
    return { erro: "Digite a senha para entrar." };
  }

  if (!(await senhaConfere(informada, config.senha, config.segredo))) {
    await new Promise((resolver) => setTimeout(resolver, 600));
    return { erro: "Senha incorreta." };
  }

  const token = await criarToken(config.segredo);
  const jar = await cookies();
  jar.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SESSAO_SEGUNDOS,
  });
  redirect("/radar");
}
