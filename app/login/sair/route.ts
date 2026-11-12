import { NextResponse } from "next/server";
import { COOKIE_SESSAO } from "@/lib/auth";

/** Apaga o cookie de sessão e volta ao login. Usada quando a sessão assinada já não vale no servidor. */
export function GET(request: Request): NextResponse {
  const resposta = NextResponse.redirect(new URL("/login", request.url));
  resposta.cookies.delete(COOKIE_SESSAO);
  return resposta;
}
