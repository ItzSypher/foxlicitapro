import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_SESSAO, lerToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Proposta compartilhada por link: pública, só leitura; o token no endereço é a credencial.
  if (pathname.startsWith("/p/")) return NextResponse.next();

  // Coleta agendada: a própria rota confere o CRON_SECRET.
  if (pathname.startsWith("/api/cron/")) return NextResponse.next();

  // Limpa o cookie de uma sessão que o servidor não aceita mais (pessoa desativada).
  if (pathname === "/login/sair") return NextResponse.next();

  const autenticado =
    (await lerToken(request.cookies.get(COOKIE_SESSAO)?.value, process.env.APP_SECRET)) !== null;

  if (pathname === "/login") {
    if (autenticado) return NextResponse.redirect(new URL("/radar", request.url));
    return NextResponse.next();
  }

  if (autenticado) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ erro: "Sessão necessária." }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
