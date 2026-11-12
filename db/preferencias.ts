import "server-only";
import { preferenciasPadrao, preferenciasSchema } from "@/core/preferencias";
import type { Preferencias } from "@/core/types-equipe";
import { sql } from "./client";

interface LinhaPreferencias {
  termos_prioritarios: string[];
  termos_bloqueados_para_voce: string[];
  emails_resumo: string[];
  resumo_ativo: boolean;
}

/** Lê as preferências (linha única id=1). Sem a linha ou com o banco fora do ar, devolve os padrões. */
export async function lerPreferencias(): Promise<Preferencias> {
  try {
    const linhas = await sql<LinhaPreferencias[]>`
      select termos_prioritarios, termos_bloqueados_para_voce, emails_resumo, resumo_ativo
      from preferencias where id = 1`;
    const linha = linhas[0];
    if (!linha) return preferenciasPadrao();
    return {
      termosPrioritarios: linha.termos_prioritarios,
      termosBloqueadosParaVoce: linha.termos_bloqueados_para_voce,
      emailsResumo: linha.emails_resumo,
      resumoAtivo: linha.resumo_ativo,
    };
  } catch {
    return preferenciasPadrao();
  }
}

/** Valida, normaliza os termos e grava na linha única. Devolve o que foi salvo. Lança se os dados forem inválidos. */
export async function salvarPreferencias(entrada: Preferencias): Promise<Preferencias> {
  const p = preferenciasSchema.parse(entrada);
  await sql`
    insert into preferencias (id, termos_prioritarios, termos_bloqueados_para_voce, emails_resumo, resumo_ativo, atualizado_em)
    values (1, ${p.termosPrioritarios}::text[], ${p.termosBloqueadosParaVoce}::text[],
            ${p.emailsResumo}::text[], ${p.resumoAtivo}, now())
    on conflict (id) do update set
      termos_prioritarios = excluded.termos_prioritarios,
      termos_bloqueados_para_voce = excluded.termos_bloqueados_para_voce,
      emails_resumo = excluded.emails_resumo,
      resumo_ativo = excluded.resumo_ativo,
      atualizado_em = now()`;
  return p;
}
