import { NextResponse, type NextRequest } from "next/server";
import { linhasParaCsv, nomeArquivoPeriodo } from "@/core/resultados";
import { montarRelatorio } from "@/lib/resultados-relatorio";
import { verificarPermissao } from "@/lib/sessao";

/** Baixa a lista do período com os filtros da tela, num CSV que o Excel abre direto (BOM, ponto e vírgula, vírgula decimal). */
export async function GET(request: NextRequest) {
  const acesso = await verificarPermissao("aprovar_propostas");
  if (!acesso.ok) {
    return NextResponse.json({ erro: acesso.erro }, { status: acesso.semSessao ? 401 : 403 });
  }
  try {
    const relatorio = await montarRelatorio(acesso.sessao.empresaId, Object.fromEntries(request.nextUrl.searchParams), new Date());
    return new Response(`﻿${linhasParaCsv(relatorio.linhas)}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="resultados-${nomeArquivoPeriodo(relatorio.periodo)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[resultados] csv falhou:", e instanceof Error ? e.message : e);
    return NextResponse.json({ erro: "Não foi possível gerar o arquivo agora. Tente de novo em instantes." }, { status: 500 });
  }
}
